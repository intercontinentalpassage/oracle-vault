import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toPng } from "html-to-image";
import { supabase } from "../lib/supabaseClient";
import { t, useLang } from "../lib/i18n";
import { getCurrencySymbol, getSiteSetting, useSiteSettingsVersion } from "../lib/siteSettingsStore";
import LanguageSwitcher from "../components/LanguageSwitcher";
import BrandBadge from "../components/BrandBadge";

function statusLabel(lang, status) {
  if (status === "confirmed") return t(lang, "statusPurchased");
  if (status === "pending") return t(lang, "statusPending");
  if (status === "rejected") return t(lang, "statusRejected");
  return status;
}

export default function MyTickets() {
  const [lang, setLang] = useLang();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  useSiteSettingsVersion();
  const currency = getCurrencySymbol();
  const [showInvoice, setShowInvoice] = useState(false);
  const invoiceRef = useRef(null);
  const [savingInvoice, setSavingInvoice] = useState(false);

  async function saveInvoiceAsPhoto() {
    if (!invoiceRef.current) return;
    setSavingInvoice(true);
    try {
      const dataUrl = await toPng(invoiceRef.current, { pixelRatio: 2, backgroundColor: "#FFFFFF" });
      const link = document.createElement("a");
      link.download = `my-tickets-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError("Couldn't save the image — try again.");
    } finally {
      setSavingInvoice(false);
    }
  }

  const invoiceTotal = results.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

  async function lookup() {
    const cleanPhone = phone.trim();
    if (!cleanPhone) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("lookup_my_tickets", { p_phone: cleanPhone });
      if (rpcError) throw rpcError;
      setResults(data || []);
      setSearched(true);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ov-page" style={{ padding: "clamp(26px, 4vw, 56px) clamp(14px, 4vw, 48px)" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link to="/" style={{ fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            {t(lang, "backToStorefront")}
          </Link>
          <LanguageSwitcher lang={lang} onChange={setLang} />
        </div>

        <h1 style={{ fontSize: 22, marginTop: 20 }}>{t(lang, "myTickets")}</h1>
        <p style={{ color: "#5A6560", fontSize: 14 }}>{t(lang, "lookUpPurchases")}</p>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <input
            className="ov-input"
            style={{ marginTop: 0 }}
            placeholder={t(lang, "placeholderPhoneNumber")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
          <button className="ov-btn-primary" style={{ whiteSpace: "nowrap" }} onClick={lookup} disabled={loading}>
            {loading ? t(lang, "lookingUp") : t(lang, "lookUp")}
          </button>
        </div>

        {error && <p style={{ color: "#B23A2E", fontSize: 13, marginTop: 10 }}>{error}</p>}

        {searched && !loading && (
          results.length === 0 ? (
            <p style={{ color: "#5A6560", marginTop: 24 }}>{t(lang, "noPurchasesFound")}</p>
          ) : (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                {results[0]?.customer_name ? (
                  <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{results[0].customer_name}</p>
                ) : (
                  <span />
                )}
                <button className="ov-btn-sm primary" onClick={() => setShowInvoice(true)}>
                  View invoice
                </button>
              </div>
              {results.map((r) => (
                <div key={r.id} className="ov-cart-item">
                  <div>
                    <div style={{ fontFamily: "'Space Mono', monospace" }}>{r.ticket_number || "—"}</div>
                    <div style={{ fontSize: 12, color: "#5A6560" }}>
                      {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600 }}>{statusLabel(lang, r.status)}</div>
                    <div style={{ fontSize: 12, color: "#5A6560" }}>{currency}{Number(r.total || 0).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {showInvoice && (
          <div className="ov-summary-overlay" onClick={() => setShowInvoice(false)} style={{ position: "fixed" }}>
            <div className="ov-summary-wrap" onClick={(e) => e.stopPropagation()}>
              <div className="ov-summary-card" ref={invoiceRef}>
                <div className="ov-summary-header">
                  <BrandBadge size={32} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>Oracle Vault</div>
                    <div style={{ fontSize: 11, color: "#5A6560" }}>{new Date().toLocaleString()}</div>
                  </div>
                </div>

                {results[0]?.customer_name && (
                  <p style={{ fontSize: 13, color: "#5A6560", margin: "8px 0 0" }}>{results[0].customer_name}</p>
                )}

                <div className="ov-summary-divider" />

                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                  {results.map((r) => (
                    <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <span style={{ fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>
                        {r.ticket_number || "—"} <span style={{ fontSize: 11, color: "#5A6560" }}>({statusLabel(lang, r.status)})</span>
                      </span>
                      <span>{currency}{Number(r.total || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <div className="ov-summary-divider" />

                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}>
                  <span>{t(lang, "total")}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace" }}>{currency}{invoiceTotal.toLocaleString()}</span>
                </div>

                <div className="ov-summary-divider" />
                <p style={{ textAlign: "center", fontSize: 12, color: "#5A6560", margin: 0 }}>
                  {getSiteSetting("invoice_thank_you") || "Thank you for your purchase!"}
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="ov-btn-sm" style={{ flex: 1 }} onClick={() => setShowInvoice(false)}>
                  Close
                </button>
                <button className="ov-btn-sm primary" style={{ flex: 1 }} onClick={saveInvoiceAsPhoto} disabled={savingInvoice}>
                  {savingInvoice ? "Saving…" : "Save as photo"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
