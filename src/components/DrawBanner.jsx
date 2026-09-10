import { useState } from "react";
import { t } from "../lib/i18n";

export default function DrawBanner({ lang, draw }) {
  const [showAll, setShowAll] = useState(false);
  if (!draw) {
    return <div className="ov-draw-empty">{t(lang, "noDrawPublished")}</div>;
  }
  const tiers = Array.isArray(draw.tiers) ? draw.tiers : [];
  const first = tiers[0];
  const firstNumbers = first?.numbers?.[0];

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
          {tiers.map((tier, i) => (
            <div className="ov-draw-tier" key={i}>
              <div className="ov-draw-tier-label">
                {tier.label || tier.name} · {tier.prize}
              </div>
              {tier.numbers && <div className="ov-draw-tier-numbers">{tier.numbers.join(" · ")}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
