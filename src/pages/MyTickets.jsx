import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { t, useLang } from "../lib/i18n";
import { getCurrencySymbol, useSiteSettingsVersion } from "../lib/siteSettingsStore";
import LanguageSwitcher from "../components/LanguageSwitcher";

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
      </div>
    </div>
  );
}
