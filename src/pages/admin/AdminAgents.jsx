import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getCurrencySymbol, useSiteSettingsVersion } from "../../lib/siteSettingsStore";

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminAgents() {
  useSiteSettingsVersion();
  const siteCurrency = getCurrencySymbol();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const [detailFor, setDetailFor] = useState(null);
  const [detailSales, setDetailSales] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailEditing, setDetailEditing] = useState({});
  const [detailSelected, setDetailSelected] = useState(new Set());
  const [detailBulkPrice, setDetailBulkPrice] = useState("");

  async function openDetail(agent) {
    setDetailFor(agent);
    setDetailEditing({});
    setDetailSelected(new Set());
    setDetailBulkPrice("");
    setDetailLoading(true);
    const { data } = await supabase
      .from("sales")
      .select("id, price, sold_at, customer_phone, tickets(number)")
      .eq("agent_id", agent.id)
      .order("sold_at", { ascending: false });
    setDetailSales(data || []);
    setDetailLoading(false);
  }

  function toggleDetailSelected(id) {
    setDetailSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveDetailPrice(id) {
    const value = detailEditing[id];
    if (value === undefined) return;
    const { error: updateError } = await supabase.from("sales").update({ price: Number(value) || 0 }).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDetailSales((prev) => prev.map((s) => (s.id === id ? { ...s, price: Number(value) || 0 } : s)));
    setDetailEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function applyDetailBulkPrice() {
    if (detailSelected.size === 0 || detailBulkPrice.trim() === "") return;
    const ids = [...detailSelected];
    const newPrice = Number(detailBulkPrice) || 0;
    const { error: updateError } = await supabase.from("sales").update({ price: newPrice }).in("id", ids);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDetailSales((prev) => prev.map((s) => (ids.includes(s.id) ? { ...s, price: newPrice } : s)));
    setDetailBulkPrice("");
    setDetailSelected(new Set());
  }

  const detailTotal = detailSales.reduce((sum, s) => sum + (Number(s.price) || 0), 0);
  const detailCurrency = detailFor?.currency_symbol || siteCurrency;

  async function load() {
    setLoading(true);
    const { data, error: loadError } = await supabase.from("agents").select("*").order("name");
    if (loadError) setError(loadError.message);
    setAgents(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addAgent() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const slug = slugify(name);
    const { error: insertError } = await supabase.from("agents").insert({
      name: name.trim(),
      phone: phone.trim() || null,
      slug,
      active: true,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setName("");
    setPhone("");
    load();
  }

  async function toggleActive(agent) {
    const { error: updateError } = await supabase
      .from("agents")
      .update({ active: !agent.active })
      .eq("id", agent.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    load();
  }

  return (
    <div>
      <h1>Agents</h1>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Add agent</strong>
        <div className="ov-form-row" style={{ marginTop: 10 }}>
          <label>
            Name
            <input className="ov-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name" />
          </label>
          <label>
            Phone
            <input className="ov-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
          </label>
        </div>
        {name.trim() && (
          <p style={{ fontSize: 12, color: "#5A6560", marginBottom: 10 }}>
            Shop link will be: <code>/shop/{slugify(name)}</code>
          </p>
        )}
        <button className="ov-btn-sm primary" onClick={addAgent} disabled={saving || !name.trim()}>
          {saving ? "Adding…" : "Add agent"}
        </button>
      </div>

      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : (
        <div className="ov-table-wrap"><table className="ov-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Shop link</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} onClick={() => openDetail(a)} style={{ cursor: "pointer" }}>
                <td>{a.name}</td>
                <td>{a.phone || "—"}</td>
                <td>
                  <code style={{ fontSize: 12 }}>/shop/{a.slug}</code>
                </td>
                <td>
                  <span className={`ov-status-pill ${a.active ? "available" : "sold"}`}>
                    {a.active ? "active" : "inactive"}
                  </span>
                </td>
                <td>
                  <button
                    className="ov-btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleActive(a);
                    }}
                  >
                    {a.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      {detailFor && (
        <div className="ov-summary-overlay" onClick={() => setDetailFor(null)} style={{ position: "fixed" }}>
          <div className="ov-summary-wrap" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="ov-summary-card">
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{detailFor.name}</div>
              <p style={{ fontSize: 13, color: "#5A6560", marginTop: 0, marginBottom: 14 }}>
                {detailFor.phone || "No phone on file"}
              </p>

              {detailLoading ? (
                <p style={{ color: "#5A6560", fontSize: 13 }}>Loading…</p>
              ) : detailSales.length === 0 ? (
                <p style={{ color: "#5A6560", fontSize: 13 }}>No sales yet.</p>
              ) : (
                <>
                  {detailSelected.size > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <input
                        className="ov-input"
                        style={{ margin: 0, width: 90, padding: "6px 8px", fontSize: 12 }}
                        type="number"
                        placeholder="Set price…"
                        value={detailBulkPrice}
                        onChange={(e) => setDetailBulkPrice(e.target.value)}
                      />
                      <button
                        className="ov-btn-sm primary"
                        onClick={applyDetailBulkPrice}
                        disabled={detailBulkPrice.trim() === ""}
                      >
                        Apply to {detailSelected.size}
                      </button>
                    </div>
                  )}
                  <div style={{ maxHeight: 320, overflowY: "auto" }}>
                    {detailSales.map((s) => (
                      <div
                        key={s.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 0",
                          borderBottom: "1px solid #F0F3F1",
                          fontSize: 14,
                        }}
                      >
                        <input type="checkbox" checked={detailSelected.has(s.id)} onChange={() => toggleDetailSelected(s.id)} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "'Space Mono', monospace" }}>{s.tickets?.number || "—"}</div>
                          <div style={{ fontSize: 12, color: "#5A6560" }}>
                            {s.customer_phone} · {new Date(s.sold_at).toLocaleDateString()}
                          </div>
                        </div>
                        <input
                          className="ov-input"
                          style={{ margin: 0, width: 80, padding: "6px 8px", fontSize: 12 }}
                          type="number"
                          value={detailEditing[s.id] ?? s.price ?? 0}
                          onChange={(e) => setDetailEditing((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        />
                        {detailEditing[s.id] !== undefined && (
                          <button className="ov-btn-sm primary" onClick={() => saveDetailPrice(s.id)}>
                            Save
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTop: "1px solid #E7EBE9" }}>
                <strong style={{ fontSize: 14 }}>Total</strong>
                <strong style={{ fontSize: 16 }}>
                  {detailCurrency}
                  {detailTotal.toLocaleString()}
                </strong>
              </div>

              <button className="ov-btn-sm" style={{ width: "100%", marginTop: 16 }} onClick={() => setDetailFor(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
