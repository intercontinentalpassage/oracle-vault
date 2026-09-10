export default function LanguageSwitcher({ lang, onChange }) {
  return (
    <select
      className="ov-lang-select"
      value={lang}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Language"
    >
      <option value="en">English</option>
      <option value="my">မြန်မာ</option>
      <option value="th">ไทย</option>
    </select>
  );
}
