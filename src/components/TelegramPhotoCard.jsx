import BrandBadge from "./BrandBadge";

// The picture posted to the Telegram channel when a customer taps "Buy in Telegram".
// It is rendered off-screen by CartDrawer and turned into a PNG with html-to-image
// (the same approach as the invoice "Save as photo"). Numbers only - no customer details.
export default function TelegramPhotoCard({ innerRef, cart, total, currency, shopName }) {
  return (
    <div
      ref={innerRef}
      style={{
        width: 360,
        boxSizing: "border-box",
        padding: 20,
        background: "#FFFFFF",
        color: "#0E1512",
        fontFamily: "Sora, system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BrandBadge size={32} />
        <div style={{ fontWeight: 700, fontSize: 15 }}>{shopName || "Oracle Vault"}</div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, margin: "16px 0 8px" }}>I want to buy this</div>
      {cart.map((tk) => (
        <div
          key={tk.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 0",
            borderBottom: "1px solid #E7EBE9",
          }}
        >
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, letterSpacing: "0.04em" }}>
            {tk.number}
          </span>
          <span style={{ fontSize: 14, color: "#5A6560" }}>
            {currency}
            {Number(tk.price || 0).toLocaleString()}
          </span>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16, marginTop: 12 }}>
        <span>Total</span>
        <span style={{ fontFamily: "'Space Mono', monospace" }}>
          {currency}
          {total.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
