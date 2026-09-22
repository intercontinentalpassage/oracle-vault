import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { savePhoto } from "../lib/savePhoto";
import { getSiteSetting, useSiteSettingsVersion } from "../lib/siteSettingsStore";
import BrandBadge from "./BrandBadge";

// Admin-only: a shareable flyer-style photo of every currently available
// number - no prices, no customer details. Meant for posting outside the
// site (Telegram, social) to show what's left to buy. Rendered on-screen in
// a preview overlay, then turned into a PNG with html-to-image, the same
// approach as the invoice/cart "Save as photo".
export default function AvailableNumbersPhotoCard({ numbers, onClose }) {
  const cardRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useSiteSettingsVersion();
  const channel = getSiteSetting("telegram_channel");
  const thankYou = getSiteSetting("invoice_thank_you") || "Thank you for your purchase!";

  async function saveAsPhoto() {
    if (!cardRef.current) return;
    setSaving(true);
    setError("");
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, backgroundColor: "#FFFFFF" });
      await savePhoto(dataUrl, `oracle-vault-available-numbers-${Date.now()}.png`, {
        title: "Oracle Vault",
        text: "Available numbers",
      });
    } catch (e) {
      setError("Couldn't save the image — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ov-summary-overlay" onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 560, animation: "ov-scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }} onClick={(e) => e.stopPropagation()}>
        <div
          ref={cardRef}
          style={{
            background: "#FFFFFF",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 12px 32px rgba(14,21,18,0.18)",
            fontFamily: "Sora, system-ui, sans-serif",
            color: "#0E1512",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BrandBadge size={36} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Oracle Vault</div>
              <div style={{ fontSize: 11, color: "#5A6560" }}>{new Date().toLocaleDateString()}</div>
            </div>
          </div>

          <div style={{ height: 1, background: "#EEF1EF", margin: "16px 0" }} />

          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {numbers.length} Number{numbers.length === 1 ? "" : "s"} Available
          </div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 8,
              padding: "6px 12px",
              borderRadius: 999,
              background: "#E6F4EF",
              color: "#0B5C4A",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Buy from our website{channel ? ` or via Telegram @${channel}` : " or via Telegram"}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))",
              gap: 8,
              marginTop: 18,
            }}
          >
            {numbers.map((n) => (
              <div
                key={n}
                style={{
                  textAlign: "center",
                  padding: "8px 4px",
                  borderRadius: 8,
                  background: "#E7EBE8",
                  border: "1px solid #D4DAD6",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                }}
              >
                {n}
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: "#EEF1EF", margin: "18px 0 12px" }} />
          <p style={{ textAlign: "center", fontSize: 12, color: "#5A6560", margin: 0 }}>{thankYou}</p>
        </div>

        {error && <p style={{ color: "#B23A2E", fontSize: 12, marginTop: 8, textAlign: "center" }}>{error}</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="ov-btn-sm" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button className="ov-btn-sm primary" style={{ flex: 1 }} onClick={saveAsPhoto} disabled={saving}>
            {saving ? "Saving…" : "Save as photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
