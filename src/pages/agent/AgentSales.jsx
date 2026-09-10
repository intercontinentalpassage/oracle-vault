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
  const currency = agentCurrency || getCurrencySymbol();

  useEffect(() => {
    Promise.all([
      supabase
        .from("sales")
        .select("*, tickets(number)")
        .eq("agent_id", agentId)
        .order("sold_at", { ascending: false }),
      supabase.from("agents").select("currency_symbol").eq("id", agentId).single(),
    ]).then(([salesRes, agentRes]) => {
      setSales(salesRes.data || []);
      setAgentCurrency(agentRes.data?.currency_symbol || null);
      setLoading(false);
    });
  }, [agentId]);

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

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : (
        <div className="ov-table-wrap"><table className="ov-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Phone</th>
              <th>Price</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td style={{ fontFamily: "'Space Mono', monospace" }}>{s.tickets?.number || "—"}</td>
                <td>{s.customer_phone}</td>
                <td>{currency}{Number(s.price || 0).toLocaleString()}</td>
                <td>{new Date(s.sold_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
