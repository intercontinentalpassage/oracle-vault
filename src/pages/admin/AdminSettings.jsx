export default function AdminSettings() {
  const url = import.meta.env.VITE_SUPABASE_URL;

  return (
    <div>
      <h1>Settings</h1>
      <div className="ov-card">
        <strong style={{ fontSize: 13 }}>Backend</strong>
        <p style={{ fontSize: 13, color: "#5A6560", marginTop: 6 }}>
          Oracle Vault runs on Supabase. This deployment is connected to:
        </p>
        <code style={{ fontSize: 12, background: "#F4F8F6", padding: "6px 10px", borderRadius: 8, display: "inline-block" }}>
          {url}
        </code>
        <p style={{ fontSize: 13, color: "#5A6560", marginTop: 16 }}>
          To manage tables, security policies, or staff accounts directly, use the{" "}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ color: "#0F7A63" }}>
            Supabase dashboard
          </a>
          .
        </p>
      </div>
    </div>
  );
}
