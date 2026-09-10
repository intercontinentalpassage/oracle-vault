import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setCustomers(data || []);
        setLoading(false);
      });
  }, []);

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
        Customers are added automatically the first time you approve one of their purchase requests.
      </p>

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
        <table className="ov-table">
          <thead>
            <tr>
              <th>Phone</th>
              <th>Name</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>{c.phone}</td>
                <td>{c.name || "—"}</td>
                <td>{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
