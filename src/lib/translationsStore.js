import { supabase } from "./supabaseClient";

let overrides = null; // null = not loaded yet; {} once loaded, even if empty
let locks = {}; // { key: true } for keys locked to a single language
let loadingPromise = null;
const listeners = new Set();

export function getOverride(lang, key) {
  return overrides?.[lang]?.[key];
}

export function isKeyLocked(key) {
  return !!locks[key];
}

export function isLoaded() {
  return overrides !== null;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function ensureTranslationsLoaded() {
  if (overrides !== null) return Promise.resolve();
  if (loadingPromise) return loadingPromise;
  loadingPromise = Promise.all([
    supabase.from("translations").select("key, lang, value"),
    supabase.from("translation_locks").select("key, locked"),
  ])
    .then(([translationsRes, locksRes]) => {
      const next = {};
      (translationsRes.data || []).forEach((row) => {
        next[row.lang] = next[row.lang] || {};
        next[row.lang][row.key] = row.value;
      });
      overrides = next;

      const nextLocks = {};
      (locksRes.data || []).forEach((row) => {
        if (row.locked) nextLocks[row.key] = true;
      });
      locks = nextLocks;

      listeners.forEach((fn) => fn());
    })
    .catch(() => {
      // If the fetch fails, fall back silently to the built-in defaults —
      // overrides stays null so getOverride() keeps returning undefined.
    });
  return loadingPromise;
}

// Used by the Admin translations editor to update the in-memory cache
// immediately after a successful save, without waiting for a refetch.
export function setOverride(lang, key, value) {
  if (overrides === null) overrides = {};
  overrides[lang] = overrides[lang] || {};
  overrides[lang][key] = value;
  listeners.forEach((fn) => fn());
}

export function setKeyLocked(key, locked) {
  if (locked) locks[key] = true;
  else delete locks[key];
  listeners.forEach((fn) => fn());
}
