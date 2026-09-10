import { useEffect, useState } from "react";
import { ensureSiteSettingsLoaded, getSiteSetting, subscribeSiteSettings } from "../lib/siteSettingsStore";

export default function BrandBadge({ size = 32 }) {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeSiteSettings(() => forceRender((n) => n + 1));
    ensureSiteSettingsLoaded();
    return unsubscribe;
  }, []);

  const logoUrl = getSiteSetting("logo_url");

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Oracle Vault"
        style={{ width: size, height: size, borderRadius: size * 0.3, objectFit: "cover" }}
        onError={(e) => (e.target.style.display = "none")}
      />
    );
  }

  return (
    <div className="ov-brand-badge" style={{ width: size, height: size, fontSize: size * 0.44 }}>
      88
    </div>
  );
}
