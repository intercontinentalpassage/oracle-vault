import { useMemo, useState } from "react";
import { t } from "../lib/i18n";
import { useCart } from "../lib/CartContext";

function matchesDigits(number, digits, anywhere) {
  const filled = digits.map((d, i) => [i, d]).filter(([, d]) => d);
  if (filled.length === 0) return true;
  if (anywhere) {
    return filled.every(([, d]) => number.includes(d));
  }
  return filled.every(([i, d]) => number[i] === d);
}

export default function TicketResults({ lang, tickets, groups, digits, anywhere, onClearSearch }) {
  const [filterKey, setFilterKey] = useState(null);
  const { add, remove, has } = useCart();

  const filters = [
    { key: null, label: t(lang, "filterAll") },
    { key: "single", label: t(lang, "filterSingle") },
    { key: "pair", label: t(lang, "filterPair") },
    { key: "set", label: t(lang, "filterSet") },
  ];

  const filtered = useMemo(
    () =>
      tickets.filter(
        (tk) =>
          tk.status === "available" &&
          matchesDigits(tk.number, digits, anywhere) &&
          (!filterKey || tk.group_key === filterKey)
      ),
    [tickets, digits, anywhere, filterKey]
  );

  const groupLabel = (key) => {
    if (key === "single") return t(lang, "filterSingle");
    if (key === "pair") return t(lang, "badgePair");
    if (key === "set") return t(lang, "badgeSet");
    return groups.find((g) => g.key === key)?.label || key;
  };

  // Group filtered tickets by their group_key, in the groups' sort order.
  const grouped = useMemo(() => {
    const order = groups.length ? groups.map((g) => g.key) : ["single", "pair", "set"];
    return order
      .map((key) => ({ key, label: groupLabel(key), tickets: filtered.filter((tk) => tk.group_key === key) }))
      .filter((g) => g.tickets.length > 0);
  }, [filtered, groups]);

  return (
    <section className="ov-results">
      <div className="ov-results-inner">
        <div className="ov-results-head">
          <h2>{t(lang, "availableTickets")}</h2>
          <div className="ov-filters">
            {filters.map((f) => (
              <button
                key={f.label}
                className={`ov-filter-chip${filterKey === f.key ? " active" : ""}`}
                onClick={() => setFilterKey(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="ov-empty-state">
            <div className="title">{t(lang, "noTicketsMatch")}</div>
            <div className="sub">{t(lang, "tryFewerDigits")}</div>
            <button className="ov-btn-primary" onClick={onClearSearch}>
              {t(lang, "clearSearch")}
            </button>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.key} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="ov-prize-group-head">
                <h3>{group.label}</h3>
              </div>
              <div className="ov-ticket-grid">
                {group.tickets.map((tk) => {
                  const inCart = has(tk.id);
                  return (
                    <div className={`ov-ticket-card${inCart ? " in-cart" : ""}`} key={tk.id}>
                      <div className="ov-ticket-number-row">
                        <div className="ov-ticket-digits">
                          {tk.number.split("").map((d, i) => (
                            <div className={`ov-ticket-digit${inCart ? " in-cart" : ""}`} key={i}>
                              {d}
                            </div>
                          ))}
                        </div>
                        <button
                          className={`ov-add-btn-sm${inCart ? " added" : ""}`}
                          aria-label={inCart ? t(lang, "added") : t(lang, "add")}
                          onClick={() => (inCart ? remove(tk.id) : add(tk))}
                        >
                          {inCart ? "✓" : "+"}
                        </button>
                      </div>
                      <span className={`ov-badge${inCart ? " green" : ""}`}>
                        {inCart ? t(lang, "added") : t(lang, "inStock")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
