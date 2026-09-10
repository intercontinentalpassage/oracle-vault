import { createContext, useContext, useEffect, useState } from "react";

const CART_KEY = "oracle-vault:cart";
const CartContext = createContext(null);

function readCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readCart);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // ignore — storage may be blocked, cart still works in-memory
    }
  }, [cart]);

  function add(ticket) {
    setCart((prev) => (prev.some((t) => t.id === ticket.id) ? prev : [...prev, ticket]));
  }
  function remove(id) {
    setCart((prev) => prev.filter((t) => t.id !== id));
  }
  function clear() {
    setCart([]);
  }
  function has(id) {
    return cart.some((t) => t.id === id);
  }

  return (
    <CartContext.Provider value={{ cart, add, remove, clear, has }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
