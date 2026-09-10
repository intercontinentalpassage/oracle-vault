import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit() {
    setError("");
    setSaved(false);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPassword("");
    setConfirm("");
    setSaved(true);
  }

  return (
    <div className="ov-card" style={{ maxWidth: 480, marginTop: 20 }}>
      <strong style={{ fontSize: 13 }}>Change my password</strong>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#5A6560", display: "block", marginTop: 12 }}>
        New password
        <input
          className="ov-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="min. 6 characters"
        />
      </label>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#5A6560", display: "block", marginTop: 12 }}>
        Confirm new password
        <input className="ov-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginTop: 8 }}>{error}</p>}
      {saved && <p style={{ color: "#0B5C4A", fontSize: 13, marginTop: 8 }}>Password updated.</p>}
      <button className="ov-btn-sm primary" onClick={submit} disabled={saving} style={{ marginTop: 12 }}>
        {saving ? "Saving…" : "Update password"}
      </button>
    </div>
  );
}
