import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getCurrencySymbol, useSiteSettingsVersion } from "../../lib/siteSettingsStore";

export default function AdminTickets() {
  useSiteSettingsVersion();
  const currency = getCurrencySymbol();
  const [tickets, setTickets] = useState([]);
  const [groups, setGroups] = useState([]);
  const [agents, setAgents] = useState([]);
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [bulkNumbers, setBulkNumbers] = useState("");
  const [bulkGroup, setBulkGroup] = useState("single");
  const [bulkPrice, setBulkPrice] = useState("80");
  const [bulkDrawId, setBulkDrawId] = useState("");
  const [adding, setAdding] = useState(false);

  const [newDrawLabel, setNewDrawLabel] = useState("");
  const [newDrawDate, setNewDrawDate] = useState("");
  const [creatingDraw, setCreatingDraw] = useState(false);
  const [showNewDraw, setShowNewDraw] = useState(false);

  const [selected, setSelected] = useState(new Set());
  const [batchAgentId, setBatchAgentId] = useState("");
  const [batching, setBatching] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    const [ticketsRes, groupsRes, agentsRes, drawsRes] = await Promise.all([
      supabase.from("tickets").select("*").order("created_at", { ascending: false }),
      supabase.from("groups").select("*").order("sort_order"),
      supabase.from("agents").select("*").order("name"),
      supabase.from("draws").select("*").order("draw_date", { ascending: false }),
    ]);
    if (ticketsRes.error) setError(ticketsRes.error.message);
    setTickets(ticketsRes.data || []);
    setGroups(groupsRes.data || []);
    setAgents(agentsRes.data || []);
    setDraws(drawsRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createDrawInline() {
    if (!newDrawLabel.trim() || !newDrawDate) return;
    setCreatingDraw(true);
    setError("");
    const { data, error: insertError } = await supabase
      .from("draws")
      .insert({ label: newDrawLabel.trim(), draw_date: newDrawDate, tiers: [], published: false })
      .select()
      .single();
    setCreatingDraw(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDraws((prev) => [data, ...prev]);
    setBulkDrawId(data.id);
    setNewDrawLabel("");
    setNewDrawDate("");
    setShowNewDraw(false);
  }

  async function addBulk() {
    const numbers = bulkNumbers
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (numbers.length === 0 || !bulkDrawId) return;
    setAdding(true);
    setError("");
    const rows = numbers.map((number) => ({
      number,
      group_key: bulkGroup,
      price: Number(bulkPrice) || 0,
      status: "available",
      draw_id: bulkDrawId,
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
      const ids = tickets.filter((t) => selected.has(t.id) && t.status === "available" && !t.agent_id).map((t) => t.id);
      if (ids.length === 0) {
        setError("None of the selected tickets are eligible (must be available and unassigned).");
        return;
      }
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

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected ticket(s) permanently? This can't be undone.`)) return;
    setError("");
    const ids = [...selected];
    const { error: deleteError } = await supabase.from("tickets").delete().in("id", ids);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setSelected(new Set());
    load();
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcomingDraws = draws.filter((d) => d.draw_date >= today).sort((a, b) => (a.draw_date < b.draw_date ? -1 : 1));
  const drawDateById = {};
  draws.forEach((d) => (drawDateById[d.id] = d.draw_date));
  function isExpired(tk) {
    return !!(tk.draw_id && drawDateById[tk.draw_id] && drawDateById[tk.draw_id] < today);
  }

  const filtered =
    (statusFilter === "archived"
      ? tickets.filter(isExpired)
      : (statusFilter ? tickets.filter((t) => t.status === statusFilter) : tickets).filter((t) => !isExpired(t))
    ).filter((t) => !search.trim() || t.number.includes(search.trim()));

  const allFilteredSelected = filtered.length > 0 && filtered.every((tk) => selected.has(tk.id));
  function toggleSelectAll() {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((tk) => next.delete(tk.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((tk) => next.add(tk.id));
      return next;
    });
  }

  return (
    <div>
      <h1>Tickets</h1>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Add tickets</strong>
        <p style={{ fontSize: 12, color: "#5A6560", margin: "4px 0 12px" }}>
          Paste ticket numbers separated by spaces, commas, or newlines — all added with the same group, price, and
          draw. The draw you pick here is what shows as "Next draw" on the storefront while these tickets are for sale.
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
            Price ({currency})
            <input
              className="ov-input"
              type="number"
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value)}
            />
          </label>
          <label>
            Draw <span style={{ color: "#B23A2E" }}>*</span>
            <select className="ov-input" value={bulkDrawId} onChange={(e) => setBulkDrawId(e.target.value)} required>
              <option value="">— select draw —</option>
              {upcomingDraws.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} ({d.draw_date})
                </option>
              ))}
            </select>
          </label>
        </div>
        {!bulkDrawId && (
          <p style={{ fontSize: 12, color: "#B23A2E", marginTop: -6, marginBottom: 10 }}>
            Select or create a draw before adding tickets — every ticket needs one. Only upcoming draws are
            selectable here, since tickets tied to a past draw would disappear from the storefront immediately.
          </p>
        )}

        {showNewDraw ? (
          <div className="ov-form-row" style={{ alignItems: "flex-end", marginTop: 6 }}>
            <label>
              New draw label
              <input
                className="ov-input"
                value={newDrawLabel}
                onChange={(e) => setNewDrawLabel(e.target.value)}
                placeholder="16 September 2026"
              />
            </label>
            <label>
              Draw date
              <input
                className="ov-input"
                type="date"
                value={newDrawDate}
                onChange={(e) => setNewDrawDate(e.target.value)}
              />
            </label>
            <button
              className="ov-btn-sm primary"
              onClick={createDrawInline}
              disabled={creatingDraw || !newDrawLabel.trim() || !newDrawDate}
            >
              {creatingDraw ? "Creating…" : "Create & use"}
            </button>
            <button className="ov-btn-sm" onClick={() => setShowNewDraw(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="ov-btn-sm" style={{ marginBottom: 14 }} onClick={() => setShowNewDraw(true)}>
            + New draw
          </button>
        )}

        <div>
          <button className="ov-btn-sm primary" onClick={addBulk} disabled={adding || !bulkDrawId || !bulkNumbers.trim()}>
            {adding ? "Adding…" : "Add tickets"}
          </button>
        </div>
      </div>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Send batch to agent</strong>
        <p style={{ fontSize: 12, color: "#5A6560", margin: "4px 0 12px" }}>
          Check tickets below and pick an agent — only available, unassigned ones among your selection actually get
          sent (others are skipped), and this creates an invoice recording the handoff.
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
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select className="ov-input" style={{ width: 180, marginTop: 0 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="held">Held</option>
            <option value="sold">Sold</option>
            <option value="archived">Archived (past draw date)</option>
          </select>
          <input
            className="ov-input"
            style={{ width: 180, marginTop: 0 }}
            placeholder="Search ticket number…"
            value={search}
            onChange={(e) => setSearch(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {selected.size > 0 && (
            <button className="ov-btn-sm danger" onClick={deleteSelected}>
              Delete {selected.size} selected
            </button>
          )}
          <span style={{ fontSize: 12, color: "#5A6560" }}>{filtered.length} tickets</span>
        </div>
      </div>

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : (
        <div className="ov-table-wrap"><table className="ov-table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} />
              </th>
              <th>Number</th>
              <th>Group</th>
              <th>Price</th>
              <th>Draw</th>
              <th>Status</th>
              <th>Agent</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: "center", color: "#5A6560", padding: "40px 12px" }}>
                  No tickets match your search/filter.
                </td>
              </tr>
            )}
            {filtered.map((tk) => (
              <tr key={tk.id}>
                <td>
                  <input type="checkbox" checked={selected.has(tk.id)} onChange={() => toggleSelected(tk.id)} />
                </td>
                <td style={{ fontFamily: "'Space Mono', monospace" }}>{tk.number}</td>
                <td>{groups.find((g) => g.key === tk.group_key)?.label || tk.group_key}</td>
                <td>{currency}{Number(tk.price || 0).toLocaleString()}</td>
                <td>
                  <select
                    className="ov-input"
                    style={{ margin: 0, padding: "6px 8px", fontSize: 12 }}
                    value={tk.draw_id || ""}
                    onChange={(e) => updateTicket(tk.id, { draw_id: e.target.value || null })}
                  >
                    <option value="">— none —</option>
                    {draws.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <span className={`ov-status-pill ${tk.status}`}>{tk.status}</span>
                  {isExpired(tk) && (
                    <span className="ov-status-pill" style={{ marginLeft: 6, background: "#F0F3F1", color: "#5A6560" }}>
                      expired
                    </span>
                  )}
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
        </table></div>
      )}
    </div>
  );
}
