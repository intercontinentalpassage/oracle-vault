import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { I18N } from "../../lib/i18n";
import { setOverride, setKeyLocked } from "../../lib/translationsStore";

const LANGS = [
  { code: "en", label: "English" },
  { code: "my", label: "မြန်မာ" },
  { code: "th", label: "ไทย" },
];

// The full canonical key list + English fallback text comes from the
// built-in defaults, so every key always shows here even before any DB
// row exists for it (e.g. right after a code update adds a new string).
const KEYS = Object.keys(I18N.en);

export default function AdminTranslations() {
  const [rows, setRows] = useState({}); // { key: { en, my, th } }
  const [lockedKeys, setLockedKeys] = useState({}); // { key: true }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const [translationsRes, locksRes] = await Promise.all([
      supabase.from("translations").select("*"),
      supabase.from("translation_locks").select("*"),
    ]);
    if (translationsRes.error) setError(translationsRes.error.message);

    const next = {};
    KEYS.forEach((key) => {
      next[key] = { en: I18N.en[key], my: I18N.my[key] || "", th: I18N.th[key] || "" };
    });
    (translationsRes.data || []).forEach((r) => {
      if (!next[r.key]) next[r.key] = { en: "", my: "", th: "" };
      next[r.key][r.lang] = r.value;
    });
    setRows(next);

    const lockMap = {};
    (locksRes.data || []).forEach((r) => {
      if (r.locked) lockMap[r.key] = true;
    });
    setLockedKeys(lockMap);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(key, lang, value) {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], [lang]: value } }));
  }

  async function toggleLock(key) {
    const nextLocked = !lockedKeys[key];
    setLockedKeys((prev) => ({ ...prev, [key]: nextLocked }));
    const { error: lockError } = await supabase
      .from("translation_locks")
      .upsert({ key, locked: nextLocked }, { onConflict: "key" });
    if (lockError) {
      setError(lockError.message);
      return;
    }
    setKeyLocked(key, nextLocked);
  }

  async function saveKey(key) {
    setSavingKey(key);
    setError("");
    try {
      const values = rows[key];
      // When locked, keep all three language rows in sync with the
      // English text so nothing stale lingers if it's ever unlocked later.
      const finalValues = lockedKeys[key] ? { en: values.en, my: values.en, th: values.en } : values;
      const upserts = LANGS.map((l) => ({ key, lang: l.code, value: finalValues[l.code] || "" }));
      const { error: upsertError } = await supabase.from("translations").upsert(upserts, { onConflict: "key,lang" });
      if (upsertError) throw upsertError;
      LANGS.forEach((l) => setOverride(l.code, key, finalValues[l.code] || ""));
      if (lockedKeys[key]) setRows((prev) => ({ ...prev, [key]: finalValues }));
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingKey(null);
    }
  }

  const visibleKeys = KEYS.filter((key) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    const r = rows[key];
    return key.toLowerCase().includes(s) || r?.en?.toLowerCase().includes(s) || r?.my?.includes(search) || r?.th?.includes(search);
  });

  if (loading) return <p style={{ color: "#5A6560" }}>Loading…</p>;

  return (
    <div>
      <h1>Storefront text</h1>
      <p style={{ fontSize: 13, color: "#5A6560", marginTop: -14, marginBottom: 20 }}>
        Edit any text customers see on the storefront, in any language. Keep any <code>{"{placeholder}"}</code> tokens
        intact (e.g. <code>{"{name}"}</code>, <code>{"{count}"}</code>) — those get swapped for real values when shown.
        Toggle "Same in all languages" for anything that shouldn't change when a customer switches language (like a
        brand name).
      </p>

      <input
        className="ov-input"
        style={{ width: 320, marginBottom: 16 }}
        placeholder="Search by text or key…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <p style={{ color: "#B23A2E", fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visibleKeys.map((key) => {
          const locked = !!lockedKeys[key];
          return (
            <div className="ov-card" key={key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#8FA69D", fontFamily: "'Space Mono', monospace" }}>{key}</span>
                <label style={{ fontSize: 12, color: "#5A6560", display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={locked} onChange={() => toggleLock(key)} />
                  Same in all languages
                </label>
              </div>

              {locked ? (
                <label>
                  Text (used for every language)
                  <textarea
                    className="ov-input"
                    rows={2}
                    value={rows[key]?.en || ""}
                    onChange={(e) => updateField(key, "en", e.target.value)}
                    style={{ resize: "vertical" }}
                  />
                </label>
              ) : (
                <div className="ov-form-row" style={{ marginBottom: 0 }}>
                  {LANGS.map((l) => (
                    <label key={l.code} style={{ flex: "1 1 220px" }}>
                      {l.label}
                      <textarea
                        className="ov-input"
                        rows={2}
                        value={rows[key]?.[l.code] || ""}
                        onChange={(e) => updateField(key, l.code, e.target.value)}
                        style={{ resize: "vertical" }}
                      />
                    </label>
                  ))}
                </div>
              )}

              <button
                className="ov-btn-sm primary"
                style={{ marginTop: 10 }}
                onClick={() => saveKey(key)}
                disabled={savingKey === key}
              >
                {savingKey === key ? "Saving…" : "Save"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
