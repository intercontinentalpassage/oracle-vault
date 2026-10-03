import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getCurrencySymbol, useSiteSettingsVersion } from "../../lib/siteSettingsStore";
import DatePicker from "../../components/DatePicker";

const emptyTier = () => ({ label: "", prize: "", numbers: "" });

export default function AdminDraws() {
  useSiteSettingsVersion();
  const currency = getCurrencySymbol();
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [parsedFromPdf, setParsedFromPdf] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  // Short confirmation shown after saving, e.g. when results went into the
  // existing draw for that date instead of creating a second one.
  const [notice, setNotice] = useState("");

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
      .select("*, tickets(count)")
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

  const ticketCount = (d) => d.tickets?.[0]?.count ?? 0;
  const hasResults = (d) => (d.tiers || []).length > 0;

  // An existing draw for this date, preferring the one holding tickets.
  function findDrawForDate(isoDate) {
    const matches = draws.filter((d) => d.draw_date === isoDate);
    return matches.sort((a, b) => ticketCount(b) - ticketCount(a))[0] || null;
  }

  function resetForm() {
    setLabel("");
    setDate("");
    setTiers([emptyTier()]);
    setParsedFromPdf(false);
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
      setNotice("");
      // Results PDF for a draw that already exists (e.g. created when adding
      // tickets): say so — saving puts the results into that draw.
      const existing = findDrawForDate(result.drawDateIso);
      if (existing && !existing.published) {
        setLabel(existing.label);
        setNotice(`These results will be saved into the existing draw "${existing.label}".`);
      }
    } catch (err) {
      setParseError(err.message || String(err));
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  }

  async function saveDraw() {
    if (!label.trim() || !date) return;
    setError("");
    setNotice("");
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

    // One draw per date: save into the existing draw for this date (the one
    // your tickets are attached to) if there is one, otherwise create it.
    // Saving never publishes — use Publish in the list below.
    const existing = findDrawForDate(date);
    if (existing && existing.published) {
      setError(
        `"${existing.label}" is already published. Unpublish it in the list below first, then save again to change its results.`
      );
      return;
    }
    const targetId = existing?.id || null;

    setSaving(true);
    const fields = { label: label.trim(), draw_date: date, tiers: tiersPayload };
    const { error: saveError } = targetId
      ? await supabase.from("draws").update(fields).eq("id", targetId)
      : await supabase.from("draws").insert({ ...fields, published: false });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setNotice(targetId ? `Saved into the existing draw "${existing.label}". Publish it from the list below.` : "Draw saved.");
    resetForm();
    load();
  }

  // Tags every ticket of this draw whose number matches a winning number
  // with which tier it won (e.g. "First prize · 6,000,000"). Runs one
  // update per tier rather than per number, since a tier can have many
  // numbers but they all share the same tag.
  async function markWinners(draw) {
    const tiers = draw.tiers || [];
    for (const tier of tiers) {
      const numbers = tier.numbers || [];
      if (numbers.length === 0) continue;
      // Only tickets entered for THIS draw can win it.
      const { error: tagError } = await supabase
        .from("tickets")
        .update({ win: `${tier.label} · ${currency}${tier.prize}` })
        .eq("draw_id", draw.id)
        .in("number", numbers);
      if (tagError) throw tagError;
    }
  }

  // Reverses markWinners — used when a draw is unpublished, so a mistaken
  // publish doesn't leave stale "won" tags behind.
  async function clearWinners(draw) {
    // Only this draw's tickets — never touch tickets from other draws.
    const { error: clearError } = await supabase
      .from("tickets")
      .update({ win: null })
      .eq("draw_id", draw.id)
      .not("win", "is", null);
    if (clearError) throw clearError;
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
      ? await supabase.from("tickets").select("*").eq("draw_id", draw.id).in("number", allNumbers)
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
          prize tier below automatically. If a draw for that date already exists (for example one you created
          when adding tickets), the results are saved into that draw. Review the numbers, save, then publish
          it from the list.
        </p>
        <input type="file" accept="application/pdf" onChange={handlePdfUpload} disabled={parsing} />
        {parsing && <p style={{ fontSize: 13, color: "#5A6560", marginTop: 8 }}>Reading PDF…</p>}
        {parseError && <p style={{ color: "#B23A2E", fontSize: 13, marginTop: 8 }}>{parseError}</p>}
        {parsedFromPdf && (
          <p style={{ color: "#0B5C4A", fontSize: 13, marginTop: 8 }}>
            Parsed successfully — review the fields below, then save.
          </p>
        )}
      </div>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Add draw / results</strong>
        {notice && <p style={{ color: "#0B5C4A", fontSize: 13, margin: "8px 0 0" }}>{notice}</p>}
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
            <DatePicker className="ov-input" value={date} onChange={(e) => setDate(e.target.value)} />
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
          <button className="ov-btn-sm primary" onClick={saveDraw} disabled={saving || !label.trim() || !date}>
            {saving ? "Saving…" : "Save"}
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
              <th>Label</th>
              <th>Date</th>
              <th>Tickets</th>
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
                <td>{ticketCount(d)}</td>
                <td>{(d.tiers || []).length}</td>
                <td>
                  <span className={`ov-status-pill ${d.published ? "available" : "held"}`}>
                    {d.published ? "published" : hasResults(d) ? "results ready" : "awaiting results"}
                  </span>
                </td>
                <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    className={`ov-btn-sm${!d.published && hasResults(d) ? " primary" : ""}`}
                    onClick={() => togglePublish(d)}
                    disabled={publishingId === d.id || (!d.published && !hasResults(d))}
                    title={!d.published && !hasResults(d) ? "Save results for this draw first" : undefined}
                  >
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
        </table></div>
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
            <div className="ov-table-wrap"><table className="ov-table">
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
            </table></div>
          )}
        </div>
      )}
    </div>
  );
}
