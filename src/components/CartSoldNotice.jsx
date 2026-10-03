import { useEffect } from "react";
import { t } from "../lib/i18n";

// Small notice shown when numbers in the cart were sold to someone else and
// removed. Hides itself after a few seconds, or with the close button.
export default function CartSoldNotice({ lang, numbers, onDismiss }) {
  useEffect(() => {
    if (!numbers.length) return undefined;
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [numbers, onDismiss]);

  if (!numbers.length) return null;
  return (
    <div className="ov-cart-notice" role="status">
      <span>{t(lang, "cartNumbersJustSold", { numbers: numbers.join(", ") })}</span>
      <button type="button" className="ov-cart-notice-close" onClick={onDismiss} aria-label={t(lang, "close")}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
