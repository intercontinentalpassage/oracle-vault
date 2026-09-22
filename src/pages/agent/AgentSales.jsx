import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getCurrencySymbol, useSiteSettingsVersion } from "../../lib/siteSettingsStore";

export default function AgentSales() {
  useSiteSettingsVersion();
  const { agentId } = useOutletContext();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentCurrency, setAgentCurrency] = useState(null);
  const [editing, setEditing] = useState({});
  const [editingCustomer, setEditingCustomer] = useState({}); // { [saleId]: { phone, name } }
  const [savingCustomer, setSavingCustomer] = useState(null);
  const [recalling, setRecalling] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkPrice, setBulkPrice] = useState("");
  const [error, setError] = useState("");
  const currency = agentCurrency || getCurrencySymbol();

  function load() {
    setLoading(true);
    Promise.all([
      supabase
        .from("sales")
        .select("*, tickets(number, draws(draw_date))")
        .eq("agent_id", agentId)
        .order("sold_at", { ascending: false }),
      supabase.from("agents").select("currency_symbol").eq("id", agentId).single(),
    ]).then(([salesRes, agentRes]) => {
      // Hide sales of tickets whose draw date has passed (same rule as the
      // storefront and Admin > Tickets). Tickets with no draw never expire.
      // Totals, the chart and the table all read from this filtered list.
      const today = new Date().toISOString().slice(0, 10);
      const currentSales = (salesRes.data || []).filter((s) => {
        const drawDate = s.tickets?.draws?.draw_date;
        return !(drawDate && drawDate < today);
      });
      setSales(currentSales);
      setAgentCurrency(agentRes.data?.currency_symbol || null);
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, [agentId]);

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function savePrice(id) {
    const value = editing[id];
    if (value === undefined) return;
    const { error: updateError } = await supabase.from("sales").update({ price: Number(value) || 0 }).eq("id", id);
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

  async function setPriceForSelected() {
    if (selected.size === 0 || bulkPrice.trim() === "") return;
    const ids = [...selected];
    const { error: updateError } = await supabase.from("sales").update({ price: Number(bulkPrice) || 0 }).in("id", ids);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setBulkPrice("");
    setSelected(new Set());
    load();
  }

  function startEditCustomer(s) {
    setEditingCustomer((prev) => ({ ...prev, [s.id]: { phone: s.customer_phone || "", name: "" } }));
  }

  async function saveCustomer(saleId) {
    const draft = editingCustomer[saleId];
    if (!draft) return;
    setSavingCustomer(saleId);
    setError("");
    const { data: result, error: rpcError } = await supabase.rpc("set_sale_customer", {
      p_sale_id: saleId,
      p_phone: draft.phone,
      p_name: draft.name || null,
    });
    setSavingCustomer(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (!result?.ok) {
      setError(result?.message || "Couldn't save the customer's details.");
      return;
    }
    setEditingCustomer((prev) => {
      const next = { ...prev };
      delete next[saleId];
      return next;
    });
    load();
  }

  async function recall(sale) {
    if (recalling) return;
    const label = sale.tickets?.number ? `ticket ${sale.tickets.number}` : "this sale";
    if (!confirm(`Recall ${label}? This removes the sale and puts the ticket back to available.`)) return;
    setRecalling(sale.id);
    setError("");
    const { data: result, error: rpcError } = await supabase.rpc("recall_sale", { p_sale_id: sale.id });
    setRecalling(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (!result?.ok) {
      setError(result?.message || "Couldn't recall this sale.");
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(sale.id);
      return next;
    });
    load();
  }

  const total = sales.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const maxByDay = {};
  sales.forEach((s) => {
    const day = new Date(s.sold_at).toLocaleDateString();
    maxByDay[day] = (maxByDay[day] || 0) + (Number(s.price) || 0);
  });
  const days = Object.entries(maxByDay).slice(0, 14).reverse();
  const maxVal = Math.max(1, ...days.map(([, v]) => v));

  return (
    <div>
      <h1>Sales</h1>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div className="ov-card" style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "#5A6560" }}>Total revenue</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{currency}{total.toLocaleString()}</div>
        </div>
        <div className="ov-card" style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: "#5A6560" }}>Tickets sold</div>
          <div style={{ fontSize: 24, fontWeight: 800 }}>{sales.length}</div>
        </div>
      </div>

      {days.length > 0 && (
        <div className="ov-card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: "#5A6560", marginBottom: 10 }}>Revenue by day</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
            {days.map(([day, val]) => (
              <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div
                  title={`${day}: ${currency}${val.toLocaleString()}`}
                  style={{
                    width: "100%",
                    height: `${Math.max(4, (val / maxVal) * 90)}px`,
                    background: "#0F7A63",
                    borderRadius: 4,
                  }}
                />
                <span style={{ fontSize: 9, color: "#5A6560" }}>{day.slice(0, 5)}</span>
              </div>
            ))}
          </div>
        </div>
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
        </div>
      )}

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : (
        <div className="ov-table-wrap"><table className="ov-table">
          <thead>
            <tr>
              <th></th>
              <th>Ticket</th>
              <th>Phone</th>
              <th>Price</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelected(s.id)} />
                </td>
                <td style={{ fontFamily: "'Space Mono', monospace" }}>{s.tickets?.number || "—"}</td>
                <td>
                  {editingCustomer[s.id] ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
                      <input
                        className="ov-input"
                        style={{ margin: 0, padding: "6px 8px", fontSize: 12 }}
                        value={editingCustomer[s.id].phone}
                        placeholder="Phone"
                        onChange={(e) =>
                          setEditingCustomer((prev) => ({ ...prev, [s.id]: { ...prev[s.id], phone: e.target.value } }))
                        }
                      />
                      <input
                        className="ov-input"
                        style={{ margin: 0, padding: "6px 8px", fontSize: 12 }}
                        value={editingCustomer[s.id].name}
                        placeholder="Name (optional)"
                        onChange={(e) =>
                          setEditingCustomer((prev) => ({ ...prev, [s.id]: { ...prev[s.id], name: e.target.value } }))
                        }
                      />
                    </div>
                  ) : (
                    <span
                      style={{ cursor: "pointer", textDecoration: "underline dotted" }}
                      title="Click to edit"
                      onClick={() => startEditCustomer(s)}
                    >
                      {s.customer_phone || "Walk-in"}
                    </span>
                  )}
                </td>
                <td>
                  <input
                    className="ov-input"
                    style={{ margin: 0, padding: "6px 8px", width: 90, fontSize: 12 }}
                    type="number"
                    value={editing[s.id] ?? s.price ?? 0}
                    onChange={(e) => setEditing((prev) => ({ ...prev, [s.id]: e.target.value }))}
                  />
                </td>
                <td>{new Date(s.sold_at).toLocaleDateString()}</td>
                <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {editing[s.id] !== undefined && (
                    <button className="ov-btn-sm primary" onClick={() => savePrice(s.id)}>
                      Save
                    </button>
                  )}
                  {editingCustomer[s.id] && (
                    <button
                      className="ov-btn-sm primary"
                      disabled={savingCustomer === s.id}
                      onClick={() => saveCustomer(s.id)}
                    >
                      {savingCustomer === s.id ? "Saving…" : "Save customer"}
                    </button>
                  )}
                  <button className="ov-btn-sm" disabled={recalling === s.id} onClick={() => recall(s)}>
                    {recalling === s.id ? "Recalling…" : "Recall"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
