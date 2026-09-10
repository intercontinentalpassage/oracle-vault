import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-accounts`;

async function callAdminAccounts(payload) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}

function slugifyName(name) {
  return (name || "agent")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "agent";
}

function generatePlaceholderEmail(displayName) {
  const slug = slugifyName(displayName);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slug}-${suffix}@oraclevault.local`;
}

export default function AdminLogins() {
  const [profiles, setProfiles] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeGeneratedEmail, setNoticeGeneratedEmail] = useState(null);

  // Create-login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("agent");
  const [agentId, setAgentId] = useState("");
  const [creating, setCreating] = useState(false);

  // Reset-password state (per row)
  const [resetTarget, setResetTarget] = useState(null);
  const [resetValue, setResetValue] = useState("");
  const [resetting, setResetting] = useState(false);

  async function load() {
    setLoading(true);
    const [profilesRes, agentsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("agents").select("*").order("name"),
    ]);
    setProfiles(profilesRes.data || []);
    setAgents(agentsRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateProfile(id, patch) {
    const { error: updateError } = await supabase.from("profiles").update(patch).eq("id", id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    load();
  }

  async function createLogin() {
    if (!password.trim()) return;
    setCreating(true);
    setError("");
    setNotice("");
    setNoticeGeneratedEmail(null);
    const wasBlank = !email.trim();
    const finalEmail = email.trim() || generatePlaceholderEmail(displayName);
    try {
      await callAdminAccounts({
        action: "create_login",
        email: finalEmail,
        password,
        display_name: displayName.trim() || null,
        role,
        agent_id: role === "agent" ? agentId || null : null,
      });
      if (wasBlank) {
        setNoticeGeneratedEmail(finalEmail);
        setNotice("");
      } else {
        setNotice(`Login created for ${finalEmail}.`);
      }
      setEmail("");
      setPassword("");
      setDisplayName("");
      setAgentId("");
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function submitReset() {
    if (!resetValue.trim() || resetValue.trim().length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setResetting(true);
    setError("");
    setNotice("");
    setNoticeGeneratedEmail(null);
    try {
      await callAdminAccounts({ action: "reset_password", user_id: resetTarget.id, new_password: resetValue.trim() });
      setNotice(`Password reset for ${resetTarget.display_name || resetTarget.id}.`);
      setResetTarget(null);
      setResetValue("");
    } catch (e) {
      setError(e.message);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div>
      <h1>All logins</h1>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Create a login</strong>
        <div className="ov-form-row" style={{ marginTop: 10 }}>
          <label>
            Email <span style={{ color: "#5A6560", fontWeight: 400 }}>(optional)</span>
            <input className="ov-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Leave blank to auto-generate" />
          </label>
          <label>
            Password
            <input className="ov-input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 6 characters" />
          </label>
          <label>
            Display name
            <input className="ov-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
        </div>
        <div className="ov-form-row">
          <label>
            Role
            <select className="ov-input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="agent">agent</option>
              <option value="admin">admin</option>
            </select>
          </label>
          {role === "agent" && (
            <label>
              Agent
              <select className="ov-input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                <option value="">— select agent —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button className="ov-btn-sm primary" onClick={createLogin} disabled={creating || !password.trim()}>
          {creating ? "Creating…" : "Create login"}
        </button>
      </div>

      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}
      {(notice || noticeGeneratedEmail) && (
        <p style={{ color: "#0B5C4A", fontSize: 13, marginBottom: 12 }}>
          {noticeGeneratedEmail ? (
            <>
              Login created. No email was given, so this login email was generated — save it, the agent will need it
              to sign in: <code style={{ background: "#E6F4EF", padding: "2px 6px", borderRadius: 6 }}>{noticeGeneratedEmail}</code>
            </>
          ) : (
            notice
          )}
        </p>
      )}

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : (
        <div className="ov-table-wrap"><table className="ov-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>User ID</th>
              <th>Role</th>
              <th>Agent</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.display_name || "—"}</td>
                <td style={{ fontFamily: "'Space Mono', monospace", fontSize: 11 }}>{p.id}</td>
                <td>
                  <select
                    className="ov-input"
                    style={{ margin: 0, padding: "6px 8px", fontSize: 12 }}
                    value={p.role}
                    onChange={(e) => updateProfile(p.id, { role: e.target.value })}
                  >
                    <option value="admin">admin</option>
                    <option value="agent">agent</option>
                  </select>
                </td>
                <td>
                  {p.role === "agent" ? (
                    <select
                      className="ov-input"
                      style={{ margin: 0, padding: "6px 8px", fontSize: 12 }}
                      value={p.agent_id || ""}
                      onChange={(e) => updateProfile(p.id, { agent_id: e.target.value || null })}
                    >
                      <option value="">— select agent —</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  {resetTarget?.id === p.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        className="ov-input"
                        style={{ margin: 0, padding: "6px 8px", fontSize: 12, width: 120 }}
                        placeholder="New password"
                        value={resetValue}
                        onChange={(e) => setResetValue(e.target.value)}
                      />
                      <button className="ov-btn-sm primary" onClick={submitReset} disabled={resetting}>
                        {resetting ? "…" : "Save"}
                      </button>
                      <button className="ov-btn-sm" onClick={() => setResetTarget(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button className="ov-btn-sm" onClick={() => { setResetTarget(p); setResetValue(""); }}>
                      Reset password
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
