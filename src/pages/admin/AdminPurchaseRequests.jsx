import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getCurrencySymbol, useSiteSettingsVersion } from "../../lib/siteSettingsStore";

export default function AdminPurchaseRequests() {
  useSiteSettingsVersion();
  const currency = getCurrencySymbol();
  const [requests, setRequests] = useState([]);
  const [ticketsById, setTicketsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("pending");

  async function load() {
    setLoading(true);
    setError("");
    const { data: reqs, error: reqError } = await supabase
      .from("purchase_requests")
      .select("*")
      .order("created_at", { ascending: false });
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

      // Mark tickets sold.
      const { error: ticketError } = await supabase
        .from("tickets")
        .update({ status: "sold" })
        .in("id", req.ticket_ids);
      if (ticketError) throw ticketError;

      // Record a sale row per ticket.
      const perTicketPrice = req.ticket_ids.length ? req.total / req.ticket_ids.length : 0;
      const saleRows = req.ticket_ids.map((ticketId) => ({
        ticket_id: ticketId,
        customer_id: customerId,
        customer_phone: req.customer_phone,
        agent_id: req.agent_id,
        price: perTicketPrice,
      }));
      const { error: saleError } = await supabase.from("sales").insert(saleRows);
      if (saleError) throw saleError;

      // Mark the request confirmed.
      const { error: reqUpdateError } = await supabase
        .from("purchase_requests")
        .update({ status: "confirmed", decided_by: userId })
        .eq("id", req.id);
      if (reqUpdateError) throw reqUpdateError;

      load();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusyId(null);
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

  const filtered = statusFilter ? requests.filter((r) => r.status === statusFilter) : requests;

  return (
    <div>
      <h1>Purchase requests</h1>
      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div className="ov-toolbar">
        <select className="ov-input" style={{ width: 180, marginTop: 0 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
        <span style={{ fontSize: 12, color: "#5A6560" }}>{filtered.length} requests</span>
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
                {(req.ticket_ids || []).map((id) => (
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

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{currency}{Number(req.total || 0).toLocaleString()}</strong>
                {req.status === "pending" && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="ov-btn-sm danger" disabled={busyId === req.id} onClick={() => reject(req)}>
                      Reject
                    </button>
                    <button className="ov-btn-sm primary" disabled={busyId === req.id} onClick={() => approve(req)}>
                      {busyId === req.id ? "Approving…" : "Approve"}
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
