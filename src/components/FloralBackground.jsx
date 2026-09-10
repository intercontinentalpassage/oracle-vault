// Subtle vine/lotus scrollwork pattern (original linework inspired by
// traditional Thai/Burmese scroll motifs) used as a low-opacity texture
// behind the hero section. Purely decorative — aria-hidden, no interaction.
export default function FloralBackground() {
  return (
    <svg
      className="ov-floral-bg"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 380 210"
      aria-hidden="true"
    >
      <defs>
        <pattern id="ovFloralScroll" x="0" y="0" width="76" height="76" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="#0F7A63" strokeWidth="1.2" opacity="0.14">
            <path d="M4 38 C 4 20, 20 8, 38 8 C 56 8, 72 20, 72 38 C 72 56, 56 68, 38 68 C 20 68, 4 56, 4 38 Z" />
            <path d="M38 8 C 46 18, 46 30, 38 38 C 30 30, 30 18, 38 8 Z" />
            <path d="M72 38 C 62 46, 50 46, 42 38 C 50 30, 62 30, 72 38 Z" />
            <path d="M38 68 C 30 58, 30 46, 38 38 C 46 46, 46 58, 38 68 Z" />
            <path d="M4 38 C 14 30, 26 30, 34 38 C 26 46, 14 46, 4 38 Z" />
            <circle cx="38" cy="38" r="5" />
          </g>
        </pattern>
      </defs>
      <rect x="0" y="0" width="380" height="210" fill="url(#ovFloralScroll)" />
    </svg>
  );
}
