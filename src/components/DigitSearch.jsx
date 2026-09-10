import { t } from "../lib/i18n";

export default function DigitSearch({ lang, length, digits, setDigits, anywhere, setAnywhere, resultSummary }) {
  function updateDigit(i, value) {
    const clean = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < length - 1) {
      const el = document.getElementById(`ov-digit-${i + 1}`);
      if (el) el.focus();
    }
  }

  function handleKeyDown(i, e) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      const el = document.getElementById(`ov-digit-${i - 1}`);
      if (el) el.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      const el = document.getElementById(`ov-digit-${i - 1}`);
      if (el) el.focus();
    } else if (e.key === "ArrowRight" && i < length - 1) {
      const el = document.getElementById(`ov-digit-${i + 1}`);
      if (el) el.focus();
    }
  }

  return (
    <div className="ov-search-card">
      <div className="ov-search-card-top">
        <span>{t(lang, "yourDigits")}</span>
        {digits.some(Boolean) && (
          <button className="ov-link-btn" onClick={() => setDigits(Array(length).fill(""))}>
            {t(lang, "clear")}
          </button>
        )}
      </div>
      <div className="ov-digit-boxes">
        {Array.from({ length }).map((_, i) => (
          <input
            key={i}
            id={`ov-digit-${i}`}
            className="ov-digit-input"
            inputMode="numeric"
            maxLength={1}
            value={digits[i] || ""}
            onChange={(e) => updateDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
          />
        ))}
      </div>
      <div className="ov-search-row">
        <label className="ov-checkbox-label">
          <input type="checkbox" checked={anywhere} onChange={(e) => setAnywhere(e.target.checked)} />
          {t(lang, "anywhereInNumber")}
        </label>
        {resultSummary && <span className="ov-result-summary">{resultSummary}</span>}
      </div>
    </div>
  );
}
