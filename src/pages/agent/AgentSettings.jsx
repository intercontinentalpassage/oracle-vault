import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getCurrencySymbol } from "../../lib/siteSettingsStore";
import { compressImage } from "../../lib/imageCompress";
import ChangePassword from "../../components/ChangePassword";
import { normalizeTelegram } from "../../lib/telegram";

export default function AgentSettings() {
  const { agentId } = useOutletContext();
  const [agent, setAgent] = useState(null);
  const [name, setName] = useState("");
  const [yourName, setYourName] = useState("");
  const [savedYourName, setSavedYourName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [telegram, setTelegram] = useState("");
  const [heroUrl, setHeroUrl] = useState("");
  const [currency, setCurrency] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  async function loadAgent() {
    const { data } = await supabase.from("agents").select("*").eq("id", agentId).single();
    if (data) {
      setAgent(data);
      setName(data.name || "");
      setPhone(data.phone || "");
      setEmail(data.email || "");
      setTelegram(data.telegram ? `@${data.telegram}` : "");
      setHeroUrl(data.hero_image_url || "");
      setCurrency(data.currency_symbol || "");
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (userId) {
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
      setYourName(prof?.display_name || "");
      setSavedYourName(prof?.display_name || "");
    }
  }

  useEffect(() => {
    loadAgent();
  }, [agentId]);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    const tg = normalizeTelegram(telegram);
    if (tg === null) {
      setSaving(false);
      setError("Enter your Telegram username, like @yourname (5 to 32 letters, numbers or underscores).");
      return;
    }
    const { error: updateError } = await supabase
      .from("agents")
      .update({
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        telegram: tg || null,
        hero_image_url: heroUrl.trim() || null,
        currency_symbol: currency.trim() || null,
      })
      .eq("id", agentId);
    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }
    // Agents can't write to profiles directly (that table also holds roles), so
    // the name goes through a database function that only changes display_name.
    if (yourName.trim() !== savedYourName) {
      const { data: newName, error: nameError } = await supabase.rpc("update_my_display_name", { p_name: yourName });
      if (nameError) {
        setSaving(false);
        setError(nameError.message);
        return;
      }
      setSavedYourName(newName || "");
      setYourName(newName || "");
    }
    setTelegram(tg ? `@${tg}` : "");
    setSaving(false);
    setSaved(true);
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const { blob, format } = await compressImage(file, { maxDimension: 1200, quality: 0.8 });
      const path = format === "image/webp" ? `${agentId}/hero.webp` : `${agentId}/hero.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("agent-hero")
        .upload(path, blob, { upsert: true, cacheControl: "3600", contentType: format });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from("agent-hero").getPublicUrl(path);
      // Cache-bust so the new image shows immediately even though the URL
      // itself doesn't change on re-upload.
      const bustedUrl = `${pub.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("agents")
        .update({ hero_image_url: bustedUrl })
        .eq("id", agentId);
      if (updateError) throw updateError;

      setHeroUrl(bustedUrl);
      setSaved(true);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/#/shop/${agent.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can fail (permissions, non-secure context) — the
      // link is still shown as selectable text below either way.
    }
  }

  if (!agent) return <p style={{ color: "#5A6560" }}>Loading…</p>;

  const shopUrl = `${window.location.origin}/#/shop/${agent.slug}`;

  return (
    <div>
      <h1>Shop settings</h1>

      <div className="ov-card" style={{ maxWidth: 480, marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Your shop link</strong>
        <p style={{ fontSize: 12, color: "#5A6560", margin: "4px 0 10px" }}>
          Share this with customers — it shows only your assigned tickets. Your slug (the part after "/shop/") also
          works as your agent code — customers can enter it (or your contact email below) when requesting a
          purchase on the main site to credit it to you.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="ov-input" style={{ margin: 0, flex: 1 }} value={shopUrl} readOnly onFocus={(e) => e.target.select()} />
          <button className="ov-btn-sm primary" onClick={copyLink}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="ov-card" style={{ maxWidth: 480, marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Currency</strong>
        <p style={{ fontSize: 12, color: "#5A6560", margin: "4px 0 10px" }}>
          Shown on your shop page and in your own catalog/sales — independent of the main site's currency. Leave
          blank to just use the site default ({getCurrencySymbol()}).
        </p>
        <input
          className="ov-input"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          placeholder={getCurrencySymbol()}
          maxLength={5}
          style={{ maxWidth: 120 }}
        />
        <div>
          <button
            className="ov-btn-sm primary"
            onClick={save}
            disabled={saving}
            style={{ marginTop: 12, width: 90, display: "inline-block", textAlign: "center" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <div style={{ minHeight: 21, marginTop: 8 }}>
            {error && <p style={{ color: "#B23A2E", fontSize: 13, margin: 0 }}>{error}</p>}
            {saved && <p style={{ color: "#0B5C4A", fontSize: 13, margin: 0 }}>Saved.</p>}
          </div>
        </div>
      </div>

      <div className="ov-card" style={{ maxWidth: 480 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#5A6560" }}>
          Your name
          <input
            className="ov-input"
            value={yourName}
            maxLength={60}
            placeholder="e.g. Sai"
            onChange={(e) => setYourName(e.target.value)}
          />
        </label>
        <p style={{ fontSize: 11, color: "#5A6560", margin: "4px 0 0" }}>
          Shown in the menu at the top of the storefront, for example "Sai's Setting". Leave blank to show "My Setting".
        </p>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#5A6560", display: "block", marginTop: 12 }}>
          Shop name
          <input className="ov-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#5A6560", display: "block", marginTop: 12 }}>
          Phone
          <input className="ov-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#5A6560", display: "block", marginTop: 12 }}>
          Contact email
          <input className="ov-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#5A6560", display: "block", marginTop: 12 }}>
          Telegram
          <input
            className="ov-input"
            value={telegram}
            maxLength={80}
            placeholder="@yourname"
            onChange={(e) => setTelegram(e.target.value)}
          />
        </label>
        <p style={{ fontSize: 11, color: "#5A6560", margin: "4px 0 0" }}>
          Your own Telegram username. It shows as a Telegram button on your shop page so customers can message you.
          Leave blank to hide the button.
        </p>

        <div style={{ marginTop: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#5A6560" }}>Hero image</span>
          {heroUrl && (
            <img
              src={heroUrl}
              alt="Hero preview"
              style={{ marginTop: 8, width: "100%", borderRadius: 10, maxHeight: 140, objectFit: "cover" }}
              onError={(e) => (e.target.style.display = "none")}
            />
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <button
              className="ov-btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload photo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div style={{ minHeight: 21, marginTop: 8 }}>
          {error && <p style={{ color: "#B23A2E", fontSize: 13, margin: 0 }}>{error}</p>}
          {saved && <p style={{ color: "#0B5C4A", fontSize: 13, margin: 0 }}>Saved.</p>}
        </div>
        <button
          className="ov-btn-sm primary"
          onClick={save}
          disabled={saving}
          style={{ marginTop: 12, width: 90, display: "inline-block", textAlign: "center" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <ChangePassword />
    </div>
  );
}
