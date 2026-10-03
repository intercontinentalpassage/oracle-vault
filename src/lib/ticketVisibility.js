// Tickets tied to a draw whose date has already passed are expired and
// hidden from the shop. Tickets with no draw, or a draw we don't know about,
// stay visible.
export function visibleOnly(tickets, draws) {
  const today = new Date().toISOString().slice(0, 10);
  const byId = {};
  draws.forEach((d) => (byId[d.id] = d));
  return tickets.filter((tk) => {
    if (!tk.draw_id) return true;
    const d = byId[tk.draw_id];
    return !d || d.draw_date >= today;
  });
}
