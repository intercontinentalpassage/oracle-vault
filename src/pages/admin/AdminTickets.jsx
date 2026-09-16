import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getCurrencySymbol, useSiteSettingsVersion } from "../../lib/siteSettingsStore";
import Dropdown from "../../components/Dropdown";

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
  const [agentFilter, setAgentFilter] = useState("");
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
  const [selectedPrice, setSelectedPrice] = useState("");
  const [priceEdits, setPriceEdits] = useState({});
  const [batchAgentId, setBatchAgentId] = useState("");
  const [batchPrice, setBatchPrice] = useState("");
  const [batchCurrency, setBatchCurrency] = useState("");
  const [randomCount, setRandomCount] = useState("");
  const [batching, setBatching] = useState(false);
  const [splitModal, setSplitModal] = useState(null); // { ticket, priceA, groupA, priceB, groupB }
  const [splitting, setSplitting] = useState(false);

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

  async function savePrice(id) {
    const value = priceEdits[id];
    if (value === undefined) return;
    await updateTicket(id, { price: Number(value) || 0 });
    setPriceEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
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

  function openSplitModal(tk) {
    if (tk.status !== "available" || tk.ticket_type === "single") return;
    const halfPrice = (Number(tk.price) || 0) / 2;
    setSplitModal({
      ticket: tk,
      priceA: String(halfPrice),
      groupA: tk.group_key,
      priceB: String(halfPrice),
      groupB: tk.group_key,
    });
  }

  async function confirmSplit() {
    if (!splitModal) return;
    setSplitting(true);
    setError("");
    try {
      const { ticket, priceA, groupA, priceB, groupB } = splitModal;
      const { error: updateError } = await supabase
        .from("tickets")
        .update({ price: Number(priceA) || 0, group_key: groupA, ticket_type: "single" })
        .eq("id", ticket.id);
      if (updateError) throw updateError;
      const { error: insertError } = await supabase.from("tickets").insert({
        number: ticket.number,
        group_key: groupB,
        price: Number(priceB) || 0,
        status: "available",
        draw_id: ticket.draw_id,
        agent_id: ticket.agent_id,
        ticket_type: "single",
      });
      if (insertError) throw insertError;
      setSplitModal(null);
      load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSplitting(false);
    }
  }

  async function recallTicket(tk) {
    if (tk.status !== "sold") return;
    if (!confirm(`Recall ${tk.number} back to available? This also removes its sale record, if any.`)) return;
    setError("");
    try {
      const { error: saleDeleteError } = await supabase.from("sales").delete().eq("ticket_id", tk.id);
      if (saleDeleteError) throw saleDeleteError;
      const { error: updateError } = await supabase.from("tickets").update({ status: "available" }).eq("id", tk.id);
      if (updateError) throw updateError;
      load();
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  function toggleSelected(id) {
    setRandomCount("");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendBatchToAgent() {
    const useRandom = randomCount.trim() !== "";
    if (!batchAgentId || (!useRandom && selected.size === 0)) return;
    setBatching(true);
    setError("");
    try {
      let ids;
      let shortBy = 0;
      if (useRandom) {
        const n = parseInt(randomCount, 10);
        if (!n || n <= 0) {
          setError("Enter a valid number of tickets.");
          return;
        }
        const pool = tickets.filter((t) => t.status === "available" && !t.agent_id);
        if (pool.length === 0) {
          setError("No available, unassigned tickets to send.");
          return;
        }
        const shuffled = [...pool].sort(() => Math.random() - 0.5);
        ids = shuffled.slice(0, Math.min(n, pool.length)).map((t) => t.id);
        shortBy = n - ids.length;
      } else {
        ids = tickets.filter((t) => selected.has(t.id) && t.status === "available" && !t.agent_id).map((t) => t.id);
      }
      if (ids.length === 0) {
        setError("None of the selected tickets are eligible (must be available and unassigned).");
        return;
      }
      const overridePrice = batchPrice.trim() === "" ? null : Number(batchPrice);
      const selectedTickets = tickets.filter((t) => ids.includes(t.id));
      const total = overridePrice !== null ? overridePrice * ids.length : selectedTickets.reduce((sum, t) => sum + (Number(t.price) || 0), 0);

      const ticketPatch = { agent_id: batchAgentId };
      if (overridePrice !== null) ticketPatch.price = overridePrice;
      const { error: ticketError } = await supabase.from("tickets").update(ticketPatch).in("id", ids);
      if (ticketError) throw ticketError;

      if (batchCurrency.trim() !== "") {
        const { error: currencyError } = await supabase
          .from("agents")
          .update({ currency_symbol: batchCurrency.trim() })
          .eq("id", batchAgentId);
        if (currencyError) throw currencyError;
      }

      const { error: invoiceError } = await supabase.from("invoices").insert({
        agent_id: batchAgentId,
        ticket_ids: ids,
        total,
      });
      if (invoiceError) throw invoiceError;

      setSelected(new Set());
      setBatchAgentId("");
      setBatchPrice("");
      setBatchCurrency("");
      setRandomCount("");
      if (shortBy > 0) {
        setError(`Only ${ids.length} eligible ticket(s) were available — sent all of them (${shortBy} short of the ${randomCount} requested).`);
      }
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

  async function setPriceForSelected() {
    if (selected.size === 0 || selectedPrice.trim() === "") return;
    setError("");
    const ids = [...selected];
    const { error: updateError } = await supabase.from("tickets").update({ price: Number(selectedPrice) || 0 }).in("id", ids);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSelectedPrice("");
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
    )
      .filter((t) => !search.trim() || t.number.includes(search.trim()))
      .filter((t) => {
        if (!agentFilter) return true;
        if (agentFilter === "none") return !t.agent_id;
        return t.agent_id === agentFilter;
      });

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
            <Dropdown className="ov-input" value={bulkGroup} onChange={(e) => setBulkGroup(e.target.value)}>
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </Dropdown>
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
            <Dropdown className="ov-input" value={bulkDrawId} onChange={(e) => setBulkDrawId(e.target.value)} required>
              <option value="">— select draw —</option>
              {upcomingDraws.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} ({d.draw_date})
                </option>
              ))}
            </Dropdown>
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
          sent (others are skipped) — or skip picking manually and just enter a random amount to send. Either way
          this creates an invoice recording the handoff. Optionally set a new price per ticket and/or the agent's
          shop currency before sending.
        </p>
        <div className="ov-form-row" style={{ alignItems: "flex-end" }}>
          <label>
            Agent
            <Dropdown
              className="ov-input"
              value={batchAgentId}
              onChange={(e) => {
                const id = e.target.value;
                setBatchAgentId(id);
                const chosen = agents.find((a) => a.id === id);
                setBatchCurrency(chosen?.currency_symbol || "");
              }}
            >
              <option value="">— select agent —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Dropdown>
          </label>
          <label>
            Price per ticket (optional)
            <input
              className="ov-input"
              type="number"
              value={batchPrice}
              onChange={(e) => setBatchPrice(e.target.value)}
              placeholder="Keep existing"
            />
          </label>
          <label>
            Agent currency (optional)
            <input
              className="ov-input"
              value={batchCurrency}
              onChange={(e) => setBatchCurrency(e.target.value)}
              placeholder={currency}
            />
          </label>
          <label>
            Or send random amount
            <input
              className="ov-input"
              type="number"
              min="1"
              value={randomCount}
              onChange={(e) => {
                setRandomCount(e.target.value);
                if (e.target.value.trim() !== "") setSelected(new Set());
              }}
              placeholder="e.g. 10"
            />
          </label>
          <button
            className="ov-btn-sm primary"
            onClick={sendBatchToAgent}
            disabled={batching || !batchAgentId || (randomCount.trim() === "" && selected.size === 0)}
          >
            {batching
              ? "Sending…"
              : randomCount.trim() !== ""
              ? `Send ${randomCount} random`
              : `Send ${selected.size} selected`}
          </button>
        </div>
      </div>

      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div className="ov-toolbar">
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Dropdown className="ov-input" style={{ width: 180, marginTop: 0 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="held">Held</option>
            <option value="sold">Sold</option>
            <option value="archived">Archived (past draw date)</option>
          </Dropdown>
          <Dropdown className="ov-input" style={{ width: 180, marginTop: 0 }} value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)}>
            <option value="">All</option>
            <option value="none">Storefront</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Dropdown>
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
            <>
              <input
                className="ov-input"
                style={{ width: 100, marginTop: 0 }}
                type="number"
                placeholder="Set price…"
                value={selectedPrice}
                onChange={(e) => setSelectedPrice(e.target.value)}
              />
              <button className="ov-btn-sm primary" onClick={setPriceForSelected} disabled={selectedPrice.trim() === ""}>
                Apply to {selected.size} selected
              </button>
              <button className="ov-btn-sm danger" onClick={deleteSelected}>
                Delete {selected.size} selected
              </button>
            </>
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
                <td>
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <input
                      className="ov-input"
                      type="number"
                      style={{ margin: 0, padding: "6px 8px", fontSize: 12, width: 80 }}
                      value={priceEdits[tk.id] ?? tk.price ?? 0}
                      onChange={(e) => setPriceEdits((prev) => ({ ...prev, [tk.id]: e.target.value }))}
                    />
                    {priceEdits[tk.id] !== undefined && (
                      <button className="ov-btn-sm primary" onClick={() => savePrice(tk.id)}>
                        Save
                      </button>
                    )}
                  </div>
                </td>
                <td>
                  <Dropdown
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
                  </Dropdown>
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
                  <Dropdown
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
                  </Dropdown>
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  {tk.status === "available" && tk.ticket_type !== "single" && (
                    <button className="ov-btn-sm" onClick={() => openSplitModal(tk)}>
                      Split
                    </button>
                  )}
                  {tk.status !== "sold" && (
                    <button className="ov-btn-sm" onClick={() => updateTicket(tk.id, { status: "sold" })}>
                      Mark sold
                    </button>
                  )}
                  {tk.status === "sold" && (
                    <button className="ov-btn-sm" onClick={() => recallTicket(tk)}>
                      Recall
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

      {splitModal && (
        <div className="ov-summary-overlay" onClick={() => !splitting && setSplitModal(null)} style={{ position: "fixed" }}>
          <div className="ov-summary-wrap" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="ov-summary-card">
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                Split ticket {splitModal.ticket.number}
              </div>
              <p style={{ fontSize: 13, color: "#5A6560", marginTop: 0, marginBottom: 14 }}>
                Currently {currency}
                {Number(splitModal.ticket.price).toLocaleString()} in "
                {groups.find((g) => g.key === splitModal.ticket.group_key)?.label || splitModal.ticket.group_key}".
                Set the price and group for each of the 2 resulting tickets.
              </p>

              {["A", "B"].map((half) => (
                <div key={half} style={{ marginTop: half === "A" ? 0 : 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Ticket {half}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="ov-input"
                      style={{ margin: 0, flex: 1 }}
                      type="number"
                      value={splitModal[`price${half}`]}
                      onChange={(e) => setSplitModal((prev) => ({ ...prev, [`price${half}`]: e.target.value }))}
                      placeholder="Price"
                    />
                    <Dropdown
                      className="ov-input"
                      style={{ margin: 0, flex: 1 }}
                      value={splitModal[`group${half}`]}
                      onChange={(e) => setSplitModal((prev) => ({ ...prev, [`group${half}`]: e.target.value }))}
                    >
                      {groups.map((g) => (
                        <option key={g.key} value={g.key}>
                          {g.label}
                        </option>
                      ))}
                    </Dropdown>
                  </div>
                </div>
              ))}

              {error && <p style={{ color: "#B23A2E", fontSize: 13, marginTop: 12 }}>{error}</p>}

              <button className="ov-btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={confirmSplit} disabled={splitting}>
                {splitting ? "Splitting…" : "Split"}
              </button>
              <button className="ov-btn-sm" style={{ width: "100%", marginTop: 8 }} onClick={() => setSplitModal(null)} disabled={splitting}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
