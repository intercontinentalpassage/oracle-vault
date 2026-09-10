import { useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getSiteSetting, setSiteSetting } from "../../lib/siteSettingsStore";
import ChangePassword from "../../components/ChangePassword";
import BrandBadge from "../../components/BrandBadge";

export default function AdminSettings() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef(null);

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setSaved(false);
    try {
      const ext = file.name.split(".").pop();
      const path = `logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("site-assets")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
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
