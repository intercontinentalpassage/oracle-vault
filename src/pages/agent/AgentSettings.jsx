import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import ChangePassword from "../../components/ChangePassword";

export default function AgentSettings() {
  const { agentId } = useOutletContext();
  const [agent, setAgent] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [heroUrl, setHeroUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  async function loadAgent() {
    const { data } = await supabase.from("agents").select("*").eq("id", agentId).single();
    if (data) {
      setAgent(data);
      setName(data.name || "");
      setPhone(data.phone || "");
      setHeroUrl(data.hero_image_url || "");
    }
  }

  useEffect(() => {
    loadAgent();
  }, [agentId]);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    const { error: updateError } = await supabase
      .from("agents")
      .update({ name: name.trim(), phone: phone.trim() || null, hero_image_url: heroUrl.trim() || null })
      .eq("id", agentId);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const ext = file.name.split(".").pop();
      const path = `${agentId}/hero.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("agent-hero")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from("agent-hero").getPublicUrl(path);
      // Cache-bust so the new image shows immediately even though the URL
      // itself doesn't change on re-upload.
      const bustedUrl = `${pub.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("agents")
        .update({ hero_image_url: bustedUrl })
        .eq("id", agentId);
      if (updateError) throw updateError;

      setHeroUrl(bustedUrl);
      setSaved(true);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (!agent) return <p style={{ color: "#5A6560" }}>Loading…</p>;

  return (
    <div>
      <h1>Shop settings</h1>

      <div className="ov-card" style={{ maxWidth: 480 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#5A6560" }}>
          Shop name
          <input className="ov-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={{ fontSize: 12, fontWeight: 600, color: "#5A6560", display: "block", marginTop: 12 }}>
          Phone
          <input className="ov-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>

        <div style={{ marginTop: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#5A6560" }}>Hero image</span>
          {heroUrl && (
            <img
              src={heroUrl}
              alt="Hero preview"
              style={{ marginTop: 8, width: "100%", borderRadius: 10, maxHeight: 140, objectFit: "cover" }}
              onError={(e) => (e.target.style.display = "none")}
            />
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <button
              className="ov-btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload photo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>
        </div>

        <p style={{ fontSize: 12, color: "#5A6560", marginTop: 14 }}>
          Your shop link: <code>/shop/{agent.slug}</code>
        </p>
        {error && <p style={{ color: "#B23A2E", fontSize: 13, marginTop: 8 }}>{error}</p>}
        {saved && <p style={{ color: "#0B5C4A", fontSize: 13, marginTop: 8 }}>Saved.</p>}
        <button className="ov-btn-sm primary" onClick={save} disabled={saving} style={{ marginTop: 12 }}>
          {saving ? "Saving…" : "Save name/phone"}
        </button>
      </div>

      <ChangePassword />
    </div>
  );
}
