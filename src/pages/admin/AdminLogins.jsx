import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminLogins() {
  const [profiles, setProfiles] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div>
      <h1>All logins</h1>
      <p style={{ fontSize: 13, color: "#5A6560", marginTop: -14, marginBottom: 20 }}>
        New staff accounts are created in the Supabase dashboard (Authentication → Users) — copy their User UID
        and add a row here to assign a role. This page manages roles for accounts that already exist.
      </p>

      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "#5A6560" }}>Loading…</p>
      ) : (
        <table className="ov-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>User ID</th>
              <th>Role</th>
              <th>Agent (if role = agent)</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
