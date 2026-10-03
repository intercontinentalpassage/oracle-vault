import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { t, useLang } from "../lib/i18n";
import { useCart } from "../lib/CartContext";
import { useSessionProfile } from "../lib/useSessionProfile";
import LanguageSwitcher from "../components/LanguageSwitcher";
import StaffMenu from "../components/StaffMenu";
import TelegramIcon from "../components/TelegramIcon";
import DigitSearch from "../components/DigitSearch";
import DrawBanner from "../components/DrawBanner";
import TicketResults from "../components/TicketResults";
import CartDrawer from "../components/CartDrawer";
import WinnerChecker from "../components/WinnerChecker";
import BrandBadge from "../components/BrandBadge";
import AvailableNumbersPhotoCard from "../components/AvailableNumbersPhotoCard";
import { matchesDigits } from "../lib/ticketMatch";
import { useLiveTickets } from "../lib/useLiveTickets";
import { useCartGuard } from "../lib/useCartGuard";
import CartSoldNotice from "../components/CartSoldNotice";
import { visibleOnly } from "../lib/ticketVisibility";

export default function Storefront() {
  const [lang, setLang] = useLang();
  const { profile: staffProfile } = useSessionProfile();
  const [allTickets, setAllTickets] = useState([]); // every main-shop ticket, incl. past draws
  const [draws, setDraws] = useState([]);
  const [groups, setGroups] = useState([]);
  const [resultsDraw, setResultsDraw] = useState(null); // latest published results, shown in the numbers banner
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [digits, setDigits] = useState([]);
  const [anywhere, setAnywhere] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [showAvailablePhoto, setShowAvailablePhoto] = useState(false);
  const { cart } = useCart();
  const cartGuard = useCartGuard();
  const mountedRef = useRef(true);
  const loadSeqRef = useRef(0);

  // Loads everything the storefront shows. quiet = a background resync:
  // no loading screen, and on failure keep showing what we already have.
  const loadData = useCallback(async ({ quiet = false } = {}) => {
    const seq = ++loadSeqRef.current;
    if (!quiet) {
      setLoading(true);
      setLoadError("");
    }
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
      // Ignore a slower, older load that finishes after a newer one.
      if (!mountedRef.current || seq !== loadSeqRef.current) return;

      const ticketsData = ticketsRes.data || [];
      setAllTickets(ticketsData);
      setDraws(allDrawsRes.data || []);
      setGroups(groupsRes.data || []);
      setResultsDraw(resultsDrawRes.data || null);
      const maxLen = Math.max(6, ...visibleOnly(ticketsData, allDrawsRes.data || []).map((tk) => tk.number.length));
      // Keep whatever the customer has typed unless the number length changed.
      setDigits((prev) => (prev.length === maxLen ? prev : Array(maxLen).fill("")));
    } catch (e) {
      if (!quiet && mountedRef.current) setLoadError(e.message || String(e));
      if (quiet) throw e;
    } finally {
      if (!quiet && mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    return () => {
      mountedRef.current = false;
    };
  }, [loadData]);

  // "Next draw" reads from whichever draw the currently-available tickets
  // were entered under (set in Admin when adding tickets), not from
  // published results — those are for a draw that already happened.
  // Tickets tied to a draw whose date has already passed are treated as
  // expired and hidden from the storefront entirely. Both are worked out
  // here from the loaded data, so live updates keep them correct too.
  const { tickets, nextDraw } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const referencedDrawIds = new Set(
      allTickets.filter((tk) => tk.status === "available" && tk.draw_id).map((tk) => tk.draw_id)
    );
    const upcoming = draws
      .filter((d) => referencedDrawIds.has(d.id) && d.draw_date >= today)
      .sort((a, b) => (a.draw_date < b.draw_date ? -1 : 1));
    return { tickets: visibleOnly(allTickets, draws), nextDraw: upcoming[0] || null };
  }, [allTickets, draws]);

  useLiveTickets({
    channelName: "storefront-tickets",
    enabled: !loading && !loadError,
    belongsHere: (row) => row.agent_id == null,
    setTickets: setAllTickets,
    resync: async () => {
      await loadData({ quiet: true });
      await cartGuard.recheck();
    },
    onGone: cartGuard.dropIds,
    shouldResync: (row) => row.draw_id && !draws.some((d) => d.id === row.draw_id),
  });

  const digitLength = digits.length || 6;
  const availableCount = useMemo(() => tickets.filter((tk) => tk.status === "available").length, [tickets]);
  const matchCount = useMemo(() => {
    const filled = digits.filter(Boolean).length;
    if (!filled) return null;
    return tickets.filter((tk) => tk.status === "available" && matchesDigits(tk.number, digits, anywhere)).length;
  }, [tickets, digits, anywhere]);
  const resultSummary = digits.filter(Boolean).length
    ? `${matchCount} match${matchCount === 1 ? "" : "es"}`
    : "All tickets shown";

  // Called by the cart after staff complete a Sell: mark those tickets sold
  // in this page's own copy of the list so they disappear immediately.
  function markSoldLocally(ids) {
    const sold = new Set(ids);
    setAllTickets((prev) => prev.map((tk) => (sold.has(tk.id) ? { ...tk, status: "sold" } : tk)));
  }

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
        {staffProfile?.role === "admin" && <StaffMenu label="Admin setting" settingsTo="/admin" />}
        {staffProfile?.role === "agent" && (
          <StaffMenu
            label={staffProfile.display_name ? `${staffProfile.display_name}'s Setting` : "My Setting"}
            settingsTo="/agent"
          />
        )}
        <LanguageSwitcher lang={lang} onChange={setLang} />
        <Link to="/my-tickets" className="ov-nav-link">
          {t(lang, "myTickets")}
        </Link>
      </header>

      <section className="ov-hero-section" id="top">
        <div className="ov-hero-inner">
          <div className="ov-hero-grid">
            <div className="ov-hero" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {nextDraw && <div className="ov-next-draw-pill">{t(lang, "nextDraw", { date: nextDraw.label })}</div>}
              <h1>{t(lang, "searchTicketsHeading", { n: availableCount })}</h1>
              <p>{t(lang, "searchTicketsSub")}</p>
              {staffProfile?.role === "admin" && (
                <button
                  className="ov-btn-sm"
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => setShowAvailablePhoto(true)}
                >
                  Save available numbers as photo
                </button>
              )}
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
        <div className="ov-footer-inner ov-footer-3col">
          <span>{t(lang, "footerNotice")}</span>
          <div className="ov-footer-links ov-footer-stack">
            <button
              type="button"
              className="primary ov-link-button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              {t(lang, "backToTop")}
            </button>
            {!staffProfile && <a href="#/login">{t(lang, "login")}</a>}
          </div>
          {/* Empty right column keeps Back to top / Login centered on wide screens */}
          <div className="ov-footer-spacer" aria-hidden="true" />
        </div>
      </footer>

      <div className="ov-fab-group">
        <a
          href="https://t.me/oracle_vault_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="ov-cart-fab ov-telegram-fab"
          aria-label={t(lang, "telegram")}
        >
          <TelegramIcon />
          <span className="ov-telegram-fab-label">{t(lang, "telegram")}</span>
        </a>
        {cart.length > 0 && !cartOpen && (
          <button className="ov-cart-fab" onClick={() => setCartOpen(true)}>
            {t(lang, "cartCount", { n: cart.length })}
          </button>
        )}
      </div>

      <CartDrawer lang={lang} open={cartOpen} onClose={() => setCartOpen(false)} onSold={markSoldLocally} />
      <CartSoldNotice lang={lang} numbers={cartGuard.removedNumbers} onDismiss={cartGuard.dismiss} />
      {showAvailablePhoto && (
        <AvailableNumbersPhotoCard
          numbers={tickets.filter((tk) => tk.status === "available").map((tk) => tk.number)}
          onClose={() => setShowAvailablePhoto(false)}
        />
      )}
      <WinnerChecker />
    </div>
  );
}
