import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useSessionProfile } from "../../lib/useSessionProfile";
import BrandBadge from "../../components/BrandBadge";

const NAV = [
  { to: "/agent/catalog", label: "My catalog" },
  { to: "/agent/customers", label: "My customers" },
  { to: "/agent/sales", label: "Sales" },
  { to: "/agent/refunds", label: "Refund requests" },
  { to: "/agent/settings", label: "Shop settings" },
];

export default function AgentLayout() {
  const { loading, session, profile } = useSessionProfile();
  const navigate = useNavigate();

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.role !== "agent") return <Navigate to="/admin" replace />;
  if (!profile.agent_id) {
    return (
      <div className="ov-page" style={{ padding: 60, textAlign: "center" }}>
        <p>Your login isn't linked to an agent record yet. Ask your admin to set this up in All logins.</p>
      </div>
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="ov-admin-shell">
      <aside className="ov-admin-sidebar">
        <div className="ov-admin-brand">
          <BrandBadge size={24} /> Oracle Vault <span>Agent</span>
        </div>
        <a href="#/" className="ov-admin-nav-link back">
          ← Storefront
        </a>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `ov-admin-nav-link${isActive ? " active" : ""}`}
          >
            {item.label}
          </NavLink>
        ))}
        <button className="ov-admin-nav-link logout" onClick={logout}>
          Log out
        </button>
      </aside>
      <main className="ov-admin-content">
        <Outlet context={{ agentId: profile.agent_id }} />
      </main>
    </div>
  );
}
