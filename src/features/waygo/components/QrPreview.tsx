import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrPreview({ value, size = 200, logoUrl }: { value: string; size?: number; logoUrl?: string }) {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: size * 2,
      color: { dark: "#0f1f3a", light: "#ffffff" },
    }).then((u) => { if (alive) setUrl(u); }).catch(() => { if (alive) setUrl(""); });
    return () => { alive = false; };
  }, [value, size]);

  if (!url) return <div style={{ width: size, height: size, background: "var(--canvas-subtle)", borderRadius: 12 }} aria-hidden />;

  return (
    <div style={{ position: "relative", width: size, height: size, background: "#fff", borderRadius: 12, padding: 8, border: "1px solid var(--border)" }}>
      <img src={url} alt={`QR pro ${value}`} width={size - 16} height={size - 16} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
      {logoUrl && (
        <img src={logoUrl} alt="" aria-hidden style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 28, height: 28, borderRadius: 6, background: "#fff", padding: 3, boxShadow: "0 1px 6px rgba(0,0,0,0.18)" }} />
      )}
    </div>
  );
}

export function useQrDataUrl(value: string, size = 400) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(value, { errorCorrectionLevel: "H", margin: 1, width: size, color: { dark: "#0f1f3a", light: "#ffffff" } }).then(setUrl).catch(() => setUrl(""));
  }, [value, size]);
  return url;
}
