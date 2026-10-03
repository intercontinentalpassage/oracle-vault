import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A themed stand-in for a native <input type="date">. On phones a native date
// input opens the phone's own calendar (iOS wheel / Android Material), which
// can't be restyled, so this renders our own trigger + calendar instead — the
// same approach and look as <Dropdown>.
//
// Drop-in usage: same props as the date input it replaces (value as
// "YYYY-MM-DD" or "", onChange receiving { target: { value } }, className,
// style, disabled), so call sites keep their existing onChange handlers.
//
// Dates are handled as plain year/month/day numbers, never parsed with
// new Date("YYYY-MM-DD") — that is read as UTC midnight and can show the
// wrong day depending on the phone's time zone.

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const POPUP_WIDTH = 296;
const POPUP_HEIGHT = 348; // approximate, used to decide whether to open upward

const pad = (n) => String(n).padStart(2, "0");
const toValue = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parseValue(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

function todayParts() {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
}

export function formatDateLabel(value) {
  const p = parseValue(value);
  return p ? `${p.d} ${MONTHS[p.m]} ${p.y}` : "";
}

function Chevron({ dir }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
    </svg>
  );
}

export default function DatePicker({ value, onChange, className = "ov-input", style, disabled, placeholder = "Select a date" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const selected = parseValue(value);
  const today = todayParts();
  const [view, setView] = useState(() => (selected ? { y: selected.y, m: selected.m } : { y: today.y, m: today.m }));
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  function place() {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(POPUP_WIDTH, vw - 16);
    const left = Math.max(8, Math.min(r.left, vw - width - 8));
    const openUp = vh - r.bottom < POPUP_HEIGHT + 12 && r.top > POPUP_HEIGHT + 12;
    setPos({ left, width, ...(openUp ? { bottom: vh - r.top + 6 } : { top: r.bottom + 6 }) });
  }

  useEffect(() => {
    if (!open) return undefined;
    function onDocDown(e) {
      const inRoot = rootRef.current && rootRef.current.contains(e.target);
      const inPopup = e.target.closest && e.target.closest(".ov-datepicker-popup");
      if (!inRoot && !inPopup) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  function toggle() {
    if (disabled) return;
    if (!open) {
      // Open on the selected month, or this month if nothing is picked yet.
      const p = parseValue(value);
      setView(p ? { y: p.y, m: p.m } : { y: today.y, m: today.m });
      place();
    }
    setOpen((o) => !o);
  }

  function shiftMonth(delta) {
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  }

  function pick(newValue) {
    setOpen(false);
    onChange?.({ target: { value: newValue } });
  }

  // 6 rows x 7 days, including the tail of last month and head of next month.
  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(view.y, view.m, i - firstWeekday + 1);
    cells.push({ y: date.getFullYear(), m: date.getMonth(), d: date.getDate(), outside: date.getMonth() !== view.m });
  }
  const rowsNeeded = Math.ceil((firstWeekday + daysInMonth) / 7);
  const visibleCells = cells.slice(0, rowsNeeded * 7);

  const { width, flex, flexGrow, flexShrink, flexBasis, ...restStyle } = style || {};

  return (
    <div ref={rootRef} className="ov-datepicker" style={{ position: "relative", width: width ?? "100%", flex, flexGrow, flexShrink, flexBasis }}>
      <button
        ref={triggerRef}
        type="button"
        className={`${className} ov-dropdown-trigger`}
        style={restStyle}
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="ov-dropdown-value" style={selected ? undefined : { color: "#8A948F" }}>
          {selected ? formatDateLabel(value) : placeholder}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ov-datepicker-icon" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>

      {open &&
        pos &&
        createPortal(
          <div className="ov-datepicker-popup" role="dialog" aria-label="Choose a date" style={{ position: "fixed", ...pos }}>
            <div className="ov-datepicker-head">
              <button type="button" className="ov-datepicker-nav" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                <Chevron dir="left" />
              </button>
              <div className="ov-datepicker-title">
                {MONTHS[view.m]} {view.y}
              </div>
              <button type="button" className="ov-datepicker-nav" onClick={() => shiftMonth(1)} aria-label="Next month">
                <Chevron dir="right" />
              </button>
            </div>

            <div className="ov-datepicker-grid">
              {WEEKDAYS.map((w) => (
                <div key={w} className="ov-datepicker-weekday">
                  {w}
                </div>
              ))}
              {visibleCells.map((c) => {
                const v = toValue(c.y, c.m, c.d);
                const isSelected = selected && v === toValue(selected.y, selected.m, selected.d);
                const isToday = v === toValue(today.y, today.m, today.d);
                return (
                  <button
                    key={v}
                    type="button"
                    className={`ov-datepicker-day${c.outside ? " outside" : ""}${isToday ? " today" : ""}${isSelected ? " selected" : ""}`}
                    onClick={() => pick(v)}
                    aria-pressed={!!isSelected}
                    aria-label={formatDateLabel(v)}
                  >
                    {c.d}
                  </button>
                );
              })}
            </div>

            <div className="ov-datepicker-foot">
              <button type="button" className="ov-datepicker-link" onClick={() => pick("")}>
                Clear
              </button>
              <button type="button" className="ov-datepicker-link primary" onClick={() => pick(toValue(today.y, today.m, today.d))}>
                Today
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
