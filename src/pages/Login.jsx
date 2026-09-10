import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    navigate(profile?.role === "agent" ? "/agent" : "/admin");
  }

  return (
    <div className="ov-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <form onSubmit={submit} style={{ width: "min(360px, 90vw)" }}>
        <h1 style={{ fontSize: 20 }}>Staff login</h1>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Email
          <input className="ov-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginTop: 10 }}>
          Password
          <input
            className="ov-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p style={{ color: "#B23A2E", fontSize: 13, marginTop: 8 }}>{error}</p>}
        <button className="ov-btn-primary" style={{ width: "100%", marginTop: 16 }} disabled={loading}>
          {loading ? "Signing in…" : "Log in"}
        </button>
        <p style={{ marginTop: 16, fontSize: 13 }}>
          <Link to="/">← Back to storefront</Link>
        </p>
      </form>
    </div>
  );
}
