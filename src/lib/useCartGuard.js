import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { useCart } from "./CartContext";

// Removes numbers from the cart once they are no longer available (sold by
// someone else, deleted, ...) and reports which ones, so the page can show a
// short notice. The cart is saved in the browser, so this also catches numbers
// that sold while the customer was away.
export function useCartGuard() {
  const { cart, removeMany, isSelling } = useCart();
  const [removedNumbers, setRemovedNumbers] = useState([]);
  const cartRef = useRef(cart);
  cartRef.current = cart;

  const dropIds = useCallback(
    (ids) => {
      // Ignore the tickets this browser is selling right now — that's our own
      // sale going through, not someone else taking them.
      const drop = new Set(ids.filter((id) => !isSelling(id)));
      const gone = cartRef.current.filter((tk) => drop.has(tk.id));
      if (!gone.length) return;
      removeMany(gone.map((tk) => tk.id));
      setRemovedNumbers((prev) => [...new Set([...prev, ...gone.map((tk) => tk.number)])]);
    },
    [removeMany, isSelling]
  );

  // Ask the database directly about everything in the cart.
  const recheck = useCallback(async () => {
    const ids = cartRef.current.map((tk) => tk.id);
    if (!ids.length) return;
    const { data, error } = await supabase.from("tickets").select("id, status").in("id", ids);
    if (error) return; // offline or similar — try again on the next trigger
    const stillAvailable = new Set((data || []).filter((r) => r.status === "available").map((r) => r.id));
    dropIds(ids.filter((id) => !stillAvailable.has(id)));
  }, [dropIds]);

  useEffect(() => {
    recheck();
    // Only on page open; later checks come from live updates and resyncs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = useCallback(() => setRemovedNumbers([]), []);

  return { removedNumbers, dismiss, dropIds, recheck };
}
