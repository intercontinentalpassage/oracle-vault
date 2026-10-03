import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

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
  const removeMany = useCallback((ids) => {
    const drop = new Set(ids);
    setCart((prev) => prev.filter((t) => !drop.has(t.id)));
  }, []);

  // Tickets this browser is in the middle of selling (staff Sell). Live updates
  // for them are our own sale, so the cart guard must not treat them as
  // "sold to someone else".
  const sellingRef = useRef(new Set());
  const markSelling = useCallback((ids) => {
    sellingRef.current = new Set(ids);
  }, []);
  const unmarkSelling = useCallback(() => {
    sellingRef.current = new Set();
  }, []);
  const isSelling = useCallback((id) => sellingRef.current.has(id), []);
  function has(id) {
    return cart.some((t) => t.id === id);
  }

  return (
    <CartContext.Provider value={{ cart, add, remove, clear, has, removeMany, markSelling, unmarkSelling, isSelling }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
