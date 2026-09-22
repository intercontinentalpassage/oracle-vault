import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { savePhoto } from "../lib/savePhoto";
import { t } from "../lib/i18n";
import { getCurrencySymbol, getSiteSetting, useSiteSettingsVersion } from "../lib/siteSettingsStore";
import BrandBadge from "./BrandBadge";

export default function CartSummaryCard({ lang, cart, total, phone, name, onClose, currencyOverride, shopName }) {
  const cardRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useSiteSettingsVersion();
  const currency = currencyOverride || getCurrencySymbol();

  async function saveAsPhoto() {
    if (!cardRef.current) return;
    setSaving(true);
    setError("");
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, backgroundColor: "#FFFFFF" });
      await savePhoto(dataUrl, `oracle-vault-order-${Date.now()}.png`, {
        title: shopName || "Oracle Vault",
        text: "My order",
      });
    } catch (e) {
      setError("Couldn't save the image — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ov-summary-overlay" onClick={onClose}>
      <div className="ov-summary-wrap" onClick={(e) => e.stopPropagation()}>
        <div className="ov-summary-card ov-print-target" ref={cardRef}>
          <div className="ov-summary-header">
            <BrandBadge size={32} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{shopName || "Oracle Vault"}</div>
              <div style={{ fontSize: 11, color: "#5A6560" }}>{new Date().toLocaleString()}</div>
            </div>
          </div>

          <div className="ov-summary-divider" />

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cart.map((tk) => (
              <div key={tk.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>{tk.number}</span>
                <span>{currency}{Number(tk.price || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="ov-summary-divider" />

          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}>
            <span>{t(lang, "total")}</span>
            <span style={{ fontFamily: "'Space Mono', monospace" }}>{currency}{total.toLocaleString()}</span>
          </div>

          {(name || phone) && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#5A6560" }}>
              {name && <div>{name}</div>}
              {phone && <div>{phone}</div>}
            </div>
          )}

          <div className="ov-summary-divider" />
          <p style={{ textAlign: "center", fontSize: 12, color: "#5A6560", margin: 0 }}>
            {getSiteSetting("invoice_thank_you") || "Thank you for your purchase!"}
          </p>
        </div>

        {error && <p style={{ color: "#B23A2E", fontSize: 12, marginTop: 8, textAlign: "center" }}>{error}</p>}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="ov-btn-sm" style={{ flex: 1 }} onClick={() => window.print()}>
            Print receipt
          </button>
          <button className="ov-btn-sm primary" style={{ flex: 1 }} onClick={saveAsPhoto} disabled={saving}>
            {saving ? "Saving…" : "Save as photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
