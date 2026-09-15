import { Children, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// A themed stand-in for a native <select>. Browsers render a native
// select's popup list themselves, so it can never fully match the site's
// look — this renders our own trigger + menu instead, styled the same way
// as the existing language-switcher dropdown.
//
// The menu is rendered into a portal (document.body) rather than as a
// normal child, positioned to match the trigger's on-screen location.
// Without this, a dropdown inside any scrollable/clipping ancestor (e.g.
// the tickets table's horizontally-scrolling wrapper) can get visually
// clipped or stuck — the portal sidesteps that entirely.
//
// Drop-in usage: same props as <select> (value, onChange, className,
// style, disabled), with plain <option value="...">Label</option>
// children — no need to rewrite call sites to a different options format.
export default function Dropdown({ value, onChange, children, className = "ov-input", style, disabled, fit }) {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      const inRoot = rootRef.current && rootRef.current.contains(e.target);
      const inPortalMenu = e.target.closest && e.target.closest(".ov-dropdown-menu");
      if (!inRoot && !inPortalMenu) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    function onReposition() {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setMenuRect({ top: rect.bottom + 6, left: rect.left, width: rect.width });
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, []);

  function toggleOpen() {
    if (disabled) return;
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuRect({ top: rect.bottom + 6, left: rect.left, width: rect.width });
    }
    setOpen((o) => !o);
  }

  const options = Children.toArray(children)
    .filter((child) => child && child.props)
    .map((child) => ({ value: child.props.value, label: child.props.children }));
  const selected = options.find((o) => String(o.value) === String(value ?? ""));

  const { width, flex, flexGrow, flexShrink, flexBasis, ...restStyle } = style || {};
  const sizingStyle = { width, flex, flexGrow, flexShrink, flexBasis };

  function pick(optValue) {
    setOpen(false);
    onChange?.({ target: { value: optValue } });
  }

  return (
    <div
      ref={rootRef}
      className="ov-dropdown"
      style={{
        position: "relative",
        display: fit ? "inline-block" : "block",
        width: fit ? "auto" : sizingStyle.width ?? "100%",
        ...(fit ? {} : sizingStyle),
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`${className} ov-dropdown-trigger`}
        style={fit ? style : restStyle}
        onClick={toggleOpen}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="ov-dropdown-value">{selected ? selected.label : ""}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`ov-dropdown-chevron${open ? " open" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open &&
        menuRect &&
        createPortal(
          <ul
            className="ov-dropdown-menu"
            role="listbox"
            style={{ position: "fixed", top: menuRect.top, left: menuRect.left, minWidth: menuRect.width, right: "auto" }}
          >
            {options.map((opt) => (
              <li
                key={opt.value}
                className={`ov-dropdown-option${String(opt.value) === String(value ?? "") ? " selected" : ""}`}
                role="option"
                aria-selected={String(opt.value) === String(value ?? "")}
                onClick={() => pick(opt.value)}
              >
                {opt.label}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </div>
  );
}
