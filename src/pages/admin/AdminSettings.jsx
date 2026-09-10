import { useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getCurrencySymbol, getSiteSetting, setSiteSetting, useSiteSettingsVersion } from "../../lib/siteSettingsStore";
import { compressImage } from "../../lib/imageCompress";
import ChangePassword from "../../components/ChangePassword";
import BrandBadge from "../../components/BrandBadge";

export default function AdminSettings() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef(null);
  useSiteSettingsVersion();
  const [currencyInput, setCurrencyInput] = useState(null);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencySaved, setCurrencySaved] = useState(false);
  const currentCurrency = getCurrencySymbol();
  const displayedCurrency = currencyInput === null ? currentCurrency : currencyInput;

  const [uploadingBg, setUploadingBg] = useState(false);
  const [bgSaved, setBgSaved] = useState(false);
  const bgFileInputRef = useRef(null);
  const [overlayInput, setOverlayInput] = useState(null);
  const savedOverlay = Number(getSiteSetting("results_bg_overlay") ?? 85);
  const overlayValue = overlayInput === null ? savedOverlay : overlayInput;
  const resultsBgUrl = getSiteSetting("results_bg_url");

  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerSaved, setBannerSaved] = useState(false);
  const bannerFileInputRef = useRef(null);
  const [bannerOverlayInput, setBannerOverlayInput] = useState(null);
  const savedBannerOverlay = Number(getSiteSetting("draw_banner_bg_overlay") ?? 70);
  const bannerOverlayValue = bannerOverlayInput === null ? savedBannerOverlay : bannerOverlayInput;
  const bannerBgUrl = getSiteSetting("draw_banner_bg_url");
  const [bannerColorInput, setBannerColorInput] = useState(null);
  const savedBannerColor = getSiteSetting("draw_banner_bg_color") || "#0E1512";
  const bannerColorValue = bannerColorInput === null ? savedBannerColor : bannerColorInput;

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setSaved(false);
    try {
      const { blob } = await compressImage(file, { maxDimension: 512, format: "image/png" });
      const path = `logo.png`;
      const { error: uploadError } = await supabase.storage
        .from("site-assets")
        .upload(path, blob, { upsert: true, cacheControl: "3600", contentType: "image/png" });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from("site-assets").getPublicUrl(path);
      const bustedUrl = `${pub.publicUrl}?t=${Date.now()}`;

      const { error: settingError } = await supabase
        .from("site_settings")
        .upsert({ key: "logo_url", value: bustedUrl }, { onConflict: "key" });
      if (settingError) throw settingError;

      setSiteSetting("logo_url", bustedUrl);
      setSaved(true);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeLogo() {
    setUploading(true);
    setError("");
    const { error: settingError } = await supabase
      .from("site_settings")
      .upsert({ key: "logo_url", value: null }, { onConflict: "key" });
    setUploading(false);
    if (settingError) {
      setError(settingError.message);
      return;
    }
    setSiteSetting("logo_url", null);
  }

  async function saveCurrency() {
    const value = (displayedCurrency || "").trim();
    if (!value) return;
    setSavingCurrency(true);
    setError("");
    setCurrencySaved(false);
    const { error: settingError } = await supabase
      .from("site_settings")
      .upsert({ key: "currency_symbol", value }, { onConflict: "key" });
    setSavingCurrency(false);
    if (settingError) {
      setError(settingError.message);
      return;
    }
    setSiteSetting("currency_symbol", value);
    setCurrencyInput(null);
    setCurrencySaved(true);
  }

  async function handleResultsBgUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    setError("");
    setBgSaved(false);
    try {
      const { blob, format } = await compressImage(file, { maxDimension: 800, quality: 0.78 });
      const path = format === "image/webp" ? "results-bg.webp" : "results-bg.jpg";
      const { error: uploadError } = await supabase.storage
        .from("site-assets")
        .upload(path, blob, { upsert: true, cacheControl: "3600", contentType: format });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from("site-assets").getPublicUrl(path);
      const bustedUrl = `${pub.publicUrl}?t=${Date.now()}`;

      const { error: settingError } = await supabase
        .from("site_settings")
        .upsert({ key: "results_bg_url", value: bustedUrl }, { onConflict: "key" });
      if (settingError) throw settingError;

      setSiteSetting("results_bg_url", bustedUrl);
      setBgSaved(true);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setUploadingBg(false);
      if (bgFileInputRef.current) bgFileInputRef.current.value = "";
    }
  }

  async function removeResultsBg() {
    setUploadingBg(true);
    setError("");
    const { error: settingError } = await supabase
      .from("site_settings")
      .upsert({ key: "results_bg_url", value: null }, { onConflict: "key" });
    setUploadingBg(false);
    if (settingError) {
      setError(settingError.message);
      return;
    }
    setSiteSetting("results_bg_url", null);
  }

  async function saveOverlay(value) {
    setOverlayInput(value);
    const { error: settingError } = await supabase
      .from("site_settings")
      .upsert({ key: "results_bg_overlay", value: String(value) }, { onConflict: "key" });
    if (settingError) {
      setError(settingError.message);
      return;
    }
    setSiteSetting("results_bg_overlay", String(value));
  }

  async function handleBannerUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    setError("");
    setBannerSaved(false);
    try {
      const { blob, format } = await compressImage(file, { maxDimension: 1600, quality: 0.8 });
      const path = format === "image/webp" ? "draw-banner-bg.webp" : "draw-banner-bg.jpg";
      const { error: uploadError } = await supabase.storage
        .from("site-assets")
        .upload(path, blob, { upsert: true, cacheControl: "3600", contentType: format });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from("site-assets").getPublicUrl(path);
      const bustedUrl = `${pub.publicUrl}?t=${Date.now()}`;

      const { error: settingError } = await supabase
        .from("site_settings")
        .upsert({ key: "draw_banner_bg_url", value: bustedUrl }, { onConflict: "key" });
      if (settingError) throw settingError;

      setSiteSetting("draw_banner_bg_url", bustedUrl);
      setBannerSaved(true);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setUploadingBanner(false);
      if (bannerFileInputRef.current) bannerFileInputRef.current.value = "";
    }
  }

  async function removeBannerPhoto() {
    setUploadingBanner(true);
    setError("");
    const { error: settingError } = await supabase
      .from("site_settings")
      .upsert({ key: "draw_banner_bg_url", value: null }, { onConflict: "key" });
    setUploadingBanner(false);
    if (settingError) {
      setError(settingError.message);
      return;
    }
    setSiteSetting("draw_banner_bg_url", null);
  }

  async function saveBannerOverlay(value) {
    setBannerOverlayInput(value);
    const { error: settingError } = await supabase
      .from("site_settings")
      .upsert({ key: "draw_banner_bg_overlay", value: String(value) }, { onConflict: "key" });
    if (settingError) {
      setError(settingError.message);
      return;
    }
    setSiteSetting("draw_banner_bg_overlay", String(value));
  }

  async function saveBannerColor(value) {
    setBannerColorInput(value);
    const { error: settingError } = await supabase
      .from("site_settings")
      .upsert({ key: "draw_banner_bg_color", value }, { onConflict: "key" });
    if (settingError) {
      setError(settingError.message);
      return;
    }
    setSiteSetting("draw_banner_bg_color", value);
  }

  return (
    <div>
      <h1>Settings</h1>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Site logo</strong>
        <p style={{ fontSize: 12, color: "#5A6560", margin: "4px 0 12px" }}>
          Shown in place of the default mark on the storefront, agent shops, and Admin/Agent dashboards.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <BrandBadge size={48} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ov-btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload logo"}
            </button>
            {getSiteSetting("logo_url") && (
              <button className="ov-btn-sm danger" onClick={removeLogo} disabled={uploading}>
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleLogoUpload}
          />
        </div>
        {error && <p style={{ color: "#B23A2E", fontSize: 13, marginTop: 8 }}>{error}</p>}
        {saved && <p style={{ color: "#0B5C4A", fontSize: 13, marginTop: 8 }}>Logo updated.</p>}
      </div>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Currency symbol</strong>
        <p style={{ fontSize: 12, color: "#5A6560", margin: "4px 0 12px" }}>
          Shown next to every price across the storefront, agent shops, and Admin/Agent dashboards.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", maxWidth: 240 }}>
          <label style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#5A6560" }}>Symbol</span>
            <input
              className="ov-input"
              value={displayedCurrency}
              onChange={(e) => {
                setCurrencyInput(e.target.value);
                setCurrencySaved(false);
              }}
              placeholder="฿"
              maxLength={5}
            />
          </label>
          <button
            className="ov-btn-sm primary"
            onClick={saveCurrency}
            disabled={savingCurrency || !displayedCurrency.trim() || displayedCurrency === currentCurrency}
          >
            {savingCurrency ? "Saving…" : "Save"}
          </button>
        </div>
        {currencySaved && <p style={{ color: "#0B5C4A", fontSize: 13, marginTop: 8 }}>Currency updated.</p>}
      </div>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Background photo (ticket cards)</strong>
        <p style={{ fontSize: 12, color: "#5A6560", margin: "4px 0 8px" }}>
          Shows as the background of every ticket card on the storefront and every agent shop. Sits behind the
          ticket digits and "In stock" badge (which stay solid), so it won't interfere with reading numbers.
        </p>
        <p style={{ fontSize: 12, color: "#8FA69D", margin: "0 0 12px" }}>
          Suggested size: 1600×900px or larger, landscape orientation, under 2MB for fast loading.
        </p>

        {resultsBgUrl && (
          <div
            style={{
              width: "100%",
              maxWidth: 360,
              height: 120,
              borderRadius: 10,
              marginBottom: 12,
              backgroundImage: `linear-gradient(rgba(255,255,255,${overlayValue / 100}), rgba(255,255,255,${overlayValue / 100})), url(${resultsBgUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: "1px solid #E7EBE9",
            }}
          />
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className="ov-btn-sm" onClick={() => bgFileInputRef.current?.click()} disabled={uploadingBg}>
            {uploadingBg ? "Uploading…" : resultsBgUrl ? "Replace photo" : "Upload photo"}
          </button>
          {resultsBgUrl && (
            <button className="ov-btn-sm danger" onClick={removeResultsBg} disabled={uploadingBg}>
              Remove
            </button>
          )}
          <input
            ref={bgFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleResultsBgUpload}
          />
        </div>

        {resultsBgUrl && (
          <label style={{ display: "block", maxWidth: 360 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#5A6560" }}>
              Overlay strength — higher fades the photo more for readability ({overlayValue}%)
            </span>
            <input
              type="range"
              min="40"
              max="98"
              step="1"
              value={overlayValue}
              onChange={(e) => setOverlayInput(Number(e.target.value))}
              onMouseUp={(e) => saveOverlay(Number(e.target.value))}
              onTouchEnd={(e) => saveOverlay(Number(e.target.value))}
              onKeyUp={(e) => saveOverlay(Number(e.target.value))}
              style={{ width: "100%", marginTop: 8 }}
            />
          </label>
        )}

        {bgSaved && <p style={{ color: "#0B5C4A", fontSize: 13, marginTop: 8 }}>Background updated.</p>}
      </div>

      <div className="ov-card" style={{ marginBottom: 20 }}>
        <strong style={{ fontSize: 13 }}>Winning-numbers banner</strong>
        <p style={{ fontSize: 12, color: "#5A6560", margin: "4px 0 12px" }}>
          The dark banner showing winning numbers on the storefront. Pick a solid color, or upload a photo instead
          — whichever's set last takes effect (uploading a photo overrides the color; removing the photo falls
          back to the color).
        </p>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 16 }}>
          <label>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#5A6560" }}>Solid color</span>
            <input
              type="color"
              value={bannerColorValue}
              onChange={(e) => saveBannerColor(e.target.value)}
              style={{ display: "block", width: 60, height: 40, marginTop: 6, border: "1px solid #DDE3E0", borderRadius: 8, cursor: "pointer" }}
            />
          </label>
        </div>

        <p style={{ fontSize: 12, color: "#8FA69D", margin: "0 0 12px" }}>
          Photo option — suggested size: 1600×600px or larger, landscape, under 2MB.
        </p>

        {bannerBgUrl && (
          <div
            style={{
              width: "100%",
              maxWidth: 360,
              height: 100,
              borderRadius: 10,
              marginBottom: 12,
              backgroundImage: `linear-gradient(rgba(14,21,18,${bannerOverlayValue / 100}), rgba(14,21,18,${bannerOverlayValue / 100})), url(${bannerBgUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: "1px solid #E7EBE9",
            }}
          />
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className="ov-btn-sm" onClick={() => bannerFileInputRef.current?.click()} disabled={uploadingBanner}>
            {uploadingBanner ? "Uploading…" : bannerBgUrl ? "Replace photo" : "Upload photo"}
          </button>
          {bannerBgUrl && (
            <button className="ov-btn-sm danger" onClick={removeBannerPhoto} disabled={uploadingBanner}>
              Remove photo
            </button>
          )}
          <input
            ref={bannerFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleBannerUpload}
          />
        </div>

        {bannerBgUrl && (
          <label style={{ display: "block", maxWidth: 360 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#5A6560" }}>
              Overlay strength — higher darkens the photo more, so light text stays readable ({bannerOverlayValue}%)
            </span>
            <input
              type="range"
              min="30"
              max="95"
              step="1"
              value={bannerOverlayValue}
              onChange={(e) => setBannerOverlayInput(Number(e.target.value))}
              onMouseUp={(e) => saveBannerOverlay(Number(e.target.value))}
              onTouchEnd={(e) => saveBannerOverlay(Number(e.target.value))}
              onKeyUp={(e) => saveBannerOverlay(Number(e.target.value))}
              style={{ width: "100%", marginTop: 8 }}
            />
          </label>
        )}

        {bannerSaved && <p style={{ color: "#0B5C4A", fontSize: 13, marginTop: 8 }}>Banner background updated.</p>}
      </div>

      <div className="ov-card">
        <strong style={{ fontSize: 13 }}>Backend</strong>
        <p style={{ fontSize: 13, color: "#5A6560", marginTop: 6 }}>
          Oracle Vault runs on Supabase. This deployment is connected to:
        </p>
        <code style={{ fontSize: 12, background: "#F4F8F6", padding: "6px 10px", borderRadius: 8, display: "inline-block" }}>
          {url}
        </code>
        <p style={{ fontSize: 13, color: "#5A6560", marginTop: 16 }}>
          To manage tables, security policies, or Storage buckets directly, use the{" "}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ color: "#0F7A63" }}>
            Supabase dashboard
          </a>
          . Staff logins (creating accounts, roles, password resets) are now managed from Admin → All logins.
        </p>
      </div>

      <ChangePassword />
    </div>
  );
}
