import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { t, useLang } from "../lib/i18n";
import { useCart } from "../lib/CartContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import DigitSearch from "../components/DigitSearch";
import DrawBanner from "../components/DrawBanner";
import TicketResults from "../components/TicketResults";
import CartDrawer from "../components/CartDrawer";

export default function Storefront() {
  const [lang, setLang] = useLang();
  const [tickets, setTickets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [draw, setDraw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [digits, setDigits] = useState([]);
  const [anywhere, setAnywhere] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { cart } = useCart();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const [ticketsRes, groupsRes, drawRes] = await Promise.all([
          supabase.from("tickets").select("*").order("number"),
          supabase.from("groups").select("*").order("sort_order"),
          supabase
            .from("draws")
            .select("*")
            .eq("published", true)
            .order("draw_date", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (ticketsRes.error) throw ticketsRes.error;
        if (groupsRes.error) throw groupsRes.error;
        if (drawRes.error) throw drawRes.error;
        if (cancelled) return;
        setTickets(ticketsRes.data || []);
        setGroups(groupsRes.data || []);
        setDraw(drawRes.data || null);
        const maxLen = Math.max(4, ...(ticketsRes.data || []).map((tk) => tk.number.length));
        setDigits(Array(maxLen).fill(""));
      } catch (e) {
        if (!cancelled) setLoadError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const digitLength = digits.length || 4;
  const availableCount = useMemo(() => tickets.filter((tk) => tk.status === "available").length, [tickets]);
  const matchCount = useMemo(() => {
    const filled = digits.filter(Boolean).length;
    if (!filled) return null;
    return tickets.filter((tk) => tk.status === "available").length;
  }, [tickets, digits]);
  const resultSummary = digits.filter(Boolean).length
    ? `${matchCount} match${matchCount === 1 ? "" : "es"}`
    : "All tickets shown";

  function clearSearch() {
    setDigits(Array(digitLength).fill(""));
  }

  if (loading) {
    return (
      <div className="ov-page" style={{ padding: 60, textAlign: "center", color: "#5A6560" }}>
        {t(lang, "loadingTickets")}
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="ov-page" style={{ padding: 60, textAlign: "center", color: "#5A6560" }}>
        <div style={{ fontWeight: 700, color: "#B23A2E", marginBottom: 8 }}>{t(lang, "couldntLoadStorefront")}</div>
        <div style={{ fontSize: 13 }}>{loadError}</div>
      </div>
    );
  }

  return (
    <div className="ov-page">
      <header className="ov-header">
        <div className="ov-brand">
          <div className="ov-brand-badge">88</div>
          <div className="ov-brand-name">Oracle Vault</div>
        </div>
        <LanguageSwitcher lang={lang} onChange={setLang} />
        <Link to="/my-tickets" className="ov-nav-link">
          {t(lang, "myTickets")}
        </Link>
        <button className="ov-nav-link primary" onClick={() => setCartOpen(true)}>
          {t(lang, "cartCount", { n: cart.length })}
        </button>
      </header>

      <section className="ov-hero-section" id="top">
        <div className="ov-hero-inner">
          <div className="ov-hero-grid">
            <div className="ov-hero" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="ov-next-draw-pill">
                {draw ? t(lang, "nextDraw", { date: draw.label }) : t(lang, "noDrawPublished")}
              </div>
              <h1>{t(lang, "searchTicketsHeading", { n: availableCount })}</h1>
              <p>{t(lang, "searchTicketsSub")}</p>
            </div>
            <DigitSearch
              lang={lang}
              length={digitLength}
              digits={digits}
              setDigits={setDigits}
              anywhere={anywhere}
              setAnywhere={setAnywhere}
              resultSummary={resultSummary}
            />
          </div>
          <DrawBanner lang={lang} draw={draw} />
        </div>
      </section>

      <TicketResults
        lang={lang}
        tickets={tickets}
        groups={groups}
        digits={digits}
        anywhere={anywhere}
        onClearSearch={clearSearch}
      />

      <footer className="ov-footer">
        <div className="ov-footer-inner">
          <span>{t(lang, "footerNotice")}</span>
          <div className="ov-footer-links">
            <a href="#/login">{t(lang, "login")}</a>
            <a href="#top" className="primary">
              {t(lang, "backToTop")}
            </a>
          </div>
        </div>
      </footer>

      {cart.length > 0 && !cartOpen && (
        <button className="ov-cart-fab" onClick={() => setCartOpen(true)}>
          {t(lang, "cartCount", { n: cart.length })}
        </button>
      )}

      <CartDrawer lang={lang} open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
