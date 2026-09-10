import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getCurrencySymbol } from "../../lib/siteSettingsStore";

export default function AgentCatalog() {
  const { agentId } = useOutletContext();
  const [tickets, setTickets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [agentCurrency, setAgentCurrency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState({});

  async function load() {
    setLoading(true);
    const [ticketsRes, groupsRes, agentRes] = await Promise.all([
      supabase.from("tickets").select("*").eq("agent_id", agentId).order("number"),
      supabase.from("groups").select("*").order("sort_order"),
      supabase.from("agents").select("currency_symbol").eq("id", agentId).single(),
    ]);
    if (ticketsRes.error) setError(ticketsRes.error.message);
    setTickets(ticketsRes.data || []);
    setGroups(groupsRes.data || []);
    setAgentCurrency(agentRes.data?.currency_symbol || null);
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

  return (
    <div>
      <h1>My catalog</h1>
      <p style={{ fontSize: 13, color: "#5A6560", marginTop: -14, marginBottom: 20 }}>
        Tickets your admin has assigned to you. You can adjust the price shown on your shop page.
      </p>

      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : tickets.length === 0 ? (
        <p style={{ color: "#5A6560" }}>No tickets assigned to you yet.</p>
      ) : (
        <div className="ov-table-wrap"><table className="ov-table">
          <thead>
            <tr>
              <th>Number</th>
              <th>Group</th>
              <th>Status</th>
              <th>Price ({agentCurrency || getCurrencySymbol()})</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((tk) => (
              <tr key={tk.id}>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
