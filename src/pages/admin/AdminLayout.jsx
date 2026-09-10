import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useSessionProfile } from "../../lib/useSessionProfile";

const NAV = [
  { to: "/admin/tickets", label: "Tickets" },
  { to: "/admin/purchase-requests", label: "Purchase requests" },
  { to: "/admin/agents", label: "Agents" },
  { to: "/admin/customers", label: "Customers" },
  { to: "/admin/refunds", label: "Refund requests" },
  { to: "/admin/logins", label: "All logins" },
  { to: "/admin/draws", label: "Draws" },
  { to: "/admin/settings", label: "Settings" },
];

export default function AdminLayout() {
  const { loading, session, profile } = useSessionProfile();
  const navigate = useNavigate();

  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.role !== "admin") return <Navigate to="/agent" replace />;

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="ov-admin-shell">
      <aside className="ov-admin-sidebar">
        <div className="ov-admin-brand">
          Oracle Vault <span>Admin</span>
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
        <Outlet />
      </main>
    </div>
  );
}
