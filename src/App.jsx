import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "./lib/CartContext";
import {
  AdminTickets, AdminGroups, AdminPurchaseRequests, AdminAgents, AdminCustomers, AdminRefunds,
  AdminLogins, AdminDraws, AdminTranslations, AdminSettings,
  AgentCatalog, AgentCustomers, AgentSales, AgentRefunds, AgentSettings,
} from "./lib/panelPages";
import Storefront from "./pages/Storefront";
import AgentShop from "./pages/AgentShop";
import MyTickets from "./pages/MyTickets";

// Customer-facing pages above load immediately, same as before - they're
// the pages people land on directly or share links to.
//
// Everything below is lazy: a customer browsing the storefront never
// downloads any of the Admin or Agent panel code (charts, invoice/photo
// tools, bulk-edit screens, etc.) - it only loads if someone actually opens
// /admin or /agent or /login. This was previously all one ~590 kB bundle
// (588 kB before gzip) that every visitor downloaded before the storefront
// could even render, which is a real contributor to slow first loads,
// especially on slower mobile connections.
const Login = lazy(() => import("./pages/Login"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));

const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));

const AgentLayout = lazy(() => import("./pages/agent/AgentLayout"));

function RouteLoading() {
  return (
    <div style={{ padding: 60, textAlign: "center", color: "#5A6560", fontFamily: "Sora, system-ui, sans-serif" }}>
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <CartProvider>
      <HashRouter>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Storefront />} />
            <Route path="/shop/:slug" element={<AgentShop />} />
            <Route path="/my-tickets" element={<MyTickets />} />
            <Route path="/login" element={<Login />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="tickets" replace />} />
              <Route path="tickets" element={<AdminTickets />} />
              <Route path="groups" element={<AdminGroups />} />
              <Route path="purchase-requests" element={<AdminPurchaseRequests />} />
              <Route path="agents" element={<AdminAgents />} />
              <Route path="customers" element={<AdminCustomers />} />
              <Route path="refunds" element={<AdminRefunds />} />
              <Route path="logins" element={<AdminLogins />} />
              <Route path="draws" element={<AdminDraws />} />
              <Route path="translations" element={<AdminTranslations />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            <Route path="/agent" element={<AgentLayout />}>
              <Route index element={<Navigate to="catalog" replace />} />
              <Route path="catalog" element={<AgentCatalog />} />
              <Route path="customers" element={<AgentCustomers />} />
              <Route path="sales" element={<AgentSales />} />
              <Route path="refunds" element={<AgentRefunds />} />
              <Route path="settings" element={<AgentSettings />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
    </CartProvider>
  );
}
