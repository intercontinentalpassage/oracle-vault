import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const emptyTier = () => ({ label: "", prize: "", numbers: "" });

export default function AdminDraws() {
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parsedFromPdf, setParsedFromPdf] = useState(false);
  const [publishingId, setPublishingId] = useState(null);

  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [tiers, setTiers] = useState([emptyTier()]);

  const [winnersFor, setWinnersFor] = useState(null); // draw object or null
  const [winnersRows, setWinnersRows] = useState([]);
  const [winnersLoading, setWinnersLoading] = useState(false);

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

  async function handlePdfUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setParseError("");
    setParsedFromPdf(false);
    try {
      const { parseGloPdf } = await import("../../lib/gloParser");
      const result = await parseGloPdf(file);
      setLabel(result.label);
      setDate(result.drawDateIso);
      setTiers(
        result.tiers.map((t) => ({
          label: t.label,
          prize: t.prize,
          numbers: t.numbers.join(", "),
        }))
      );
      setParsedFromPdf(true);
    } catch (err) {
      setParseError(err.message || String(err));
    } finally {
      setParsing(false);
      e.target.value = "";
    }
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
    setParsedFromPdf(false);
    load();
  }

  // Tags every ticket whose number matches a winning number in this draw
  // with which tier it won (e.g. "First prize · 6,000,000"). Runs one
  // update per tier rather than per number, since a tier can have many
  // numbers but they all share the same tag.
  async function markWinners(draw) {
    const tiers = draw.tiers || [];
    for (const tier of tiers) {
      const numbers = tier.numbers || [];
      if (numbers.length === 0) continue;
      await supabase
        .from("tickets")
        .update({ win: `${tier.label} · ฿${tier.prize}` })
        .in("number", numbers);
    }
  }

  // Reverses markWinners — used when a draw is unpublished, so a mistaken
  // publish doesn't leave stale "won" tags behind.
  async function clearWinners(draw) {
    const allNumbers = (draw.tiers || []).flatMap((t) => t.numbers || []);
    if (allNumbers.length === 0) return;
    await supabase.from("tickets").update({ win: null }).in("number", allNumbers);
  }

  async function togglePublish(draw) {
    setPublishingId(draw.id);
    setError("");
    const nextPublished = !draw.published;
    const { error: updateError } = await supabase
      .from("draws")
      .update({ published: nextPublished })
      .eq("id", draw.id);
    if (updateError) {
      setError(updateError.message);
      setPublishingId(null);
      return;
    }
    try {
      if (nextPublished) await markWinners(draw);
      else await clearWinners(draw);
    } catch (e) {
      setError(e.message || String(e));
    }
    setPublishingId(null);
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

  async function openWinners(draw) {
    setWinnersFor(draw);
    setWinnersLoading(true);
    const allNumbers = (draw.tiers || []).flatMap((t) => t.numbers || []);
    const tierByNumber = {};
    (draw.tiers || []).forEach((t) => (t.numbers || []).forEach((n) => (tierByNumber[n] = t.label)));

    const { data: tickets } = allNumbers.length
      ? await supabase.from("tickets").select("*").in("number", allNumbers)
      : { data: [] };

    const ticketIds = (tickets || []).map((t) => t.id);
    const { data: sales } = ticketIds.length
      ? await supabase.from("sales").select("ticket_id, customer_phone").in("ticket_id", ticketIds)
      : { data: [] };
    const saleByTicket = {};
    (sales || []).forEach((s) => (saleByTicket[s.ticket_id] = s.customer_phone));

    const rows = (tickets || []).map((t) => ({
      number: t.number,
      tier: tierByNumber[t.number] || "—",
      status: t.status,
      customerPhone: saleByTicket[t.id] || null,
    }));
    rows.sort((a, b) => (a.customerPhone ? -1 : 1) - (b.customerPhone ? -1 : 1));
    setWinnersRows(rows);
    setWinnersLoading(false);
  }

  return (
    <div>
      <h1>Draws</h1>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Upload GLO results (PDF)</strong>
        <p style={{ fontSize: 12, color: "#5A6560", margin: "4px 0 12px" }}>
          Upload the official 6-digit (L6) results PDF from GLO — it fills in the draw label, date, and every
          prize tier below automatically. Review the numbers before creating the draw.
        </p>
        <input type="file" accept="application/pdf" onChange={handlePdfUpload} disabled={parsing} />
        {parsing && <p style={{ fontSize: 13, color: "#5A6560", marginTop: 8 }}>Reading PDF…</p>}
        {parseError && <p style={{ color: "#B23A2E", fontSize: 13, marginTop: 8 }}>{parseError}</p>}
        {parsedFromPdf && (
          <p style={{ color: "#0B5C4A", fontSize: 13, marginTop: 8 }}>
            Parsed successfully — review the fields below, then click "Create draw".
          </p>
        )}
      </div>

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
                  <button className="ov-btn-sm" onClick={() => togglePublish(d)} disabled={publishingId === d.id}>
                    {publishingId === d.id ? "Working…" : d.published ? "Unpublish" : "Publish"}
                  </button>
                  {d.published && (
                    <button className="ov-btn-sm" onClick={() => openWinners(d)}>
                      View winners
                    </button>
                  )}
                  <button className="ov-btn-sm danger" onClick={() => deleteDraw(d.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {winnersFor && (
        <div className="ov-card" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <strong style={{ fontSize: 13 }}>Winners — {winnersFor.label}</strong>
            <button className="ov-btn-sm" onClick={() => setWinnersFor(null)}>
              Close
            </button>
          </div>
          {winnersLoading ? (
            <p style={{ color: "#5A6560", fontSize: 13 }}>Loading…</p>
          ) : winnersRows.length === 0 ? (
            <p style={{ color: "#5A6560", fontSize: 13 }}>
              None of these winning numbers exist as tickets in your system.
            </p>
          ) : (
            <table className="ov-table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Tier</th>
                  <th>Ticket status</th>
                  <th>Bought by</th>
                </tr>
              </thead>
              <tbody>
                {winnersRows.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "'Space Mono', monospace" }}>{r.number}</td>
                    <td>{r.tier}</td>
                    <td>
                      <span className={`ov-status-pill ${r.status}`}>{r.status}</span>
                    </td>
                    <td>{r.customerPhone || "— not sold —"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
