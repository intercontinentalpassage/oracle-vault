// send-cart-to-telegram
//
// Public endpoint (verify_jwt: false, because shoppers are not logged in).
// Called by the cart's "Buy in Telegram" button. Posts a photo of the chosen
// ticket numbers, captioned "I want to buy this", to the shop's Telegram channel.
//
// Safety:
//  - The bot token comes ONLY from the TELEGRAM_BOT_TOKEN secret (no default here).
//  - The channel comes from site_settings.telegram_channel (set in Admin > Settings).
//  - The caption is built here from database values, never from client text.
//  - Tickets are re-checked in the database (must exist and still be available).
//  - The image is size-capped and checked to really be a PNG or JPEG.
//  - Per-IP and global rate limits (hashed IPs only) in telegram_post_log.

import { createClient } from "jsr:@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const MAX_TICKETS = 30;
const MAX_DATA_URL_CHARS = 3_000_000; // ~2.2 MB of image
const PER_IP_LIMIT = 10; // posts per IP ...
const PER_IP_WINDOW_MIN = 10; // ... per 10 minutes
const GLOBAL_LIMIT = 120; // posts per hour, all callers together

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHANNEL_RE = /^[A-Za-z0-9_]{5,32}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function decodeImage(input: unknown): { bytes: Uint8Array; mime: string; ext: string } | null {
  if (typeof input !== "string" || input.length > MAX_DATA_URL_CHARS) return null;
  const m = input.match(/^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return null;
  let bytes: Uint8Array;
  try {
    const bin = atob(m[1]);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return null;
  }
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (isPng) return { bytes, mime: "image/png", ext: "png" };
  if (isJpeg) return { bytes, mime: "image/jpeg", ext: "jpg" };
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, message: "Method not allowed." }, 405);

  // ---- 1. Read and shape-check the request ----
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, code: "bad_request", message: "Bad request." }, 400);
  }
  const ticketIds: string[] = Array.isArray(body?.ticket_ids) ? [...new Set(body.ticket_ids.map(String))] : [];
  if (ticketIds.length < 1 || ticketIds.length > MAX_TICKETS || !ticketIds.every((id) => UUID_RE.test(id))) {
    return json({ ok: false, code: "bad_request", message: "Choose between 1 and " + MAX_TICKETS + " numbers." }, 400);
  }
  const agentId: string | null = body?.agent_id ? String(body.agent_id) : null;
  if (agentId && !UUID_RE.test(agentId)) {
    return json({ ok: false, code: "bad_request", message: "Bad request." }, 400);
  }
  const image = decodeImage(body?.image);
  if (!image) {
    return json({ ok: false, code: "bad_request", message: "The photo couldn't be read. Please try again." }, 400);
  }

  // ---- 2. Rate limits (hashed IP only) ----
  const ip =
    req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const ipHash = await sha256Hex("ov-telegram-post:" + ip);
  const now = Date.now();
  await supabase.from("telegram_post_log").delete().lt("created_at", new Date(now - 24 * 3600 * 1000).toISOString());
  // Record this request FIRST, then count (including it). Counting first and
  // recording afterwards would let a burst of parallel requests all slip under the limit.
  await supabase.from("telegram_post_log").insert({ ip_hash: ipHash });
  const { count: ipCount } = await supabase
    .from("telegram_post_log")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gt("created_at", new Date(now - PER_IP_WINDOW_MIN * 60 * 1000).toISOString());
  const { count: globalCount } = await supabase
    .from("telegram_post_log")
    .select("id", { count: "exact", head: true })
    .gt("created_at", new Date(now - 3600 * 1000).toISOString());
  if ((ipCount ?? 0) > PER_IP_LIMIT || (globalCount ?? 0) > GLOBAL_LIMIT) {
    return json({ ok: false, code: "rate_limited", message: "Too many requests right now. Please try again in a few minutes." }, 429);
  }

  // ---- 3. Re-check the tickets in the database ----
  const { data: tickets, error: ticketError } = await supabase
    .from("tickets")
    .select("id, number, status")
    .in("id", ticketIds);
  if (ticketError) {
    console.error("ticket lookup failed", ticketError.message);
    return json({ ok: false, code: "server_error", message: "Something went wrong. Please try again." }, 500);
  }
  const byId = new Map((tickets || []).map((t: any) => [t.id, t]));
  const bad = ticketIds.filter((id) => !byId.has(id) || byId.get(id).status !== "available");
  if (bad.length > 0) {
    const nums = bad.map((id) => byId.get(id)?.number).filter(Boolean);
    return json(
      {
        ok: false,
        code: "unavailable",
        message: nums.length
          ? "No longer available: " + nums.join(", ") + ". Please remove them from your cart."
          : "Some of these numbers are no longer available.",
      },
      409,
    );
  }
  const numbers = ticketIds.map((id) => byId.get(id).number);

  // ---- 4. Shop name (agent shops only), looked up here, never trusted from the client ----
  let shopName: string | null = null;
  if (agentId) {
    const { data: agent } = await supabase.from("agents").select("name, active").eq("id", agentId).maybeSingle();
    if (!agent || !agent.active) {
      return json({ ok: false, code: "bad_request", message: "Shop not found." }, 400);
    }
    shopName = String(agent.name).slice(0, 60);
  }

  // ---- 5. Only now check the bot + channel are configured, then post ----
  const { data: channelRow } = await supabase.from("site_settings").select("value").eq("key", "telegram_channel").maybeSingle();
  const channel = String(channelRow?.value || "").trim().replace(/^@/, "");
  if (!BOT_TOKEN || !CHANNEL_RE.test(channel)) {
    return json({ ok: false, code: "not_configured", message: "Telegram ordering isn't set up yet." }, 503);
  }

  const lines = ["I want to buy this", "", "Numbers: " + numbers.join(", ")];
  if (shopName) lines.push("Shop: " + shopName);
  const caption = lines.join("\n");

  const form = new FormData();
  form.append("chat_id", "@" + channel);
  form.append("caption", caption);
  form.append("photo", new Blob([image.bytes as BlobPart], { type: image.mime }), "numbers." + image.ext);

  let out: any = null;
  let res: Response;
  try {
    res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: "POST", body: form });
    out = await res.json().catch(() => null);
  } catch (e) {
    console.error("sendPhoto network error", (e as Error).message);
    return json({ ok: false, code: "telegram_error", message: "Couldn't reach Telegram. Please try again." }, 502);
  }
  if (!res.ok || !out?.ok) {
    console.error("sendPhoto failed", res.status, out?.description);
    return json({ ok: false, code: "telegram_error", message: "Couldn't post to Telegram. Please try again in a moment." }, 502);
  }

  const messageId = out?.result?.message_id;
  return json({
    ok: true,
    channel_url: "https://t.me/" + channel,
    post_url: messageId ? "https://t.me/" + channel + "/" + messageId : "https://t.me/" + channel,
  });
});
