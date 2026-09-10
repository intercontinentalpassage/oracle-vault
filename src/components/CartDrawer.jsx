import { useState } from "react";
import { t } from "../lib/i18n";
import { useCart } from "../lib/CartContext";
import { supabase } from "../lib/supabaseClient";
import { getCurrencySymbol, useSiteSettingsVersion } from "../lib/siteSettingsStore";
import CartSummaryCard from "./CartSummaryCard";

export default function CartDrawer({ lang, open, onClose, agentId }) {
  const { cart, remove, clear } = useCart();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  useSiteSettingsVersion();
  const currency = getCurrencySymbol();

  if (!open) return null;

  const total = cart.reduce((sum, tk) => sum + (Number(tk.price) || 0), 0);

  async function submit() {
    const cleanPhone = phone.trim();
    if (!/^\d{6,}$/.test(cleanPhone.replace(/\s|-/g, ""))) {
      setError(t(lang, "enterValidPhone"));
      return;
    }
    setError("");
    setSending(true);
    try {
      const { error: insertError } = await supabase.from("purchase_requests").insert({
        customer_phone: cleanPhone,
        customer_name: name.trim() || null,
        ticket_ids: cart.map((tk) => tk.id),
        total,
        agent_id: agentId || null,
      });
      if (insertError) throw insertError;
      setSent(true);
      clear();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ov-cart-overlay" onClick={onClose}>
      <div className="ov-cart-panel" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t(lang, "yourCart")}</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {cart.length > 0 && !sent && (
              <button className="ov-link-btn" style={{ color: "#B23A2E" }} onClick={clear}>
                {t(lang, "removeAll")}
              </button>
            )}
            <button
              className="ov-link-btn"
              aria-label={t(lang, "closeCart")}
              onClick={onClose}
              style={{ fontSize: 22, lineHeight: 1, color: "#5A6560" }}
            >
              ×
            </button>
          </div>
        </div>

        {sent ? (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontWeight: 700 }}>{t(lang, "requestSent")}</p>
            <p style={{ color: "#5A6560", fontSize: 14 }}>{t(lang, "requestSentDetailCustomer")}</p>
            <button className="ov-btn-primary" style={{ marginTop: 16, width: "100%" }} onClick={onClose}>
              {t(lang, "done")}
            </button>
          </div>
        ) : cart.length === 0 ? (
          <p style={{ color: "#5A6560", marginTop: 24 }}>{t(lang, "cartEmpty")}</p>
        ) : (
          <>
            <div style={{ marginTop: 16, flex: 1 }}>
              {cart.map((tk) => (
                <div className="ov-cart-item" key={tk.id}>
                  <span style={{ fontFamily: "'Space Mono', monospace" }}>{tk.number}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span>{currency}{Number(tk.price || 0).toLocaleString()}</span>
                    <button className="ov-link-btn" style={{ color: "#B23A2E" }} onClick={() => remove(tk.id)}>
                      {t(lang, "remove")}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 15,
                fontWeight: 700,
                marginTop: 12,
              }}
            >
              <span>{t(lang, "total")}</span>
              <span style={{ fontFamily: "'Space Mono', monospace" }}>{currency}{total.toLocaleString()}</span>
            </div>

            <button
              className="ov-link-btn"
              style={{ marginTop: 8, alignSelf: "flex-start", color: "#0F7A63", fontWeight: 700 }}
              onClick={() => setShowSummary(true)}
            >
              View summary
            </button>

            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                {t(lang, "placeholderPhone")}
                <input
                  className="ov-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t(lang, "placeholderPhone")}
                  inputMode="tel"
                />
              </label>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginTop: 10 }}>
                {t(lang, "placeholderName")}
                <input
                  className="ov-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t(lang, "placeholderName")}
                />
              </label>
              {error && <p style={{ color: "#B23A2E", fontSize: 13, marginTop: 8 }}>{error}</p>}
              <button
                className="ov-btn-primary"
                style={{ width: "100%", marginTop: 14 }}
                disabled={sending}
                onClick={submit}
              >
                {sending ? t(lang, "sending") : t(lang, "requestPurchase")}
              </button>
            </div>
          </>
        )}

        {showSummary && (
          <CartSummaryCard
            lang={lang}
            cart={cart}
            total={total}
            phone={phone}
            name={name}
            onClose={() => setShowSummary(false)}
          />
        )}
      </div>
    </div>
  );
}
