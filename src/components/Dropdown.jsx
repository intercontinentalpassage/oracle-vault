import { Children, useEffect, useRef, useState } from "react";

// A themed stand-in for a native <select>. Browsers render a native
// select's popup list themselves, so it can never fully match the site's
// look — this renders our own trigger + menu instead, styled the same way
// as the existing language-switcher dropdown.
//
// Drop-in usage: same props as <select> (value, onChange, className,
// style, disabled), with plain <option value="...">Label</option>
// children — no need to rewrite call sites to a different options format.
export default function Dropdown({ value, onChange, children, className = "ov-input", style, disabled, fit }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

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
        type="button"
        className={`${className} ov-dropdown-trigger`}
        style={fit ? style : restStyle}
        onClick={() => !disabled && setOpen((o) => !o)}
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
      {open && (
        <ul className="ov-dropdown-menu" role="listbox">
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
        </ul>
      )}
    </div>
  );
}
