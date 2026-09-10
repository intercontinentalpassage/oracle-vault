import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

function slugify(label) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState({});

  async function load() {
    setLoading(true);
    const { data, error: loadError } = await supabase.from("groups").select("*").order("sort_order");
    if (loadError) setError(loadError.message);
    setGroups(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addGroup() {
    if (!newLabel.trim()) return;
    setSaving(true);
    setError("");
    const maxOrder = groups.reduce((m, g) => Math.max(m, g.sort_order || 0), 0);
    const { error: insertError } = await supabase.from("groups").insert({
      key: slugify(newLabel) || `group-${Date.now()}`,
      label: newLabel.trim(),
      sort_order: maxOrder + 1,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewLabel("");
    load();
  }

  async function saveLabel(key) {
    const value = editing[key];
    if (value === undefined || !value.trim()) return;
    const { error: updateError } = await supabase.from("groups").update({ label: value.trim() }).eq("key", key);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    load();
  }

  async function move(group, direction) {
    const idx = groups.findIndex((g) => g.key === group.key);
    const swapWith = groups[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      supabase.from("groups").update({ sort_order: swapWith.sort_order }).eq("key", group.key),
      supabase.from("groups").update({ sort_order: group.sort_order }).eq("key", swapWith.key),
    ]);
    load();
  }

  async function deleteGroup(key) {
    if (!confirm("Delete this category? Tickets using it will need reassigning.")) return;
    const { error: deleteError } = await supabase.from("groups").delete().eq("key", key);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    load();
  }

  return (
    <div>
      <h1>Ticket categories</h1>
      <p style={{ fontSize: 13, color: "#5A6560", marginTop: -14, marginBottom: 20 }}>
        These are the filter chips and group headings customers see on the storefront (e.g. Single, Pair, Set of
        5). Add as many as you like, rename any of them freely, and reorder how they appear.
      </p>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Add a category</strong>
        <div className="ov-form-row" style={{ marginTop: 10, alignItems: "flex-end" }}>
          <label>
            Label
            <input
              className="ov-input"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Lucky 7s"
            />
          </label>
          <button className="ov-btn-sm primary" onClick={addGroup} disabled={saving || !newLabel.trim()}>
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : (
        <div className="ov-table-wrap"><table className="ov-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Label</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr key={g.key}>
                <td style={{ display: "flex", gap: 4 }}>
                  <button className="ov-btn-sm" disabled={i === 0} onClick={() => move(g, -1)}>
                    ↑
                  </button>
                  <button className="ov-btn-sm" disabled={i === groups.length - 1} onClick={() => move(g, 1)}>
                    ↓
                  </button>
                </td>
                <td>
                  <input
                    className="ov-input"
                    style={{ margin: 0, padding: "6px 8px", fontSize: 13, width: 220 }}
                    value={editing[g.key] ?? g.label}
                    onChange={(e) => setEditing((prev) => ({ ...prev, [g.key]: e.target.value }))}
                  />
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  {editing[g.key] !== undefined && editing[g.key] !== g.label && (
                    <button className="ov-btn-sm primary" onClick={() => saveLabel(g.key)}>
                      Save
                    </button>
                  )}
                  <button className="ov-btn-sm danger" onClick={() => deleteGroup(g.key)}>
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
