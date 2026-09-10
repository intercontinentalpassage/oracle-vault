import { useState } from "react";
import { t } from "../lib/i18n";
import { getSiteSetting, useSiteSettingsVersion } from "../lib/siteSettingsStore";

const EXPAND_THRESHOLD = 10;

export default function DrawBanner({ lang, draw }) {
  const [showAll, setShowAll] = useState(false);
  const [expandedTiers, setExpandedTiers] = useState(new Set());
  useSiteSettingsVersion();

  const bannerBgUrl = getSiteSetting("draw_banner_bg_url");
  const bannerBgColor = getSiteSetting("draw_banner_bg_color") || "#0E1512";
  const bannerBgOverlay = Number(getSiteSetting("draw_banner_bg_overlay") ?? 70);
  const bannerStyle = bannerBgUrl
    ? {
        backgroundImage: `linear-gradient(rgba(14,21,18,${bannerBgOverlay / 100}), rgba(14,21,18,${bannerBgOverlay / 100})), url(${bannerBgUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { background: bannerBgColor };

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
    <div className="ov-draw-banner" style={bannerStyle}>
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

      {tiers.length > 1 && (
        <div className={`ov-collapse${showAll ? " open" : ""}`}>
          <div className="ov-collapse-inner">
            <div className="ov-draw-tiers">
              {tiers.map((tier, i) => {
                const numbers = tier.numbers || [];
                const many = numbers.length > EXPAND_THRESHOLD;
                const expanded = !many || expandedTiers.has(i);
                return (
                  <div className="ov-draw-tier" key={i}>
                    <div className="ov-draw-tier-label">
                      {tier.label || tier.name} · {tier.prize}
                      {many && <span style={{ opacity: 0.7 }}> · {numbers.length} numbers</span>}
                    </div>
                    {numbers.length > 0 && (
                      <>
                        <div className={`ov-collapse${expanded ? " open" : ""}`}>
                          <div className="ov-collapse-inner">
                            <div className="ov-draw-tier-grid">
                              {numbers.map((n, ni) => (
                                <span className="ov-draw-tier-number" key={ni}>
                                  {n}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        {many && (
                          <button className="ov-draw-tier-expand" onClick={() => toggleTier(i)}>
                            {expanded ? "Hide" : "Show numbers"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
