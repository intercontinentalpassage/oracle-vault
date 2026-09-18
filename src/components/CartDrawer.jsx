import { useRef, useState } from "react";
import { t } from "../lib/i18n";
import { useCart } from "../lib/CartContext";
import { supabase } from "../lib/supabaseClient";
import { useSessionProfile } from "../lib/useSessionProfile";
import { getCurrencySymbol, useSiteSettingsVersion } from "../lib/siteSettingsStore";
import CartSummaryCard from "./CartSummaryCard";

export default function CartDrawer({ lang, open, onClose, agentId, currencyOverride, shopName }) {
  const { cart, remove, clear } = useCart();
  const { profile: staffProfile } = useSessionProfile();
  const isStaff = staffProfile?.role === "admin" || staffProfile?.role === "agent";
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [agentCode, setAgentCode] = useState("");
  const [useExisting, setUseExisting] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  useSiteSettingsVersion();
  const currency = currencyOverride || getCurrencySymbol();

  if (!open) return null;

  const total = cart.reduce((sum, tk) => sum + (Number(tk.price) || 0), 0);

  let searchTimer;
  function searchCustomers(query) {
    setCustomerQuery(query);
    clearTimeout(searchTimerRef.current);
    if (!query.trim()) {
      setCustomerResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      const q = query.trim();
      let queryBuilder = supabase.from("customers").select("phone, name").or(`phone.ilike.%${q}%,name.ilike.%${q}%`);
      if (staffProfile?.role === "agent") {
        queryBuilder = queryBuilder.eq("agent_id", staffProfile.agent_id);
      }
      const { data } = await queryBuilder.limit(8);
      setCustomerResults(data || []);
      setSearching(false);
    }, 250);
  }

  function pickCustomer(c) {
    setPhone(c.phone);
    setName(c.name || "");
    setCustomerQuery("");
    setCustomerResults([]);
  }

  async function submit() {
    const cleanPhone = phone.trim();
    if (!/^\d{6,}$/.test(cleanPhone.replace(/\s|-/g, ""))) {
      setError(t(lang, "enterValidPhone"));
      return;
    }
    setError("");
    setSending(true);
    try {
      let resolvedAgentId = agentId || null;
      const code = agentCode.trim();
      if (!resolvedAgentId && code) {
        const { data: matchedAgent } = await supabase
          .from("agents")
          .select("id")
          .eq("active", true)
          .or(`slug.eq.${code},email.eq.${code}`)
          .maybeSingle();
        if (matchedAgent) {
          resolvedAgentId = matchedAgent.id;
        } else {
          setError("That agent code or email wasn't found — check it, or leave it blank to continue without one.");
          setSending(false);
          return;
        }
      }

      if (isStaff) {
        // Staff completing a checkout themselves is a real, immediate sale
        // — not a request that needs separate approval later.
        if (!resolvedAgentId && staffProfile?.role === "agent") {
          resolvedAgentId = staffProfile.agent_id;
        }

        const ids = cart.map((tk) => tk.id);
        const { data: updatedTickets, error: ticketError } = await supabase
          .from("tickets")
          .update({ status: "sold" })
          .in("id", ids)
          .eq("status", "available")
          .select("id");
        if (ticketError) throw ticketError;
        if (!updatedTickets || updatedTickets.length !== ids.length) {
          throw new Error("One or more of these tickets were no longer available — please refresh and try again.");
        }

        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("phone", cleanPhone)
          .maybeSingle();
        let customerId = existingCustomer?.id;
        if (!customerId) {
          const { data: newCustomer, error: custError } = await supabase
            .from("customers")
            .insert({ phone: cleanPhone, name: name.trim() || null })
            .select()
            .single();
          if (custError) throw custError;
          customerId = newCustomer.id;
        }

        // Any other pending request sharing one of these tickets loses
        // just that ticket (or expires if it was its only one) — same
        // cascading behavior as the admin panel and the Telegram bot.
        const { data: otherPending } = await supabase
          .from("purchase_requests")
          .select("*")
          .eq("status", "pending")
          .overlaps("ticket_ids", ids);
        for (const other of otherPending || []) {
          const remaining = (other.ticket_ids || []).filter((id) => !ids.includes(id));
          const otherPerTicketPrice = other.ticket_ids.length ? other.total / other.ticket_ids.length : 0;
          await supabase
            .from("purchase_requests")
            .update({
              ticket_ids: remaining,
              total: otherPerTicketPrice * remaining.length,
              status: remaining.length === 0 ? "expired" : "pending",
            })
            .eq("id", other.id);
        }

        const saleRows = cart.map((tk) => ({
          ticket_id: tk.id,
          customer_id: customerId,
          customer_phone: cleanPhone,
          agent_id: resolvedAgentId,
          price: tk.price,
        }));
        const { error: saleError } = await supabase.from("sales").insert(saleRows);
        if (saleError) throw saleError;
      } else {
        const { error: insertError } = await supabase.from("purchase_requests").insert({
          customer_phone: cleanPhone,
          customer_name: name.trim() || null,
          ticket_ids: cart.map((tk) => tk.id),
          total,
          agent_id: resolvedAgentId,
        });
        if (insertError) throw insertError;
      }

      setSent(true);
      setLastOrder({ cart, total, phone: cleanPhone, name: name.trim() });
      clear();
      if (isStaff) setShowSummary(true);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ov-cart-overlay" onClick={onClose}>
      <div className="ov-cart-panel" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            top: 0,
            background: "#FFFFFF",
            zIndex: 1,
            paddingBottom: 8,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{t(lang, "yourCart")}</h2>
          <button
            className="ov-link-btn"
            aria-label={t(lang, "closeCart")}
            onClick={onClose}
            style={{ fontSize: 22, lineHeight: 1, color: "#5A6560" }}
          >
            ×
          </button>
        </div>

        {sent ? (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontWeight: 700 }}>{isStaff ? "Sold!" : t(lang, "requestSent")}</p>
            <p style={{ color: "#5A6560", fontSize: 14 }}>
              {isStaff
                ? "The ticket(s) are marked sold and recorded — no approval needed."
                : t(lang, "requestSentDetailCustomer")}
            </p>
            <button
              className="ov-link-btn"
              style={{ marginTop: 8, color: "#0F7A63", fontWeight: 700 }}
              onClick={() => setShowSummary(true)}
            >
              View invoice
            </button>
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

            <button
              className="ov-link-btn"
              style={{ marginTop: 8, color: "#5A6560" }}
              onClick={clear}
            >
              {t(lang, "removeAll")}
            </button>

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
              {isStaff && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={useExisting}
                      onChange={(e) => {
                        setUseExisting(e.target.checked);
                        setCustomerQuery("");
                        setCustomerResults([]);
                      }}
                    />
                    Existing customer
                  </label>
                  {useExisting && (
                    <div style={{ position: "relative", marginTop: 8 }}>
                      <input
                        className="ov-input"
                        style={{ margin: 0 }}
                        value={customerQuery}
                        onChange={(e) => searchCustomers(e.target.value)}
                        placeholder="Search by phone or name…"
                      />
                      {customerQuery.trim() !== "" && (
                        <ul className="ov-dropdown-menu" style={{ position: "absolute" }}>
                          {searching ? (
                            <li className="ov-dropdown-option" style={{ cursor: "default" }}>
                              Searching…
                            </li>
                          ) : customerResults.length === 0 ? (
                            <li className="ov-dropdown-option" style={{ cursor: "default", color: "#5A6560" }}>
                              No matches
                            </li>
                          ) : (
                            customerResults.map((c) => (
                              <li key={c.phone} className="ov-dropdown-option" onClick={() => pickCustomer(c)}>
                                {c.phone}
                                {c.name ? ` — ${c.name}` : ""}
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
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
              {!agentId && (
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginTop: 10 }}>
                  Agent code or email (optional)
                  <input
                    className="ov-input"
                    value={agentCode}
                    onChange={(e) => setAgentCode(e.target.value)}
                    placeholder="If an agent referred you"
                  />
                </label>
              )}
              {error && <p style={{ color: "#B23A2E", fontSize: 13, marginTop: 8 }}>{error}</p>}
              <button
                className="ov-btn-primary"
                style={{ width: "100%", marginTop: 14 }}
                disabled={sending}
                onClick={submit}
              >
                {sending ? (isStaff ? "Selling…" : t(lang, "sending")) : isStaff ? "Sell" : t(lang, "requestPurchase")}
              </button>
            </div>
          </>
        )}

        {showSummary && (
          <CartSummaryCard
            lang={lang}
            cart={sent && lastOrder ? lastOrder.cart : cart}
            total={sent && lastOrder ? lastOrder.total : total}
            phone={sent && lastOrder ? lastOrder.phone : phone}
            name={sent && lastOrder ? lastOrder.name : name}
            currencyOverride={currencyOverride}
            shopName={shopName}
            onClose={() => setShowSummary(false)}
          />
        )}
      </div>
    </div>
  );
}
