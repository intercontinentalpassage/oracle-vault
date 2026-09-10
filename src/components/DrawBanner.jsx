import { useState } from "react";
import { t } from "../lib/i18n";

const EXPAND_THRESHOLD = 10;

export default function DrawBanner({ lang, draw }) {
  const [showAll, setShowAll] = useState(false);
  const [expandedTiers, setExpandedTiers] = useState(new Set());

  if (!draw) {
    return <div className="ov-draw-empty">{t(lang, "noDrawPublished")}</div>;
  }
  const tiers = Array.isArray(draw.tiers) ? draw.tiers : [];
  const first = tiers[0];
  const firstNumbers = first?.numbers?.[0];

  function toggleTier(i) {
    setExpandedTiers((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="ov-draw-banner">
      <div className="ov-draw-top">
        <div>
          <div className="ov-draw-label">
            {t(lang, "winningNumbersFull", { label: draw.label, prize: first ? first.prize : "—" })}
          </div>
          {firstNumbers && (
            <div className="ov-draw-numbers">
              {firstNumbers.split("").map((d, i) => (
                <div className="ov-draw-digit" key={i}>
                  {d}
                </div>
              ))}
            </div>
          )}
        </div>
        {tiers.length > 1 && (
          <button className="ov-draw-toggle" onClick={() => setShowAll((s) => !s)}>
            {showAll ? t(lang, "hideAllPrizes") : t(lang, "showAllPrizes")}
          </button>
        )}
      </div>
      {showAll && tiers.length > 1 && (
        <div className="ov-draw-tiers">
          {tiers.map((tier, i) => {
            const numbers = tier.numbers || [];
            const many = numbers.length > EXPAND_THRESHOLD;
            const expanded = expandedTiers.has(i);
            return (
              <div className="ov-draw-tier" key={i}>
                <div className="ov-draw-tier-label">
                  {tier.label || tier.name} · {tier.prize}
                  {many && <span style={{ opacity: 0.7 }}> · {numbers.length} numbers</span>}
                </div>
                {numbers.length > 0 &&
                  (many && !expanded ? (
                    <button className="ov-draw-tier-expand" onClick={() => toggleTier(i)}>
                      Show numbers
                    </button>
                  ) : (
                    <>
                      <div className="ov-draw-tier-numbers">{numbers.join(" · ")}</div>
                      {many && (
                        <button className="ov-draw-tier-expand" onClick={() => toggleTier(i)}>
                          Hide
                        </button>
                      )}
                    </>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
