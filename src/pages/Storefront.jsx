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
import WinnerChecker from "../components/WinnerChecker";
import BrandBadge from "../components/BrandBadge";
import { matchesDigits } from "../lib/ticketMatch";

export default function Storefront() {
  const [lang, setLang] = useLang();
  const [tickets, setTickets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [resultsDraw, setResultsDraw] = useState(null); // latest published results, shown in the numbers banner
  const [nextDraw, setNextDraw] = useState(null); // the draw current available tickets are for
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
        const [ticketsRes, groupsRes, resultsDrawRes, allDrawsRes] = await Promise.all([
          supabase.from("tickets").select("*").is("agent_id", null).order("number"),
          supabase.from("groups").select("*").order("sort_order"),
          supabase
            .from("draws")
            .select("*")
            .eq("published", true)
            .order("draw_date", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from("draws").select("*"),
        ]);
        if (ticketsRes.error) throw ticketsRes.error;
        if (groupsRes.error) throw groupsRes.error;
        if (resultsDrawRes.error) throw resultsDrawRes.error;
        if (cancelled) return;

        const ticketsData = ticketsRes.data || [];
        setGroups(groupsRes.data || []);
        setResultsDraw(resultsDrawRes.data || null);

        // "Next draw" reads from whichever draw the currently-available
        // tickets were entered under (set in Admin when adding tickets),
        // not from published results — those are for a draw that already
        // happened. Tickets tied to a draw whose date has already passed
        // are treated as expired and hidden from the storefront entirely.
        // All draws were already fetched above in the same batch, so this
        // is computed locally — no extra network round-trip.
        const today = new Date().toISOString().slice(0, 10);
        const byId = {};
        (allDrawsRes.data || []).forEach((d) => (byId[d.id] = d));
        const referencedDrawIds = new Set(
          ticketsData.filter((tk) => tk.status === "available" && tk.draw_id).map((tk) => tk.draw_id)
        );
        const upcoming = (allDrawsRes.data || [])
          .filter((d) => referencedDrawIds.has(d.id) && d.draw_date >= today)
          .sort((a, b) => (a.draw_date < b.draw_date ? -1 : 1));
        setNextDraw(upcoming[0] || null);
        const visibleTickets = ticketsData.filter((tk) => {
          if (!tk.draw_id) return true;
          const d = byId[tk.draw_id];
          return !d || d.draw_date >= today;
        });
        setTickets(visibleTickets);
        const maxLen = Math.max(4, ...visibleTickets.map((tk) => tk.number.length));
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
    return tickets.filter((tk) => tk.status === "available" && matchesDigits(tk.number, digits, anywhere)).length;
  }, [tickets, digits, anywhere]);
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
          <BrandBadge />
          <div className="ov-brand-name">Oracle Vault</div>
        </div>
        <LanguageSwitcher lang={lang} onChange={setLang} />
        <Link to="/my-tickets" className="ov-nav-link">
          {t(lang, "myTickets")}
        </Link>
        <a
          href="https://t.me/oracle_vault_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="ov-nav-link ov-telegram-link"
          aria-label={t(lang, "telegram")}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path d="M21.94 4.6 18.6 20.24c-.25 1.12-.9 1.4-1.83.87l-5.06-3.73-2.44 2.35c-.27.27-.5.5-1.02.5l.36-5.16 9.4-8.5c.41-.36-.09-.56-.63-.2L6.1 13.47l-5.02-1.57c-1.09-.34-1.11-1.09.23-1.62L20.6 3.24c.91-.34 1.7.22 1.34 1.36Z" />
          </svg>
          {t(lang, "telegram")}
        </a>
        <button className="ov-nav-link primary" onClick={() => setCartOpen(true)}>
          {t(lang, "cartCount", { n: cart.length })}
        </button>
      </header>

      <section className="ov-hero-section" id="top">
        <div className="ov-hero-inner">
          <div className="ov-hero-grid">
            <div className="ov-hero" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {nextDraw && <div className="ov-next-draw-pill">{t(lang, "nextDraw", { date: nextDraw.label })}</div>}
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
          <DrawBanner lang={lang} draw={resultsDraw} />
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
            <button
              type="button"
              className="primary ov-link-button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              {t(lang, "backToTop")}
            </button>
          </div>
        </div>
      </footer>

      {cart.length > 0 && !cartOpen && (
        <button className="ov-cart-fab" onClick={() => setCartOpen(true)}>
          {t(lang, "cartCount", { n: cart.length })}
        </button>
      )}

      <CartDrawer lang={lang} open={cartOpen} onClose={() => setCartOpen(false)} />
      <WinnerChecker />
    </div>
  );
}
