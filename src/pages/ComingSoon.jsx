import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ComingSoon({ label }) {
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate("/login");
        return;
      }
      if (!cancelled) {
        setAllowed(true);
        setChecked(true);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  if (!checked || !allowed) return null;

  return (
    <div className="ov-page" style={{ padding: 60, textAlign: "center" }}>
      <h1>{label}</h1>
      <p style={{ color: "#5A6560" }}>
        You're signed in. This dashboard is being rebuilt on Supabase next — check back soon.
      </p>
      <button className="ov-nav-link" onClick={logout} style={{ marginTop: 16 }}>
        Log out
      </button>
      <p style={{ marginTop: 16 }}>
        <Link to="/">← Back to storefront</Link>
      </p>
    </div>
  );
}
