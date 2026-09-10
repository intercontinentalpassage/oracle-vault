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
