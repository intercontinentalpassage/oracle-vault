import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

let settings = null; // null = not loaded yet
let loadingPromise = null;
const listeners = new Set();

export function getSiteSetting(key) {
  return settings?.[key] || null;
}

export function subscribeSiteSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function ensureSiteSettingsLoaded() {
  if (settings !== null) return Promise.resolve();
  if (loadingPromise) return loadingPromise;
  loadingPromise = supabase
    .from("site_settings")
    .select("key, value")
    .then(({ data }) => {
      const next = {};
      (data || []).forEach((row) => (next[row.key] = row.value));
      settings = next;
      listeners.forEach((fn) => fn());
    })
    .catch(() => {
      settings = {};
    });
  return loadingPromise;
}

export function setSiteSetting(key, value) {
  if (settings === null) settings = {};
  settings[key] = value;
  listeners.forEach((fn) => fn());
}

// Hook: components that display live-editable site settings (currency
// symbol, etc.) call this to both trigger the initial load and re-render
// automatically whenever an admin changes a setting elsewhere.
export function useSiteSettingsVersion() {
  const [, forceRender] = useState(0);
  useEffect(() => {
    const unsubscribe = subscribeSiteSettings(() => forceRender((n) => n + 1));
    ensureSiteSettingsLoaded();
    return unsubscribe;
  }, []);
}

export function getCurrencySymbol() {
  return getSiteSetting("currency_symbol") || "฿";
}
