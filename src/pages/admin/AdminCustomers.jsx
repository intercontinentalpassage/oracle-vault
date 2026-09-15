import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getCurrencySymbol, useSiteSettingsVersion } from "../../lib/siteSettingsStore";

export default function AdminCustomers() {
  useSiteSettingsVersion();
  const currency = getCurrencySymbol();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [detailFor, setDetailFor] = useState(null);
  const [detailSales, setDetailSales] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  async function openDetail(customer) {
    setDetailFor(customer);
    setDetailLoading(true);
    const { data } = await supabase
      .from("sales")
      .select("price, sold_at, tickets(number)")
      .eq("customer_phone", customer.phone)
      .order("sold_at", { ascending: false });
    setDetailSales(data || []);
    setDetailLoading(false);
  }

  const detailTotal = detailSales.reduce((sum, s) => sum + (Number(s.price) || 0), 0);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    setCustomers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addCustomer() {
    const cleanPhone = phone.trim();
    if (!/^\d{6,}$/.test(cleanPhone.replace(/\s|-/g, ""))) {
      setError("Enter a valid phone number.");
      return;
    }
    setSaving(true);
    setError("");
    const { error: insertError } = await supabase.from("customers").insert({
      phone: cleanPhone,
      name: name.trim() || null,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.code === "23505" ? "A customer with that phone number already exists." : insertError.message);
      return;
    }
    setPhone("");
    setName("");
    load();
  }

  const filtered = customers.filter(
    (c) =>
      !search ||
      c.phone.includes(search) ||
      (c.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <h1>Customers</h1>
      <p style={{ fontSize: 13, color: "#5A6560", marginTop: -14, marginBottom: 20 }}>
        Customers are added automatically the first time you approve one of their purchase requests — or add one
        manually below (useful for walk-in or phone orders).
      </p>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Add customer</strong>
        <div className="ov-form-row" style={{ marginTop: 10, alignItems: "flex-end" }}>
          <label>
            Phone
            <input className="ov-input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </label>
          <label>
            Name
            <input className="ov-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
          </label>
          <button className="ov-btn-sm primary" onClick={addCustomer} disabled={saving || !phone.trim()}>
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
        {error && <p style={{ color: "#B23A2E", fontSize: 13, marginTop: 4 }}>{error}</p>}
      </div>

      <div className="ov-toolbar">
        <input
          className="ov-input"
          style={{ width: 240, marginTop: 0 }}
          placeholder="Search phone or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 12, color: "#5A6560" }}>{filtered.length} customers</span>
      </div>

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : (
        <div className="ov-table-wrap"><table className="ov-table">
          <thead>
            <tr>
              <th>Phone</th>
              <th>Name</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} onClick={() => openDetail(c)} style={{ cursor: "pointer" }}>
                <td>{c.phone}</td>
                <td>{c.name || "—"}</td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}

      {detailFor && (
        <div className="ov-summary-overlay" onClick={() => setDetailFor(null)} style={{ position: "fixed" }}>
          <div className="ov-summary-wrap" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="ov-summary-card">
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
                {detailFor.name || detailFor.phone}
              </div>
              <p style={{ fontSize: 13, color: "#5A6560", marginTop: 0, marginBottom: 14 }}>{detailFor.phone}</p>

              {detailLoading ? (
                <p style={{ color: "#5A6560", fontSize: 13 }}>Loading…</p>
              ) : detailSales.length === 0 ? (
                <p style={{ color: "#5A6560", fontSize: 13 }}>No purchases yet.</p>
              ) : (
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {detailSales.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: "1px solid #F0F3F1",
                        fontSize: 14,
                      }}
                    >
                      <div>
                        <div style={{ fontFamily: "'Space Mono', monospace" }}>{s.tickets?.number || "—"}</div>
                        <div style={{ fontSize: 12, color: "#5A6560" }}>{new Date(s.sold_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ fontWeight: 600 }}>
                        {currency}
                        {Number(s.price).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTop: "1px solid #E7EBE9" }}>
                <strong style={{ fontSize: 14 }}>Total</strong>
                <strong style={{ fontSize: 16 }}>
                  {currency}
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
