// Cleans up whatever an agent types into the Telegram box.
// Accepts "@name", "name", "t.me/name" or "https://t.me/name".
// Returns "" for a blank box, the bare username when valid, or null when invalid
// (Telegram usernames are 5-32 letters, numbers or underscores).
export function normalizeTelegram(raw) {
  let v = (raw || "").trim();
  if (!v) return "";
  v = v.replace(/^https?:\/\//i, "").replace(/^(www\.)?(t|telegram)\.me\//i, "");
  v = v.split(/[/?#]/)[0].replace(/^@/, "");
  return /^[A-Za-z0-9_]{5,32}$/.test(v) ? v : null;
}

export function telegramUrl(username) {
  return username ? `https://t.me/${username}` : null;
}
