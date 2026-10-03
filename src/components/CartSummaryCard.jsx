import { useRef, useState } from "react";
import { saveButtonLabel, usePreparedPhoto } from "../lib/usePreparedPhoto";
import { t } from "../lib/i18n";
import { getCurrencySymbol, getSiteSetting, useSiteSettingsVersion } from "../lib/siteSettingsStore";
import BrandBadge from "./BrandBadge";

export default function CartSummaryCard({ lang, cart, total, phone, name, onClose, currencyOverride, shopName, canHidePrice }) {
  const cardRef = useRef(null);
  // Admin/agents can hide each ticket's price and the total before saving.
  const [hidePrice, setHidePrice] = useState(false);
  // Frozen when the card opens, so the photo doesn't change every second.
  const [createdAt] = useState(() => new Date().toLocaleString());
  useSiteSettingsVersion();
  const currency = currencyOverride || getCurrencySymbol();
  const [filename] = useState(() => `oracle-vault-order-${Date.now()}.png`);
  const photo = usePreparedPhoto(cardRef, filename);

  function saveAsPhoto() {
    photo.save({ title: shopName || "Oracle Vault", text: "My order" });
  }

  return (
    <div className="ov-summary-overlay" onClick={onClose}>
      <div className="ov-summary-wrap" onClick={(e) => e.stopPropagation()}>
        <div className="ov-summary-card ov-print-target" ref={cardRef}>
          <div className="ov-summary-header">
            <BrandBadge size={32} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{shopName || "Oracle Vault"}</div>
              <div style={{ fontSize: 11, color: "#5A6560" }}>{createdAt}</div>
            </div>
          </div>

          <div className="ov-summary-divider" />

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cart.map((tk) => (
              <div key={tk.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>{tk.number}</span>
                {!hidePrice && <span>{currency}{Number(tk.price || 0).toLocaleString()}</span>}
              </div>
            ))}
          </div>

          {!hidePrice && (
            <>
              <div className="ov-summary-divider" />
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}>
                <span>{t(lang, "total")}</span>
                <span style={{ fontFamily: "'Space Mono', monospace" }}>{currency}{total.toLocaleString()}</span>
              </div>
            </>
          )}

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

        {photo.status === "error" && (
          <p style={{ color: "#B23A2E", fontSize: 12, marginTop: 8, textAlign: "center" }}>Couldn't save the image — try again.</p>
        )}

        {canHidePrice && (
          <label className="ov-photo-option">
            <input type="checkbox" checked={hidePrice} onChange={(e) => setHidePrice(e.target.checked)} />
            <span>Hide price</span>
          </label>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="ov-btn-sm" style={{ flex: 1 }} onClick={() => window.print()}>
            Print receipt
          </button>
          <button className="ov-btn-sm primary" style={{ flex: 1 }} onClick={saveAsPhoto} disabled={photo.status === "saving"}>
            {saveButtonLabel(photo.status)}
          </button>
        </div>
      </div>
    </div>
  );
}
