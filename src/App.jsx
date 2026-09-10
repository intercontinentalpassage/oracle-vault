import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { CartProvider } from "./lib/CartContext";
import Storefront from "./pages/Storefront";
import AgentShop from "./pages/AgentShop";
import MyTickets from "./pages/MyTickets";
import Login from "./pages/Login";

import AdminLayout from "./pages/admin/AdminLayout";
import AdminTickets from "./pages/admin/AdminTickets";
import AdminPurchaseRequests from "./pages/admin/AdminPurchaseRequests";
import AdminAgents from "./pages/admin/AdminAgents";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminRefunds from "./pages/admin/AdminRefunds";
import AdminLogins from "./pages/admin/AdminLogins";
import AdminDraws from "./pages/admin/AdminDraws";
import AdminSettings from "./pages/admin/AdminSettings";

import AgentLayout from "./pages/agent/AgentLayout";
import AgentCatalog from "./pages/agent/AgentCatalog";
import AgentCustomers from "./pages/agent/AgentCustomers";
import AgentSales from "./pages/agent/AgentSales";
import AgentRefunds from "./pages/agent/AgentRefunds";
import AgentSettings from "./pages/agent/AgentSettings";

export default function App() {
  return (
    <CartProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Storefront />} />
          <Route path="/shop/:slug" element={<AgentShop />} />
          <Route path="/my-tickets" element={<MyTickets />} />
          <Route path="/login" element={<Login />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="tickets" replace />} />
            <Route path="tickets" element={<AdminTickets />} />
            <Route path="purchase-requests" element={<AdminPurchaseRequests />} />
            <Route path="agents" element={<AdminAgents />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="refunds" element={<AdminRefunds />} />
            <Route path="logins" element={<AdminLogins />} />
            <Route path="draws" element={<AdminDraws />} />
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
      </HashRouter>
    </CartProvider>
  );
}
