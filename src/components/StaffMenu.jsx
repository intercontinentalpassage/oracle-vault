import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

// Header menu for a logged-in admin or agent. The label (e.g. "Admin setting")
// opens a small dropdown with "Settings" (goes to their panel) and "Log out".
// Open/close behavior and look match the language switcher next to it.
export default function StaffMenu({ label, settingsTo }) {
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

  // Stay on the current page: the session hook notices the sign-out and the
  // header drops this menu (the footer Login link comes back) on its own.
  async function logout() {
    setOpen(false);
    await supabase.auth.signOut();
  }

  return (
    <div className="ov-staff-menu-wrap" ref={ref}>
      <button
        type="button"
        className="ov-nav-link ov-staff-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <svg
          className={`ov-staff-chevron${open ? " open" : ""}`}
          viewBox="0 0 12 12"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>
      {open && (
        <div className="ov-lang-menu ov-staff-menu" role="menu">
          <Link
            to={settingsTo}
            role="menuitem"
            className="ov-lang-menu-item ov-staff-menu-item"
            onClick={() => setOpen(false)}
          >
            Settings
          </Link>
          <button type="button" role="menuitem" className="ov-lang-menu-item ov-staff-menu-item danger" onClick={logout}>
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
