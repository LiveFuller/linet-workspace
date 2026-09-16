import { useParams, Link } from "react-router-dom";
import { useApp } from "@/app/AppProvider";
import { buildQrUrl } from "@/lib/waygoSlug";
import { QrPreview, useQrDataUrl } from "./components/QrPreview";
import { ArrowLeft, Printer, Download } from "lucide-react";

export default function WaygoQrPrintPage() {
  const { hotelId = "" } = useParams();
  const { snapshot } = useApp();
  if (!snapshot) return <div className="page">Načítám…</div>;
  const hotel = snapshot.waygoHotels.find((h) => h.id === hotelId);
  if (!hotel) return <div className="page page-narrow">Hotel nenalezen</div>;
  const qrUrl = buildQrUrl(window.location.origin, hotel.slugQr);
  return <QrA6 hotelName={hotel.name} hotelQr={hotel.slugQr} qrUrl={qrUrl} address={hotel.address} />;
}

function QrA6({ hotelName, hotelQr, qrUrl, address }: { hotelName: string; hotelQr: string; qrUrl: string; address: string }) {
  const dataUrl = useQrDataUrl(qrUrl, 600);

  const print = () => window.print();
  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `waygo-${hotelQr}-qr.png`;
    a.click();
  };

  return (
    <div className="page" style={{ background: "var(--canvas)", minHeight: "100vh" }}>
      <div className="no-print" style={{ maxWidth: 900, margin: "0 auto" }}>
        <Link to={`/waygo/hotels/${hotelName}`} className="xsmall muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", marginBottom: 10 }}><ArrowLeft size={14} /> Zpět</Link>
        <div className="row-between wrap" style={{ gap: 12, marginBottom: 12 }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Tisk A6 — Hotel edition</h1>
            <p className="small muted" style={{ marginTop: 4 }}>{hotelName} · {hotelQr} · {qrUrl}</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-secondary" onClick={download}><Download size={16} /> Stáhnout PNG</button>
            <button className="btn btn-primary" onClick={print}><Printer size={16} /> Tisk / PDF</button>
          </div>
        </div>
        <p className="xsmall muted" style={{ marginBottom: 12, lineHeight: 1.5 }}>Chrome: Tisk → Uložit jako PDF → okraje Žádné → zaškrtnout Pozadí. Papír A6 (105×148 mm) nebo A4 a rozstříhat. Akryl stojánek 105×148.</p>
      </div>

      {/* Printable A6 */}
      <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 32px" }}>
        <div
          id="waygo-a6"
          style={{
            width: "105mm",
            minHeight: "148mm",
            background: "#FFFBF0",
            border: "1px solid #E8E0C8",
            borderRadius: 10,
            padding: "12mm 10mm 8mm",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            fontFamily: "Inter, Segoe UI, system-ui, sans-serif",
            color: "#1a2a44",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* subtle skyline */}
          <div style={{ width: "100%", marginBottom: 6, opacity: 0.95 }}>
            <svg viewBox="0 0 400 80" width="100%" height="52" aria-hidden style={{ display: "block" }}>
              <path d="M10 60 L30 40 L40 45 L55 22 L65 28 L75 18 L85 32 L110 30 L115 45 L140 35 L155 50 L175 42 L190 55 L210 40 L230 48 L250 32 L270 38 L285 28 L300 35 L320 25 L340 38 L360 42 L390 50 L390 60 Z" fill="none" stroke="#1a2a44" strokeWidth="1.2" />
              <circle cx="74" cy="20" r="2" fill="#1a2a44" />
              <ellipse cx="320" cy="18" rx="14" ry="12" fill="#D99A2B" opacity="0.95" />
            </svg>
          </div>

          <div style={{ fontWeight: 800, letterSpacing: "0.28em", fontSize: 18, color: "#0f1f3a" }}>WAYGO</div>
          <div style={{ fontSize: 7, letterSpacing: "0.22em", color: "#5b6a7a", marginTop: 2, fontWeight: 600 }}>HAND-PICKED PRAGUE EXPERIENCES</div>

          {/* city line art placeholder */}
          <div style={{ width: "100%", height: 1, background: "#E8E0C8", margin: "10px 0 12px" }} />

          <div style={{ fontFamily: "Georgia, serif", fontSize: 26, lineHeight: 1.05, fontWeight: 400, color: "#0f1f3a" }}>
            Your Prague.<br />
            <span style={{ color: "#C78A1A", fontWeight: 700 }}>Starts here.</span>
          </div>
          <div style={{ fontSize: 9, color: "#3a4a5e", marginTop: 6, letterSpacing: "0.04em" }}>Walks · Cruises · Local experiences</div>

          <div style={{ marginTop: 12, fontSize: 9, fontStyle: "italic", color: "#5b6a7a" }}>Scan to explore</div>

          <div style={{ marginTop: 8, background: "#fff", padding: 10, borderRadius: 10, border: "1px solid #E8E0C8", boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
            {dataUrl ? <img src={dataUrl} alt={`QR ${qrUrl}`} width={118} height={118} style={{ display: "block", width: 118, height: 118 }} /> : <div style={{ width: 118, height: 118, background: "#f6f0dd" }} />}
          </div>
          <div className="xsmall muted" style={{ marginTop: 6, fontFamily: "monospace", fontSize: 8, background: "#fff", padding: "2px 6px", borderRadius: 4, border: "1px solid #E8E0C8" }}>{qrUrl.replace(/^https?:\/\//, "")}</div>

          <div style={{ marginTop: 8, fontSize: 7, letterSpacing: "0.18em", color: "#7a8a9a", fontWeight: 600 }}>EN / DE / CS</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#0f1f3a", marginTop: 2 }}>waygo.cz</div>

          <div style={{ position: "absolute", bottom: 8, right: 10, fontSize: 6, color: "#a0a8b5" }}>{hotelName} · {hotelQr} · {address}</div>
        </div>
      </div>

      {/* second: small tent 85x110 */}
      <div style={{ display: "flex", justifyContent: "center", paddingBottom: 40 }} className="no-print">
        <div className="card" style={{ padding: 14, maxWidth: 900, width: "100%" }}>
          <div className="row" style={{ gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ width: 180, background: "#FFFBF0", border: "1px solid #E8E0C8", borderRadius: 10, padding: 10, textAlign: "center" }}>
              <div style={{ fontWeight: 800, letterSpacing: "0.18em", fontSize: 11 }}>WAYGO</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>Your Prague.<br /><span style={{ color: "#C78A1A" }}>Starts here.</span></div>
              <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}><QrPreview value={qrUrl} size={90} /></div>
              <div className="xsmall muted" style={{ marginTop: 4, fontSize: 9 }}>waygo.cz · {hotelQr}</div>
            </div>
            <div style={{ flex: "1 1 260px" }}>
              <div className="small" style={{ fontWeight: 700 }}>Co tisknout?</div>
              <ul className="small muted" style={{ marginTop: 6, lineHeight: 1.6, paddingLeft: 16 }}>
                <li><strong>A6 (105×148 mm)</strong> — hlavní stojan na recepci, akryl. Tento náhled je 1:1.</li>
                <li><strong>Tent malý 85 mm</strong> — na úzký pult vedle zvonku.</li>
                <li>QR je <strong>dynamický</strong> (`/r/{hotelQr}`) — cíl lze změnit bez dotisku.</li>
                <li>Doporučení tisku: 300 dpi, matná křída 300g, bez laminace.</li>
              </ul>
              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <span className="xsmall" style={{ background: "var(--canvas-subtle)", padding: "4px 8px", borderRadius: 6 }}>Papír: 300g křída mat</span>
                <span className="xsmall" style={{ background: "var(--brand-ghost)", border: "1px solid var(--brand-soft-strong)", padding: "4px 8px", borderRadius: 6 }}>Stojánek: akryl A6 T</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`@media print {
        body * { visibility: hidden; }
        #waygo-a6, #waygo-a6 * { visibility: visible; }
        #waygo-a6 { position: fixed; left: 50%; top: 50%; transform: translate(-50%,-50%); box-shadow: none !important; border: 1px solid #ddd !important; }
        .no-print { display: none !important; }
        @page { size: A6 portrait; margin: 0; }
      }`}</style>
    </div>
  );
}
