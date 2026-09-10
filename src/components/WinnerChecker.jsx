import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getCurrencySymbol, useSiteSettingsVersion } from "../lib/siteSettingsStore";

function TicketIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M14 6v12" stroke="currentColor" strokeWidth="1.8" strokeDasharray="2.5 2.5" />
    </svg>
  );
}

function matchWinner(number, draw) {
  const tiers = draw?.tiers || [];
  for (const tier of tiers) {
    if ((tier.numbers || []).includes(number)) return tier;
  }
  return null;
}

const DIGIT_COUNT = 6;
const emptyDigits = () => Array(DIGIT_COUNT).fill("");

export default function WinnerChecker() {
  const [open, setOpen] = useState(false);
  const [digits, setDigits] = useState(emptyDigits);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(undefined); // undefined = not checked yet, null = no draw, {} = win, false = no win
  useSiteSettingsVersion();
  const currency = getCurrencySymbol();

  function updateDigit(i, value) {
    const clean = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    setResult(undefined);
    setError("");
    if (clean && i < DIGIT_COUNT - 1) {
      document.getElementById(`wc-digit-${i + 1}`)?.focus();
    }
  }

  function handleKeyDown(i, e) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      document.getElementById(`wc-digit-${i - 1}`)?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      document.getElementById(`wc-digit-${i - 1}`)?.focus();
    } else if (e.key === "ArrowRight" && i < DIGIT_COUNT - 1) {
      document.getElementById(`wc-digit-${i + 1}`)?.focus();
    } else if (e.key === "Enter") {
      check();
    }
  }

  async function check() {
    const clean = digits.join("");
    if (clean.length !== DIGIT_COUNT || digits.some((d) => !d)) {
      setError(`Enter all ${DIGIT_COUNT} digits of your ticket number.`);
      return;
    }
    setError("");
    setChecking(true);
    setResult(undefined);
    try {
      const { data: draw } = await supabase
        .from("draws")
        .select("*")
        .eq("published", true)
        .order("draw_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!draw) {
        setResult(null);
        return;
      }
      const tier = matchWinner(clean, draw);
      setResult(tier ? { tier, drawLabel: draw.label } : false);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setChecking(false);
    }
  }

  function close() {
    setOpen(false);
    setDigits(emptyDigits());
    setResult(undefined);
    setError("");
  }

  return (
    <>
      <button className="ov-winner-fab" onClick={() => setOpen(true)} aria-label="Check if you won">
        <TicketIcon />
      </button>

      {open && (
        <div className="ov-summary-overlay" onClick={close} style={{ position: "fixed" }}>
          <div className="ov-summary-wrap" onClick={(e) => e.stopPropagation()}>
            <div className="ov-summary-card">
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Check your number</div>
              <p style={{ fontSize: 13, color: "#5A6560", marginTop: 0, marginBottom: 14 }}>
                Enter your ticket number to see if it won this round.
              </p>

              <div className="ov-digit-boxes">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    id={`wc-digit-${i}`}
                    className="ov-digit-input"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => updateDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
              {error && <p style={{ color: "#B23A2E", fontSize: 13, marginTop: 8 }}>{error}</p>}

              {result === null && (
                <p style={{ marginTop: 14, fontSize: 14, color: "#5A6560" }}>
                  No draw results have been published yet.
                </p>
              )}
              {result === false && (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#F4F8F6" }}>
                  <p style={{ margin: 0, fontWeight: 700 }}>Not a winner this round</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#5A6560" }}>Better luck next time!</p>
                </div>
              )}
              {result && result !== false && (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#E6F4EF" }}>
                  <p style={{ margin: 0, fontWeight: 700, color: "#0B5C4A" }}>You won!</p>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#0B5C4A" }}>
                    {result.tier.label} · {currency}{result.tier.prize} — {result.drawLabel}
                  </p>
                </div>
              )}

              <button className="ov-btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={check} disabled={checking}>
                {checking ? "Checking…" : "Check"}
              </button>
              <button className="ov-btn-sm" style={{ width: "100%", marginTop: 8 }} onClick={close}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
