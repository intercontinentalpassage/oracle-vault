import { HashRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "./lib/CartContext";
import Storefront from "./pages/Storefront";
import AgentShop from "./pages/AgentShop";
import MyTickets from "./pages/MyTickets";
import Login from "./pages/Login";
import ComingSoon from "./pages/ComingSoon";

export default function App() {
  return (
    <CartProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Storefront />} />
          <Route path="/shop/:slug" element={<AgentShop />} />
          <Route path="/my-tickets" element={<MyTickets />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<ComingSoon label="Admin dashboard" />} />
          <Route path="/agent" element={<ComingSoon label="Agent dashboard" />} />
        </Routes>
      </HashRouter>
    </CartProvider>
  );
}
