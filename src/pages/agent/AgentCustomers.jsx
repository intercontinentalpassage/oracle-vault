import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toPng } from "html-to-image";
import { supabase } from "../../lib/supabaseClient";
import { getCurrencySymbol, getSiteSetting, useSiteSettingsVersion } from "../../lib/siteSettingsStore";
import BrandBadge from "../../components/BrandBadge";

export default function AgentCustomers() {
  useSiteSettingsVersion();
  const { agentId } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentCurrency, setAgentCurrency] = useState(null);
  const [agentName, setAgentName] = useState("");
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const currency = agentCurrency || getCurrencySymbol();

  const [detailFor, setDetailFor] = useState(null);
  const [detailSales, setDetailSales] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailHiddenCount, setDetailHiddenCount] = useState(0);
  const [detailEditing, setDetailEditing] = useState({});
  const [detailSelected, setDetailSelected] = useState(new Set());
  const [detailBulkPrice, setDetailBulkPrice] = useState("");
  const invoiceRef = useRef(null);
  const [savingInvoice, setSavingInvoice] = useState(false);

  async function openDetail(row) {
    setDetailFor(row);
    setDetailEditing({});
    setDetailSelected(new Set());
    setDetailBulkPrice("");
    setDetailLoading(true);
    const { data } = await supabase
      .from("sales")
      .select("id, price, sold_at, tickets(number, draws(draw_date))")
      .eq("agent_id", agentId)
      .eq("customer_phone", row.phone)
      .order("sold_at", { ascending: false });
    // Hide tickets whose draw date has passed (same rule as the storefront
    // and the Archived filter). Tickets with no draw never expire.
    const today = new Date().toISOString().slice(0, 10);
    const isExpired = (s) => {
      const drawDate = s.tickets?.draws?.draw_date;
      return !!(drawDate && drawDate < today);
    };
    const all = data || [];
    const current = all.filter((s) => !isExpired(s));
    setDetailHiddenCount(all.length - current.length);
    setDetailSales(current);
    setDetailLoading(false);
  }

  function toggleDetailSelected(id) {
    setDetailSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveDetailPrice(id) {
    const value = detailEditing[id];
    if (value === undefined) return;
    const { error: updateError } = await supabase.from("sales").update({ price: Number(value) || 0 }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDetailSales((prev) => prev.map((s) => (s.id === id ? { ...s, price: Number(value) || 0 } : s)));
    setDetailEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function applyDetailBulkPrice() {
    if (detailSelected.size === 0 || detailBulkPrice.trim() === "") return;
    const ids = [...detailSelected];
    const newPrice = Number(detailBulkPrice) || 0;
    const { error: updateError } = await supabase.from("sales").update({ price: newPrice }).in("id", ids);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDetailSales((prev) => prev.map((s) => (ids.includes(s.id) ? { ...s, price: newPrice } : s)));
    setDetailBulkPrice("");
    setDetailSelected(new Set());
  }

  const detailTotal = detailSales.reduce((sum, s) => sum + (Number(s.price) || 0), 0);

  async function saveInvoiceAsPhoto() {
    if (!invoiceRef.current) return;
    setSavingInvoice(true);
    try {
      const dataUrl = await toPng(invoiceRef.current, { pixelRatio: 2, backgroundColor: "#FFFFFF" });
      const link = document.createElement("a");
      link.download = `${detailFor?.name || detailFor?.phone || "customer"}-invoice-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setError("Couldn't save the image — try again.");
    } finally {
      setSavingInvoice(false);
    }
  }

  async function load() {
    setLoading(true);
    const [salesRes, customersRes, agentRes] = await Promise.all([
      supabase
        .from("sales")
        .select("customer_phone, price, sold_at")
        .eq("agent_id", agentId)
        .order("sold_at", { ascending: false }),
      supabase.from("customers").select("phone, name").eq("agent_id", agentId),
      supabase.from("agents").select("name, currency_symbol").eq("id", agentId).single(),
    ]);

    const byPhone = {};
    // Customers this agent has added directly, even before any sale.
    (customersRes.data || []).forEach((c) => {
      byPhone[c.phone] = { phone: c.phone, name: c.name, count: 0, total: 0, lastSale: null };
    });
    (salesRes.data || []).forEach((s) => {
      if (!byPhone[s.customer_phone]) {
        byPhone[s.customer_phone] = { phone: s.customer_phone, name: null, count: 0, total: 0, lastSale: s.sold_at };
      }
      byPhone[s.customer_phone].count += 1;
      byPhone[s.customer_phone].total += Number(s.price) || 0;
      if (!byPhone[s.customer_phone].lastSale || s.sold_at > byPhone[s.customer_phone].lastSale) {
        byPhone[s.customer_phone].lastSale = s.sold_at;
      }
    });
    setRows(Object.values(byPhone));
    setAgentCurrency(agentRes.data?.currency_symbol || null);
    setAgentName(agentRes.data?.name || "");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [agentId]);

  async function addCustomer() {
    const phone = newPhone.trim();
    if (!phone) {
      setError("Enter a phone number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data: existing } = await supabase.from("customers").select("id, agent_id").eq("phone", phone).maybeSingle();
      if (existing) {
        // Already exists (e.g. added by admin or another agent) — just
        // claim it as one of yours instead of erroring out.
        if (!existing.agent_id) {
          await supabase.from("customers").update({ agent_id: agentId }).eq("id", existing.id);
        }
      } else {
        const { error: insertError } = await supabase
          .from("customers")
          .insert({ phone, name: newName.trim() || null, agent_id: agentId });
        if (insertError) throw insertError;
      }
      setAddOpen(false);
      setNewPhone("");
      setNewName("");
      load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>My customers</h1>
        <button className="ov-btn-sm primary" onClick={() => setAddOpen(true)}>
          New customer
        </button>
      </div>

      {error && !addOpen && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "#5A6560" }}>No customers yet — add one, or they'll appear here after their first purchase.</p>
      ) : (
        <div className="ov-table-wrap"><table className="ov-table">
          <thead>
            <tr>
              <th>Phone</th>
              <th>Name</th>
              <th>Tickets bought</th>
              <th>Total spent</th>
              <th>Last purchase</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.phone} onClick={() => openDetail(r)} style={{ cursor: "pointer" }}>
                <td>{r.phone}</td>
                <td>{r.name || "—"}</td>
                <td>{r.count}</td>
                <td>{currency}{r.total.toLocaleString()}</td>
                <td>{r.lastSale ? new Date(r.lastSale).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      {detailFor && (
        <div className="ov-summary-overlay" onClick={() => setDetailFor(null)} style={{ position: "fixed" }}>
          <div className="ov-summary-wrap" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="ov-summary-card" ref={invoiceRef}>
              <div className="ov-summary-header">
                <BrandBadge size={32} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{agentName || "Agent"}</div>
                  <div style={{ fontSize: 11, color: "#5A6560" }}>{new Date().toLocaleString()}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "#5A6560", margin: "8px 0 0" }}>
                {detailFor.name || detailFor.phone}
                {detailFor.name ? ` · ${detailFor.phone}` : ""}
              </p>

              <div className="ov-summary-divider" />

              {detailLoading ? (
                <p style={{ color: "#5A6560", fontSize: 13 }}>Loading…</p>
              ) : detailSales.length === 0 ? (
                <p style={{ color: "#5A6560", fontSize: 13 }}>{detailHiddenCount > 0 ? "No current tickets." : "No purchases yet."}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                  {detailSales.map((s) => (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <span style={{ fontFamily: "'Space Mono', monospace" }}>
                        {s.tickets?.number || "—"}{" "}
                        <span style={{ fontSize: 11, color: "#5A6560" }}>
                          ({new Date(s.sold_at).toLocaleDateString()})
                        </span>
                      </span>
                      <span>{currency}{Number(s.price || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="ov-summary-divider" />
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}>
                <span>Total</span>
                <span style={{ fontFamily: "'Space Mono', monospace" }}>
                  {currency}
                  {detailTotal.toLocaleString()}
                </span>
              </div>

              <div className="ov-summary-divider" />
              <p style={{ textAlign: "center", fontSize: 12, color: "#5A6560", margin: 0 }}>
                {getSiteSetting("invoice_thank_you") || "Thank you for your purchase!"}
              </p>
            </div>

            {detailSales.length > 0 && (
              <div className="ov-card" style={{ marginTop: 12 }}>
                <strong style={{ fontSize: 12, color: "#5A6560" }}>Manage this customer's sales</strong>
                {detailSelected.size > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                    <input
                      className="ov-input"
                      style={{ margin: 0, width: 90, padding: "6px 8px", fontSize: 12 }}
                      type="number"
                      placeholder="Set price…"
                      value={detailBulkPrice}
                      onChange={(e) => setDetailBulkPrice(e.target.value)}
                    />
                    <button
                      className="ov-btn-sm primary"
                      onClick={applyDetailBulkPrice}
                      disabled={detailBulkPrice.trim() === ""}
                    >
                      Apply to {detailSelected.size}
                    </button>
                  </div>
                )}
                <div style={{ maxHeight: 240, overflowY: "auto", marginTop: 10 }}>
                  {detailSales.map((s) => (
                    <div
                      key={s.id}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #F0F3F1", fontSize: 14 }}
                    >
                      <input type="checkbox" checked={detailSelected.has(s.id)} onChange={() => toggleDetailSelected(s.id)} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Space Mono', monospace" }}>{s.tickets?.number || "—"}</div>
                        <div style={{ fontSize: 12, color: "#5A6560" }}>{new Date(s.sold_at).toLocaleDateString()}</div>
                      </div>
                      <input
                        className="ov-input"
                        style={{ margin: 0, width: 80, padding: "6px 8px", fontSize: 12 }}
                        type="number"
                        value={detailEditing[s.id] ?? s.price ?? 0}
                        onChange={(e) => setDetailEditing((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      />
                      {detailEditing[s.id] !== undefined && (
                        <button className="ov-btn-sm primary" onClick={() => saveDetailPrice(s.id)}>
                          Save
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="ov-btn-sm" style={{ flex: 1 }} onClick={() => setDetailFor(null)}>
                Close
              </button>
              {detailSales.length > 0 && (
                <button className="ov-btn-sm primary" style={{ flex: 1 }} onClick={saveInvoiceAsPhoto} disabled={savingInvoice}>
                  {savingInvoice ? "Saving…" : "Save as photo"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="ov-summary-overlay" onClick={() => !saving && setAddOpen(false)} style={{ position: "fixed" }}>
          <div className="ov-summary-wrap" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className="ov-summary-card">
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>New customer</div>
              <p style={{ fontSize: 13, color: "#5A6560", marginTop: 0, marginBottom: 14 }}>
                Add someone to your customer list, even before their first purchase.
              </p>

              <label style={{ display: "block", marginBottom: 10 }}>
                Phone
                <input
                  className="ov-input"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="09xxxxxxxx"
                />
              </label>
              <label style={{ display: "block" }}>
                Name (optional)
                <input className="ov-input" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </label>

              {error && <p style={{ color: "#B23A2E", fontSize: 13, marginTop: 12 }}>{error}</p>}

              <button className="ov-btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={addCustomer} disabled={saving}>
                {saving ? "Saving…" : "Add customer"}
              </button>
              <button
                className="ov-btn-sm"
                style={{ width: "100%", marginTop: 8 }}
                onClick={() => setAddOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
