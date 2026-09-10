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
  const currency = agentCurrency || getCurrencySymbol();

  useEffect(() => {
    Promise.all([
      supabase
        .from("sales")
        .select("customer_phone, price, sold_at")
        .eq("agent_id", agentId)
        .order("sold_at", { ascending: false }),
      supabase.from("agents").select("currency_symbol").eq("id", agentId).single(),
    ]).then(([salesRes, agentRes]) => {
      const byPhone = {};
      (salesRes.data || []).forEach((s) => {
        if (!byPhone[s.customer_phone]) {
          byPhone[s.customer_phone] = { phone: s.customer_phone, count: 0, total: 0, lastSale: s.sold_at };
        }
        byPhone[s.customer_phone].count += 1;
        byPhone[s.customer_phone].total += Number(s.price) || 0;
      });
      setRows(Object.values(byPhone));
      setAgentCurrency(agentRes.data?.currency_symbol || null);
      setLoading(false);
    });
  }, [agentId]);

  return (
    <div>
      <h1>My customers</h1>
      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "#5A6560" }}>No sales yet.</p>
      ) : (
        <div className="ov-table-wrap"><table className="ov-table">
          <thead>
            <tr>
              <th>Phone</th>
              <th>Tickets bought</th>
              <th>Total spent</th>
              <th>Last purchase</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.phone}>
                <td>{r.phone}</td>
                <td>{r.count}</td>
                <td>{currency}{r.total.toLocaleString()}</td>
                <td>{new Date(r.lastSale).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
