import { useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
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

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function AgentLayout() {
  const { loading, session, profile } = useSessionProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const activeLabel = NAV.find((item) => location.pathname.startsWith(item.to))?.label || "Agent";

  return (
    <div className="ov-admin-shell">
      <div className="ov-admin-topbar">
        <button className="ov-admin-hamburger" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
          <MenuIcon />
        </button>
        <strong style={{ fontSize: 14 }}>{activeLabel}</strong>
      </div>

      <div className={`ov-admin-sidebar-overlay${sidebarOpen ? " open" : ""}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`ov-admin-sidebar${sidebarOpen ? " open" : ""}`}>
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
            onClick={() => setSidebarOpen(false)}
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
