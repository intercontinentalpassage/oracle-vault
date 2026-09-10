import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminRefunds() {
  const [refunds, setRefunds] = useState([]);
  const [agentsById, setAgentsById] = useState({});
  const [ticketsById, setTicketsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    const { data: rows, error: loadError } = await supabase
      .from("refunds")
      .select("*")
      .order("created_at", { ascending: false });
    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }
    setRefunds(rows || []);

    const agentIds = [...new Set((rows || []).map((r) => r.agent_id).filter(Boolean))];
    const ticketIds = [...new Set((rows || []).flatMap((r) => r.ticket_ids || []))];
    const [agentsRes, ticketsRes] = await Promise.all([
      agentIds.length ? supabase.from("agents").select("*").in("id", agentIds) : { data: [] },
      ticketIds.length ? supabase.from("tickets").select("*").in("id", ticketIds) : { data: [] },
    ]);
    const aMap = {};
    (agentsRes.data || []).forEach((a) => (aMap[a.id] = a));
    setAgentsById(aMap);
    const tMap = {};
    (ticketsRes.data || []).forEach((t) => (tMap[t.id] = t));
    setTicketsById(tMap);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(refund, approve) {
    setBusyId(refund.id);
    setError("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (approve) {
        const { error: ticketError } = await supabase
          .from("tickets")
          .update({ status: "available", agent_id: null })
          .in("id", refund.ticket_ids);
        if (ticketError) throw ticketError;
      }
      const { error: updateError } = await supabase
        .from("refunds")
        .update({ status: approve ? "approved" : "rejected", decided_by: sess.session?.user?.id })
        .eq("id", refund.id);
      if (updateError) throw updateError;
      load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  const pending = refunds.filter((r) => r.status === "pending");
  const decided = refunds.filter((r) => r.status !== "pending");

  return (
    <div>
      <h1>Refund requests</h1>
      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : (
        <>
          <h3 style={{ fontSize: 14, marginBottom: 10 }}>Pending ({pending.length})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
            {pending.length === 0 && <p style={{ color: "#5A6560", fontSize: 13 }}>Nothing pending.</p>}
            {pending.map((r) => (
              <div className="ov-card" key={r.id}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <strong>{agentsById[r.agent_id]?.name || "Unknown agent"}</strong>
                    <div style={{ fontSize: 12, color: "#5A6560", marginTop: 2 }}>
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                  <span className="ov-status-pill pending">pending</span>
                </div>
                {r.reason && <p style={{ fontSize: 13, margin: "10px 0" }}>{r.reason}</p>}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
                  {(r.ticket_ids || []).map((id) => (
                    <span
                      key={id}
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: 13,
                        background: "#F4F8F6",
                        padding: "4px 10px",
                        borderRadius: 8,
                      }}
                    >
                      {ticketsById[id]?.number || id.slice(0, 8)}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button className="ov-btn-sm danger" disabled={busyId === r.id} onClick={() => decide(r, false)}>
                    Reject
                  </button>
                  <button className="ov-btn-sm primary" disabled={busyId === r.id} onClick={() => decide(r, true)}>
                    {busyId === r.id ? "Working…" : "Approve"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ fontSize: 14, marginBottom: 10 }}>Decided</h3>
          <table className="ov-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Tickets</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {decided.map((r) => (
                <tr key={r.id}>
                  <td>{agentsById[r.agent_id]?.name || "—"}</td>
                  <td>{(r.ticket_ids || []).length}</td>
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
