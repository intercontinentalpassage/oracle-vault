import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getCurrencySymbol, useSiteSettingsVersion } from "../../lib/siteSettingsStore";
import Dropdown from "../../components/Dropdown";

export default function AdminPurchaseRequests() {
  useSiteSettingsVersion();
  const currency = getCurrencySymbol();
  const [requests, setRequests] = useState([]);
  const [ticketsById, setTicketsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const inFlightRef = useRef(new Set());
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selections, setSelections] = useState({});
  const [groups, setGroups] = useState([]);
  const [groupReassignments, setGroupReassignments] = useState({});
  const [clearing, setClearing] = useState(false);

  function getSelected(req) {
    return selections[req.id] || new Set(req.ticket_ids || []);
  }

  function toggleTicketSelection(req, ticketId) {
    setSelections((prev) => {
      const current = new Set(prev[req.id] || req.ticket_ids || []);
      if (current.has(ticketId)) current.delete(ticketId);
      else current.add(ticketId);
      return { ...prev, [req.id]: current };
    });
  }

  function getGroupChoice(ticketId) {
    return groupReassignments[ticketId] ?? ticketsById[ticketId]?.group_key ?? "";
  }

  async function load() {
    setLoading(true);
    setError("");
    const [{ data: reqs, error: reqError }, { data: grps }] = await Promise.all([
      supabase.from("purchase_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("groups").select("*").order("sort_order"),
    ]);
    setGroups(grps || []);
    if (reqError) {
      setError(reqError.message);
      setLoading(false);
      return;
    }
    setRequests(reqs || []);

    const allTicketIds = [...new Set((reqs || []).flatMap((r) => r.ticket_ids || []))];
    if (allTicketIds.length > 0) {
      const { data: tks } = await supabase.from("tickets").select("*").in("id", allTicketIds);
      const map = {};
      (tks || []).forEach((tk) => (map[tk.id] = tk));
      setTicketsById(map);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(req) {
    if (inFlightRef.current.has(req.id)) return;
    inFlightRef.current.add(req.id);
    const selectedIds = [...getSelected(req)];
    if (selectedIds.length === 0) {
      inFlightRef.current.delete(req.id);
      return;
    }
    setBusyId(req.id);
    setError("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user?.id;

      // Upsert the customer record.
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", req.customer_phone)
        .maybeSingle();
      let customerId = existingCustomer?.id;
      if (!customerId) {
        const { data: newCustomer, error: custError } = await supabase
          .from("customers")
          .insert({ phone: req.customer_phone, name: req.customer_name })
          .select()
          .single();
        if (custError) throw custError;
        customerId = newCustomer.id;
      }

      // Mark only the approved tickets sold — anything left unchecked simply
      // stays "available", same as any other single ticket.
      const { error: ticketError } = await supabase
        .from("tickets")
        .update({ status: "sold" })
        .in("id", selectedIds);
      if (ticketError) throw ticketError;

      // Any OTHER pending request that also references one of these
      // now-sold tickets loses that ticket automatically — if that leaves
      // it with nothing, it's marked expired instead of staying stuck
      // pending forever with no way to fulfill it.
      const { data: otherPending } = await supabase
        .from("purchase_requests")
        .select("*")
        .eq("status", "pending")
        .neq("id", req.id)
        .overlaps("ticket_ids", selectedIds);

      for (const other of otherPending || []) {
        const remaining = (other.ticket_ids || []).filter((id) => !selectedIds.includes(id));
        const otherPerTicketPrice = other.ticket_ids.length ? other.total / other.ticket_ids.length : 0;
        const { error: expireError } = await supabase
          .from("purchase_requests")
          .update({
            ticket_ids: remaining,
            total: otherPerTicketPrice * remaining.length,
            status: remaining.length === 0 ? "expired" : "pending",
          })
          .eq("id", other.id);
        if (expireError) throw expireError;
      }

      // Record a sale row per approved ticket, using the original per-ticket price.
      const perTicketPrice = req.ticket_ids.length ? req.total / req.ticket_ids.length : 0;
      const saleRows = selectedIds.map((ticketId) => ({
        ticket_id: ticketId,
        customer_id: customerId,
        customer_phone: req.customer_phone,
        agent_id: req.agent_id,
        price: perTicketPrice,
      }));
      const { error: saleError } = await supabase.from("sales").insert(saleRows);
      if (saleError) throw saleError;

      // The request itself is confirmed for exactly what was approved —
      // any unchecked tickets drop out of it and go back to being ordinary
      // available singles, un-tied to this (or any) request. If the admin
      // picked a different group for any of them, move them there too.
      const leftoverIds = (req.ticket_ids || []).filter((id) => !selectedIds.includes(id));
      const leftoverByGroup = {};
      leftoverIds.forEach((id) => {
        const group = getGroupChoice(id);
        if (!leftoverByGroup[group]) leftoverByGroup[group] = [];
        leftoverByGroup[group].push(id);
      });
      for (const [group, ids] of Object.entries(leftoverByGroup)) {
        const { error: groupError } = await supabase.from("tickets").update({ group_key: group }).in("id", ids);
        if (groupError) throw groupError;
      }

      const { error: reqUpdateError } = await supabase
        .from("purchase_requests")
        .update({
          status: "confirmed",
          decided_by: userId,
          ticket_ids: selectedIds,
          total: perTicketPrice * selectedIds.length,
        })
        .eq("id", req.id);
      if (reqUpdateError) throw reqUpdateError;

      setSelections((prev) => {
        const next = { ...prev };
        delete next[req.id];
        return next;
      });
      setGroupReassignments((prev) => {
        const next = { ...prev };
        leftoverIds.forEach((id) => delete next[id]);
        return next;
      });
      load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusyId(null);
      inFlightRef.current.delete(req.id);
    }
  }

  async function reject(req) {
    setBusyId(req.id);
    setError("");
    const { data: sess } = await supabase.auth.getSession();
    const { error: updateError } = await supabase
      .from("purchase_requests")
      .update({ status: "rejected", decided_by: sess.session?.user?.id })
      .eq("id", req.id);
    setBusyId(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    load();
  }

  async function clearExpired() {
    if (!confirm("Permanently delete all expired requests? This can't be undone.")) return;
    setClearing(true);
    setError("");
    const { error: deleteError } = await supabase.from("purchase_requests").delete().eq("status", "expired");
    setClearing(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    load();
  }

  const filtered = statusFilter ? requests.filter((r) => r.status === statusFilter) : requests;

  return (
    <div>
      <h1>Purchase requests</h1>
      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div className="ov-toolbar">
        <Dropdown className="ov-input" style={{ width: 180, marginTop: 0 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
          <option value="">All</option>
        </Dropdown>
        <span style={{ fontSize: 12, color: "#5A6560" }}>{filtered.length} requests</span>
        {statusFilter === "expired" && filtered.length > 0 && (
          <button className="ov-btn-sm danger" onClick={clearExpired} disabled={clearing}>
            {clearing ? "Clearing…" : `Clear all expired (${filtered.length})`}
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "#5A6560" }}>Nothing here.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((req) => (
            <div className="ov-card" key={req.id}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <strong>{req.customer_name || "—"}</strong>{" "}
                  <span style={{ color: "#5A6560", fontSize: 13 }}>{req.customer_phone}</span>
                  <div style={{ fontSize: 12, color: "#5A6560", marginTop: 2 }}>
                    {new Date(req.created_at).toLocaleString()}
                  </div>
                </div>
                <span className={`ov-status-pill ${req.status}`}>{req.status}</span>
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0" }}>
                {(req.ticket_ids || []).map((id) => {
                  const isPending = req.status === "pending";
                  const checked = isPending ? getSelected(req).has(id) : true;
                  return (
                    <div
                      key={id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: "#F4F8F6",
                        padding: "4px 10px",
                        borderRadius: 8,
                        opacity: isPending && !checked ? 0.7 : 1,
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontFamily: "'Space Mono', monospace",
                          fontSize: 13,
                          cursor: isPending ? "pointer" : "default",
                        }}
                      >
                        {isPending && (
                          <input type="checkbox" checked={checked} onChange={() => toggleTicketSelection(req, id)} />
                        )}
                        {ticketsById[id]?.number || id.slice(0, 8)}
                      </label>
                      {isPending && !checked && (
                        <Dropdown
                          className="ov-input"
                          fit
                          style={{ margin: 0, padding: "2px 6px", fontSize: 11 }}
                          value={getGroupChoice(id)}
                          onChange={(e) =>
                            setGroupReassignments((prev) => ({ ...prev, [id]: e.target.value }))
                          }
                        >
                          {groups.map((g) => (
                            <option key={g.key} value={g.key}>
                              {g.label}
                            </option>
                          ))}
                        </Dropdown>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{currency}{Number(req.total || 0).toLocaleString()}</strong>
                {req.status === "pending" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="ov-btn-sm danger" disabled={busyId === req.id} onClick={() => reject(req)}>
                      Reject
                    </button>
                    <button
                      className="ov-btn-sm primary"
                      disabled={busyId === req.id || getSelected(req).size === 0}
                      onClick={() => approve(req)}
                    >
                      {busyId === req.id ? "Approving…" : `Approve (${getSelected(req).size}/${(req.ticket_ids || []).length})`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
