import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const emptyTier = () => ({ label: "", prize: "", numbers: "" });

export default function AdminDraws() {
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [tiers, setTiers] = useState([emptyTier()]);

  async function load() {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("draws")
      .select("*")
      .order("draw_date", { ascending: false });
    if (loadError) setError(loadError.message);
    setDraws(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function updateTier(i, field, value) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  }
  function addTierRow() {
    setTiers((prev) => [...prev, emptyTier()]);
  }
  function removeTierRow(i) {
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function createDraw() {
    if (!label.trim() || !date) return;
    setSaving(true);
    setError("");
    const tiersPayload = tiers
      .filter((t) => t.label.trim() && t.prize.trim())
      .map((t) => ({
        label: t.label.trim(),
        prize: t.prize.trim(),
        numbers: t.numbers
          .split(/[\s,]+/)
          .map((n) => n.trim())
          .filter(Boolean),
      }));
    const { error: insertError } = await supabase.from("draws").insert({
      label: label.trim(),
      draw_date: date,
      tiers: tiersPayload,
      published: false,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setLabel("");
    setDate("");
    setTiers([emptyTier()]);
    load();
  }

  async function togglePublish(draw) {
    const { error: updateError } = await supabase
      .from("draws")
      .update({ published: !draw.published })
      .eq("id", draw.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    load();
  }

  async function deleteDraw(id) {
    if (!confirm("Delete this draw?")) return;
    const { error: deleteError } = await supabase.from("draws").delete().eq("id", id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    load();
  }

  return (
    <div>
      <h1>Draws</h1>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Add draw</strong>
        <div className="ov-form-row" style={{ marginTop: 10 }}>
          <label>
            Label
            <input
              className="ov-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="16 September 2026"
            />
          </label>
          <label>
            Draw date
            <input className="ov-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>

        <strong style={{ fontSize: 12, color: "#5A6560" }}>Prize tiers</strong>
        {tiers.map((tier, i) => (
          <div className="ov-form-row" key={i} style={{ marginTop: 8, alignItems: "flex-end" }}>
            <label>
              Tier label
              <input
                className="ov-input"
                value={tier.label}
                onChange={(e) => updateTier(i, "label", e.target.value)}
                placeholder="First prize"
              />
            </label>
            <label>
              Prize
              <input
                className="ov-input"
                value={tier.prize}
                onChange={(e) => updateTier(i, "prize", e.target.value)}
                placeholder="6,000,000"
              />
            </label>
            <label>
              Winning numbers
              <input
                className="ov-input"
                value={tier.numbers}
                onChange={(e) => updateTier(i, "numbers", e.target.value)}
                placeholder="123456, 654321"
              />
            </label>
            {tiers.length > 1 && (
              <button className="ov-btn-sm danger" onClick={() => removeTierRow(i)}>
                Remove
              </button>
            )}
          </div>
        ))}
        <button className="ov-btn-sm" onClick={addTierRow} style={{ marginBottom: 14 }}>
          + Add tier
        </button>
        <div>
          <button className="ov-btn-sm primary" onClick={createDraw} disabled={saving || !label.trim() || !date}>
            {saving ? "Saving…" : "Create draw"}
          </button>
        </div>
      </div>

      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : (
        <table className="ov-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Date</th>
              <th>Tiers</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {draws.map((d) => (
              <tr key={d.id}>
                <td>{d.label}</td>
                <td>{d.draw_date}</td>
                <td>{(d.tiers || []).length}</td>
                <td>
                  <span className={`ov-status-pill ${d.published ? "available" : "held"}`}>
                    {d.published ? "published" : "draft"}
                  </span>
                </td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="ov-btn-sm" onClick={() => togglePublish(d)}>
                    {d.published ? "Unpublish" : "Publish"}
                  </button>
                  <button className="ov-btn-sm danger" onClick={() => deleteDraw(d.id)}>
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
