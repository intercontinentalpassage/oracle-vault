import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminTickets() {
  const [tickets, setTickets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [bulkNumbers, setBulkNumbers] = useState("");
  const [bulkGroup, setBulkGroup] = useState("single");
  const [bulkPrice, setBulkPrice] = useState("80");
  const [adding, setAdding] = useState(false);

  const [selected, setSelected] = useState(new Set());
  const [batchAgentId, setBatchAgentId] = useState("");
  const [batching, setBatching] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const [ticketsRes, groupsRes, agentsRes] = await Promise.all([
      supabase.from("tickets").select("*").order("created_at", { ascending: false }),
      supabase.from("groups").select("*").order("sort_order"),
      supabase.from("agents").select("*").order("name"),
    ]);
    if (ticketsRes.error) setError(ticketsRes.error.message);
    setTickets(ticketsRes.data || []);
    setGroups(groupsRes.data || []);
    setAgents(agentsRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addBulk() {
    const numbers = bulkNumbers
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (numbers.length === 0) return;
    setAdding(true);
    setError("");
    const rows = numbers.map((number) => ({
      number,
      group_key: bulkGroup,
      price: Number(bulkPrice) || 0,
      status: "available",
    }));
    const { error: insertError } = await supabase.from("tickets").insert(rows);
    setAdding(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setBulkNumbers("");
    load();
  }

  async function updateTicket(id, patch) {
    const { error: updateError } = await supabase.from("tickets").update(patch).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    load();
  }

  async function deleteTicket(id) {
    if (!confirm("Delete this ticket permanently?")) return;
    const { error: deleteError } = await supabase.from("tickets").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    load();
  }

  function toggleSelected(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendBatchToAgent() {
    if (!batchAgentId || selected.size === 0) return;
    setBatching(true);
    setError("");
    try {
      const ids = [...selected];
      const selectedTickets = tickets.filter((t) => ids.includes(t.id));
      const total = selectedTickets.reduce((sum, t) => sum + (Number(t.price) || 0), 0);

      const { error: ticketError } = await supabase.from("tickets").update({ agent_id: batchAgentId }).in("id", ids);
      if (ticketError) throw ticketError;

      const { error: invoiceError } = await supabase.from("invoices").insert({
        agent_id: batchAgentId,
        ticket_ids: ids,
        total,
      });
      if (invoiceError) throw invoiceError;

      setSelected(new Set());
      setBatchAgentId("");
      load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBatching(false);
    }
  }

  const filtered = statusFilter ? tickets.filter((t) => t.status === statusFilter) : tickets;

  return (
    <div>
      <h1>Tickets</h1>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Add tickets</strong>
        <p style={{ fontSize: 12, color: "#5A6560", margin: "4px 0 12px" }}>
          Paste ticket numbers separated by spaces, commas, or newlines — all added with the same group and price.
        </p>
        <textarea
          className="ov-input"
          rows={3}
          placeholder="123456, 654321, 112233…"
          value={bulkNumbers}
          onChange={(e) => setBulkNumbers(e.target.value)}
        />
        <div className="ov-form-row" style={{ marginTop: 10 }}>
          <label>
            Group
            <select className="ov-input" value={bulkGroup} onChange={(e) => setBulkGroup(e.target.value)}>
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Price (฿)
            <input
              className="ov-input"
              type="number"
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value)}
            />
          </label>
        </div>
        <button className="ov-btn-sm primary" onClick={addBulk} disabled={adding}>
          {adding ? "Adding…" : "Add tickets"}
        </button>
      </div>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Send batch to agent</strong>
        <p style={{ fontSize: 12, color: "#5A6560", margin: "4px 0 12px" }}>
          Check tickets below (only unassigned, available ones can be sent), pick an agent, and this creates an
          invoice recording the handoff.
        </p>
        <div className="ov-form-row" style={{ alignItems: "flex-end" }}>
          <label>
            Agent
            <select className="ov-input" value={batchAgentId} onChange={(e) => setBatchAgentId(e.target.value)}>
              <option value="">— select agent —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="ov-btn-sm primary"
            onClick={sendBatchToAgent}
            disabled={batching || !batchAgentId || selected.size === 0}
          >
            {batching ? "Sending…" : `Send ${selected.size} selected`}
          </button>
        </div>
      </div>

      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div className="ov-toolbar">
        <select className="ov-input" style={{ width: 180, marginTop: 0 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="available">Available</option>
          <option value="held">Held</option>
          <option value="sold">Sold</option>
        </select>
        <span style={{ fontSize: 12, color: "#5A6560" }}>{filtered.length} tickets</span>
      </div>

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : (
        <table className="ov-table">
          <thead>
            <tr>
              <th></th>
              <th>Number</th>
              <th>Group</th>
              <th>Price</th>
              <th>Status</th>
              <th>Agent</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tk) => (
              <tr key={tk.id}>
                <td>
                  {tk.status === "available" && !tk.agent_id && (
                    <input type="checkbox" checked={selected.has(tk.id)} onChange={() => toggleSelected(tk.id)} />
                  )}
                </td>
                <td style={{ fontFamily: "'Space Mono', monospace" }}>{tk.number}</td>
                <td>{groups.find((g) => g.key === tk.group_key)?.label || tk.group_key}</td>
                <td>฿{Number(tk.price || 0).toLocaleString()}</td>
                <td>
                  <span className={`ov-status-pill ${tk.status}`}>{tk.status}</span>
                </td>
                <td>
                  <select
                    className="ov-input"
                    style={{ margin: 0, padding: "6px 8px", fontSize: 12 }}
                    value={tk.agent_id || ""}
                    onChange={(e) => updateTicket(tk.id, { agent_id: e.target.value || null })}
                  >
                    <option value="">— none —</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  {tk.status !== "sold" && (
                    <button className="ov-btn-sm" onClick={() => updateTicket(tk.id, { status: "sold" })}>
                      Mark sold
                    </button>
                  )}
                  <button className="ov-btn-sm danger" onClick={() => deleteTicket(tk.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
