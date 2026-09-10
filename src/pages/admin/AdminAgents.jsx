import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

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
              <tr key={a.id}>
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
                  <button className="ov-btn-sm" onClick={() => toggleActive(a)}>
                    {a.active ? "Deactivate" : "Activate"}
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
