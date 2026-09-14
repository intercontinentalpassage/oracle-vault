import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getCurrencySymbol, useSiteSettingsVersion } from "../../lib/siteSettingsStore";

export default function AgentCustomers() {
  useSiteSettingsVersion();
  const { agentId } = useOutletContext();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agentCurrency, setAgentCurrency] = useState(null);
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const currency = agentCurrency || getCurrencySymbol();

  async function load() {
    setLoading(true);
    const [salesRes, customersRes, agentRes] = await Promise.all([
      supabase
        .from("sales")
        .select("customer_phone, price, sold_at")
        .eq("agent_id", agentId)
        .order("sold_at", { ascending: false }),
      supabase.from("customers").select("phone, name").eq("agent_id", agentId),
      supabase.from("agents").select("currency_symbol").eq("id", agentId).single(),
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
              <tr key={r.phone}>
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
