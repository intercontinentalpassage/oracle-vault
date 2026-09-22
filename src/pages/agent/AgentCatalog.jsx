import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toPng } from "html-to-image";
import { supabase } from "../../lib/supabaseClient";
import { getCurrencySymbol, getSiteSetting, useSiteSettingsVersion } from "../../lib/siteSettingsStore";
import BrandBadge from "../../components/BrandBadge";

export default function AgentCatalog() {
  const { agentId } = useOutletContext();
  const [tickets, setTickets] = useState([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [groups, setGroups] = useState([]);
  const [agentCurrency, setAgentCurrency] = useState(null);
  const [agentName, setAgentName] = useState("");
  const [showInvoice, setShowInvoice] = useState(false);
  const [search, setSearch] = useState("");
  const invoiceRef = useRef(null);
  const [savingInvoice, setSavingInvoice] = useState(false);
  useSiteSettingsVersion();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState({});
  const [soldModal, setSoldModal] = useState(null); // { ticket, phone, name }
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkPrice, setBulkPrice] = useState("");
  const [sellingId, setSellingId] = useState(null); // ticket currently being instant-sold, if any
  const [useExisting, setUseExisting] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const customerSearchTimer = useRef(null);

  function searchCustomers(query) {
    setCustomerQuery(query);
    clearTimeout(customerSearchTimer.current);
    if (!query.trim()) {
      setCustomerResults([]);
      return;
    }
    customerSearchTimer.current = setTimeout(async () => {
      setSearchingCustomers(true);
      const q = query.trim();
      // Scoped to this agent's own customers only, same as the cart's staff-sell search.
      const { data } = await supabase
        .from("customers")
        .select("phone, name")
        .eq("agent_id", agentId)
        .or(`phone.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(8);
      setCustomerResults(data || []);
      setSearchingCustomers(false);
    }, 250);
  }

  function pickCustomer(c) {
    setSoldModal((prev) => ({ ...prev, phone: c.phone, name: c.name || "" }));
    setCustomerQuery("");
    setCustomerResults([]);
  }

  function openSoldModal(ticketsToSell) {
    const available = ticketsToSell.filter((tk) => tk.status === "available");
    if (available.length === 0) return;
    setUseExisting(false);
    setCustomerQuery("");
    setCustomerResults([]);
    setError("");
    setSoldModal({ tickets: available, phone: "", name: "" });
  }

  // "Mark sold" on a single row: an instant, walk-in sale — no customer prompt,
  // no name or phone recorded. (For selling to a known customer, select the
  // ticket and use "Sell N selected" instead, which still asks for their details.)
  async function markSoldInstant(ticket) {
    if (ticket.status !== "available" || sellingId) return;
    setSellingId(ticket.id);
    setError("");
    try {
      const { data: result, error: rpcError } = await supabase.rpc("sell_tickets_to_customer", {
        p_ticket_ids: [ticket.id],
        p_phone: null,
        p_name: null,
      });
      if (rpcError) throw rpcError;
      if (!result?.ok) {
        setError(result?.message || "Couldn't mark this ticket as sold.");
        load();
        return;
      }
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(ticket.id);
        return next;
      });
      load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSellingId(null);
    }
  }

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function setPriceForSelected() {
    if (selected.size === 0 || bulkPrice.trim() === "") return;
    const ids = [...selected];
    const { error: updateError } = await supabase.from("tickets").update({ price: Number(bulkPrice) || 0 }).in("id", ids);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setBulkPrice("");
    setSelected(new Set());
    load();
  }

  async function load() {
    setLoading(true);
    const [ticketsRes, groupsRes, agentRes] = await Promise.all([
      supabase.from("tickets").select("*, draws(draw_date)").eq("agent_id", agentId).order("number"),
      supabase.from("groups").select("*").order("sort_order"),
      supabase.from("agents").select("name, currency_symbol").eq("id", agentId).single(),
    ]);
    if (ticketsRes.error) setError(ticketsRes.error.message);
    // Hide tickets whose draw date has passed (same rule as the storefront
    // and Admin > Tickets). Tickets with no draw never expire.
    const today = new Date().toISOString().slice(0, 10);
    const allTickets = ticketsRes.data || [];
    const currentTickets = allTickets.filter((tk) => {
      const drawDate = tk.draws?.draw_date;
      return !(drawDate && drawDate < today);
    });
    setHiddenCount(allTickets.length - currentTickets.length);
    setTickets(currentTickets);
    setGroups(groupsRes.data || []);
    setAgentCurrency(agentRes.data?.currency_symbol || null);
    setAgentName(agentRes.data?.name || "");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [agentId]);

  async function savePrice(id) {
    const value = editing[id];
    if (value === undefined) return;
    const { error: updateError } = await supabase.from("tickets").update({ price: Number(value) || 0 }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    load();
  }

  async function confirmMarkSold() {
    if (!soldModal || soldModal.tickets.length === 0) return;
    const phone = soldModal.phone.trim();
    if (!phone) {
      setError("Enter the customer's phone number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      // One atomic database step: locks the tickets, re-checks every one is
      // still available (and still this agent's), then creates the sale rows
      // and marks them sold together. If any ticket in the batch was already
      // sold - by a race, a double click, or another tab - NONE of the batch
      // is sold and no sale rows are created, rather than some silently going
      // through while others don't.
      const { data: result, error: rpcError } = await supabase.rpc("sell_tickets_to_customer", {
        p_ticket_ids: soldModal.tickets.map((tk) => tk.id),
        p_phone: phone,
        p_name: soldModal.name.trim() || null,
      });
      if (rpcError) throw rpcError;
      if (!result?.ok) {
        setError(result?.message || "Couldn't complete this sale.");
        load(); // show the real, current state
        return;
      }

      setSoldModal(null);
      setSelected((prev) => {
        const next = new Set(prev);
        soldModal.tickets.forEach((tk) => next.delete(tk.id));
        return next;
      });
      load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveInvoiceAsPhoto() {
    if (!invoiceRef.current) return;
    setSavingInvoice(true);
    try {
      const dataUrl = await toPng(invoiceRef.current, { pixelRatio: 2, backgroundColor: "#FFFFFF" });
      const link = document.createElement("a");
      link.download = `${agentName || "agent"}-tickets-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError("Couldn't save the image — try again.");
    } finally {
      setSavingInvoice(false);
    }
  }

  const invoiceCurrency = agentCurrency || getCurrencySymbol();
  const invoiceTotal = tickets.reduce((sum, tk) => sum + (Number(tk.price) || 0), 0);
  const filteredTickets = search ? tickets.filter((tk) => tk.number.includes(search)) : tickets;
  const sellableSelected = tickets.filter((tk) => selected.has(tk.id) && tk.status === "available");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>My catalog</h1>
        {tickets.length > 0 && (
          <button className="ov-btn-sm primary" onClick={() => setShowInvoice(true)}>
            View invoice
          </button>
        )}
      </div>
      <p style={{ fontSize: 13, color: "#5A6560", marginTop: -14, marginBottom: 20 }}>
        Tickets your admin has assigned to you. You can adjust the price shown on your shop page.
      </p>

      {tickets.length > 0 && (
        <input
          className="ov-input"
          style={{ maxWidth: 220, marginTop: 0, marginBottom: 16 }}
          type="text"
          inputMode="numeric"
          placeholder="Search number…"
          value={search}
          onChange={(e) => setSearch(e.target.value.replace(/\D/g, ""))}
        />
      )}

      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {selected.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <input
            className="ov-input"
            style={{ width: 100, marginTop: 0 }}
            type="number"
            placeholder="Set price…"
            value={bulkPrice}
            onChange={(e) => setBulkPrice(e.target.value)}
          />
          <button className="ov-btn-sm primary" onClick={setPriceForSelected} disabled={bulkPrice.trim() === ""}>
            Apply to {selected.size} selected
          </button>
          <button
            className="ov-btn-sm"
            disabled={sellableSelected.length === 0}
            onClick={() => openSoldModal(sellableSelected)}
          >
            Sell {sellableSelected.length || selected.size} selected
          </button>
          {sellableSelected.length > 0 && sellableSelected.length < selected.size && (
            <span style={{ fontSize: 12, color: "#5A6560" }}>
              ({selected.size - sellableSelected.length} already sold, won't be included)
            </span>
          )}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : tickets.length === 0 ? (
        <p style={{ color: "#5A6560" }}>{hiddenCount > 0 ? "No current tickets." : "No tickets assigned to you yet."}</p>
      ) : filteredTickets.length === 0 ? (
        <p style={{ color: "#5A6560" }}>No tickets match "{search}".</p>
      ) : (
        <div className="ov-table-wrap"><table className="ov-table">
          <thead>
            <tr>
              <th></th>
              <th>Number</th>
              <th>Group</th>
              <th>Status</th>
              <th>Price ({agentCurrency || getCurrencySymbol()})</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map((tk) => (
              <tr key={tk.id}>
                <td>
                  <input type="checkbox" checked={selected.has(tk.id)} onChange={() => toggleSelected(tk.id)} />
                </td>
                <td style={{ fontFamily: "'Space Mono', monospace" }}>{tk.number}</td>
                <td>{groups.find((g) => g.key === tk.group_key)?.label || tk.group_key}</td>
                <td>
                  <span className={`ov-status-pill ${tk.status}`}>{tk.status}</span>
                </td>
                <td>
                  <input
                    className="ov-input"
                    style={{ margin: 0, padding: "6px 8px", width: 90, fontSize: 12 }}
                    type="number"
                    value={editing[tk.id] ?? tk.price ?? 0}
                    onChange={(e) => setEditing((prev) => ({ ...prev, [tk.id]: e.target.value }))}
                  />
                </td>
                <td>
                  {editing[tk.id] !== undefined && (
                    <button className="ov-btn-sm primary" onClick={() => savePrice(tk.id)}>
                      Save
                    </button>
                  )}
                  {tk.status === "available" && (
                    <button
                      className="ov-btn-sm"
                      style={{ marginLeft: 6 }}
                      disabled={sellingId === tk.id}
                      onClick={() => markSoldInstant(tk)}
                    >
                      {sellingId === tk.id ? "Selling…" : "Mark sold"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      {soldModal && (
        <div className="ov-summary-overlay" onClick={() => !saving && setSoldModal(null)} style={{ position: "fixed" }}>
          <div className="ov-summary-wrap" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className="ov-summary-card">
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                {soldModal.tickets.length === 1
                  ? `Mark ${soldModal.tickets[0].number} as sold`
                  : `Mark ${soldModal.tickets.length} tickets as sold`}
              </div>
              {soldModal.tickets.length > 1 && (
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#5A6560", marginTop: 0, marginBottom: 6 }}>
                  {soldModal.tickets.map((tk) => tk.number).join(", ")}
                </p>
              )}
              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 0, marginBottom: 14 }}>
                Total: {invoiceCurrency}
                {soldModal.tickets.reduce((sum, tk) => sum + (Number(tk.price) || 0), 0).toLocaleString()}
              </p>
              <p style={{ fontSize: 13, color: "#5A6560", marginTop: 0, marginBottom: 14 }}>
                Enter the customer's details. A new customer is created automatically if this phone number hasn't
                bought from you before.
              </p>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
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
                <div style={{ position: "relative", marginBottom: 14 }}>
                  <input
                    className="ov-input"
                    style={{ margin: 0 }}
                    value={customerQuery}
                    onChange={(e) => searchCustomers(e.target.value)}
                    placeholder="Search by phone or name…"
                  />
                  {customerQuery.trim() !== "" && (
                    <ul className="ov-dropdown-menu" style={{ position: "absolute" }}>
                      {searchingCustomers ? (
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

              <label style={{ display: "block", marginBottom: 10 }}>
                Phone
                <input
                  className="ov-input"
                  value={soldModal.phone}
                  onChange={(e) => setSoldModal((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="09xxxxxxxx"
                />
              </label>
              <label style={{ display: "block" }}>
                Name (optional)
                <input
                  className="ov-input"
                  value={soldModal.name}
                  onChange={(e) => setSoldModal((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>

              {error && <p style={{ color: "#B23A2E", fontSize: 13, marginTop: 12 }}>{error}</p>}

              <button className="ov-btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={confirmMarkSold} disabled={saving}>
                {saving ? "Saving…" : "Mark as sold"}
              </button>
              <button className="ov-btn-sm" style={{ width: "100%", marginTop: 8 }} onClick={() => setSoldModal(null)} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showInvoice && (
        <div className="ov-summary-overlay" onClick={() => setShowInvoice(false)}>
          <div className="ov-summary-wrap" onClick={(e) => e.stopPropagation()}>
            <div className="ov-summary-card" ref={invoiceRef}>
              <div className="ov-summary-header">
                <BrandBadge size={32} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{agentName || "Agent"}</div>
                  <div style={{ fontSize: 11, color: "#5A6560" }}>{new Date().toLocaleString()}</div>
                </div>
              </div>

              <div className="ov-summary-divider" />

              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                {tickets.map((tk) => (
                  <div key={tk.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                    <span style={{ fontFamily: "'Space Mono', monospace", letterSpacing: "0.05em" }}>
                      {tk.number} <span style={{ fontSize: 11, color: "#5A6560" }}>({tk.status})</span>
                    </span>
                    <span>{invoiceCurrency}{Number(tk.price || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="ov-summary-divider" />

              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}>
                <span>Total</span>
                <span style={{ fontFamily: "'Space Mono', monospace" }}>
                  {invoiceCurrency}{invoiceTotal.toLocaleString()}
                </span>
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
  );
}
