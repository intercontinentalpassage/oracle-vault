import { useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useSessionProfile } from "../../lib/useSessionProfile";
import BrandBadge from "../../components/BrandBadge";

const NAV = [
  { to: "/admin/tickets", label: "Tickets" },
  { to: "/admin/groups", label: "Ticket categories" },
  { to: "/admin/purchase-requests", label: "Purchase requests" },
  { to: "/admin/agents", label: "Agents" },
  { to: "/admin/customers", label: "Customers" },
  { to: "/admin/refunds", label: "Refund requests" },
  { to: "/admin/logins", label: "All logins" },
  { to: "/admin/draws", label: "Draws" },
  { to: "/admin/translations", label: "Storefront text" },
  { to: "/admin/settings", label: "Settings" },
];

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function AdminLayout() {
  const { loading, session, profile } = useSessionProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.role !== "admin") return <Navigate to="/agent" replace />;

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  const activeLabel = NAV.find((item) => location.pathname.startsWith(item.to))?.label || "Admin";

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
          <BrandBadge size={24} /> Oracle Vault <span>Admin</span>
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
        <Outlet />
      </main>
    </div>
  );
}
