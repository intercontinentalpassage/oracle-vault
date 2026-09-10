import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

export default function AgentRefunds() {
  const { agentId } = useOutletContext();
  const [tickets, setTickets] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const [ticketsRes, refundsRes] = await Promise.all([
      supabase.from("tickets").select("*").eq("agent_id", agentId).eq("status", "available").order("number"),
      supabase.from("refunds").select("*").eq("agent_id", agentId).order("created_at", { ascending: false }),
    ]);
    setTickets(ticketsRes.data || []);
    setRefunds(refundsRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [agentId]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0) return;
    setSending(true);
    setError("");
    const { error: insertError } = await supabase.from("refunds").insert({
      agent_id: agentId,
      ticket_ids: [...selected],
      reason: reason.trim() || null,
    });
    setSending(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSelected(new Set());
    setReason("");
    load();
  }

  return (
    <div>
      <h1>Refund requests</h1>
      <p style={{ fontSize: 13, color: "#5A6560", marginTop: -14, marginBottom: 20 }}>
        Select tickets you'd like to return to Admin, then submit — they'll review and approve or reject.
      </p>

      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : (
        <>
          <div className="ov-card" style={{ marginBottom: 20 }}>
            <strong style={{ fontSize: 13 }}>Request a refund</strong>
            {tickets.length === 0 ? (
              <p style={{ fontSize: 13, color: "#5A6560", marginTop: 8 }}>No available tickets to return.</p>
            ) : (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0" }}>
                  {tickets.map((tk) => (
                    <label
                      key={tk.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: selected.has(tk.id) ? "#E6F4EF" : "#F4F8F6",
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      <input type="checkbox" checked={selected.has(tk.id)} onChange={() => toggle(tk.id)} />
                      <span style={{ fontFamily: "'Space Mono', monospace" }}>{tk.number}</span>
                    </label>
                  ))}
                </div>
                <input
                  className="ov-input"
                  placeholder="Reason (optional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ marginBottom: 10 }}
                />
                <button className="ov-btn-sm primary" onClick={submit} disabled={sending || selected.size === 0}>
                  {sending ? "Sending…" : `Submit request (${selected.size})`}
                </button>
              </>
            )}
          </div>

          <h3 style={{ fontSize: 14, marginBottom: 10 }}>History</h3>
          <table className="ov-table">
            <thead>
              <tr>
                <th>Tickets</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {refunds.map((r) => (
                <tr key={r.id}>
                  <td>{(r.ticket_ids || []).length}</td>
                  <td>{r.reason || "—"}</td>
                  <td>
                    <span className={`ov-status-pill ${r.status}`}>{r.status}</span>
                  </td>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
