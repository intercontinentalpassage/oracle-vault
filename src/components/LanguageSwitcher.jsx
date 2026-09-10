import { useEffect, useRef, useState } from "react";

const OPTIONS = [
  { value: "en", label: "English" },
  { value: "my", label: "မြန်မာ" },
  { value: "th", label: "ไทย" },
];

export default function LanguageSwitcher({ lang, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const current = OPTIONS.find((o) => o.value === lang) || OPTIONS[0];

  return (
    <div className="ov-lang-switcher" ref={ref}>
      <button
        type="button"
        className="ov-lang-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {current.label}
      </button>
      {open && (
        <ul className="ov-lang-menu" role="listbox">
          {OPTIONS.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === lang}
              className={`ov-lang-menu-item${o.value === lang ? " selected" : ""}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
