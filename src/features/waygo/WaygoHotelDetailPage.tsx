import { useParams, Link } from "react-router-dom";
import { useApp } from "@/app/AppProvider";
import { useState } from "react";
import { QrCode, ArrowLeft, Banknote, Eye, ShoppingBag, Trash2, Plus, ExternalLink, Mail } from "lucide-react";
import { buildQrUrl } from "@/lib/waygoSlug";
import { QrPreview } from "./components/QrPreview";
import { statusBadge, statsForHotel } from "./waygoHelpers";
import { useToast } from "@/components/Toaster";

export default function WaygoHotelDetailPage() {
  const { hotelId = "" } = useParams();
  const { snapshot, repo, persona, refresh } = useApp();
  const { toast } = useToast();
  const [status, setStatus] = useState<string>("");
  const [codeName, setCodeName] = useState("");

  if (!snapshot || !persona) return <div className="page">Načítám…</div>;
  const hotel = snapshot.waygoHotels.find((h) => h.id === hotelId);
  if (!hotel) return <div className="page page-narrow"><div className="card" style={{ padding: 24 }}>Hotel nenalezen. <Link to="/waygo/hotels">Zpět</Link></div></div>;

  const codes = (snapshot.waygoCodes ?? []).filter((c) => c.hotelId === hotel.id);
  const scans = (snapshot.waygoScans ?? []).filter((s) => s.hotelId === hotel.id);
  const bookings = (snapshot.waygoBookings ?? []).filter((b) => b.hotelId === hotel.id);
  const outreach = (snapshot.waygoOutreach ?? []).filter((o) => o.hotelId === hotel.id);
  const s7 = statsForHotel(hotel, scans, bookings, 7);
  const s30 = statsForHotel(hotel, scans, bookings, 30);
  const badge = statusBadge(hotel.status);
  const qrUrl = buildQrUrl(window.location.origin, hotel.slugQr);
  const discoverUrl = `https://waygo.cz/discover?src=${hotel.slug}`;

  const updateStatus = async () => {
    if (!status) return;
    const res = await repo!.updateWaygoHotel(hotel.id, { status: status as never }, persona.id);
    if (res.ok) { toast(`Stav změněn na ${status}`); refresh(); setStatus(""); }
  };

  const addCode = async () => {
    if (!codeName.trim()) return;
    const res = await repo!.createWaygoCode({ hotelId: hotel.id, displayName: codeName.trim(), type: "personal", personName: codeName.trim() }, persona.id);
    if (res.ok) { toast(`Personal kód ${res.data.code} vytvořen`); setCodeName(""); refresh(); }
    else toast("Chyba");
  };

  const delCode = async (id: string) => {
    if (!confirm("Smazat kód?")) return;
    await repo!.deleteWaygoCode(id, persona.id);
    refresh();
  };

  const simulateScan = async (slug: string) => {
    await repo!.recordWaygoScan(slug, { userAgent: navigator.userAgent, referrer: window.location.href });
    toast("Scan zaznamenán");
    refresh();
  };
  const simulateBooking = async (codeId: string | null, slug: string) => {
    await repo!.createWaygoBooking({ hotelId: hotel.id, codeId, slug, experienceTitle: "Prague Essentials: Castle, Bridge & Old Town", amountCzk: 7031 }, persona.id);
    toast("Booking simulován (+843 Kč provize)");
    refresh();
  };

  return (
    <div className="page">
      <Link to="/waygo" className="xsmall muted" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 10, textDecoration: "none" }}><ArrowLeft size={14} /> Zpět na Owner dashboard</Link>

      <div className="card" style={{ padding: 18, marginBottom: 12 }}>
        <div className="row-between wrap" style={{ gap: 14, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 className="page-title" style={{ margin: 0 }}>{hotel.name}</h1>
              <span className="xsmall" style={{ background: badge.bg, color: badge.fg, padding: "4px 10px", borderRadius: 999, fontWeight: 800 }}>{badge.label}</span>
            </div>
            <div className="small muted" style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span>{hotel.area} · {hotel.address}</span>
              {hotel.stars && <span>{hotel.stars}* · {hotel.rooms ?? "—"} pokojů</span>}
              <span>{hotel.contactName ?? "—"} {hotel.contactEmail ? `· ${hotel.contactEmail}` : ""}</span>
            </div>
            <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <span className="xsmall" style={{ background: "var(--canvas-subtle)", padding: "4px 8px", borderRadius: 6 }}>slug: <strong>{hotel.slug}</strong></span>
              <span className="xsmall" style={{ background: "var(--brand-ghost)", border: "1px solid var(--brand-soft-strong)", padding: "4px 8px", borderRadius: 6, fontFamily: "monospace" }}>{hotel.slugQr}</span>
              <a href={qrUrl} target="_blank" rel="noreferrer" className="xsmall" style={{ color: "var(--brand)", display: "inline-flex", alignItems: "center", gap: 4 }}><ExternalLink size={12} /> {qrUrl.replace(/^https?:\/\//, "")}</a>
            </div>
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <select className="input" style={{ maxWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Změnit stav…</option>
                <option value="prospect">Prospekt</option><option value="contacted">Kontaktován</option><option value="meeting">Schůzka</option><option value="loi">LOI</option><option value="installed">Instalován</option><option value="live">Live</option><option value="churned">Churn</option>
              </select>
              <button className="btn btn-secondary btn-sm" disabled={!status} onClick={updateStatus}>Uložit</button>
              <Link to={`/waygo/hotels/${hotel.id}/qr`} className="btn btn-primary btn-sm"><QrCode size={14} /> Tisk A6</Link>
              <a href={discoverUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={14} /> Preview host</a>
            </div>
          </div>

          <div style={{ flex: "0 0 220px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <QrPreview value={qrUrl} size={180} />
            <div className="xsmall muted" style={{ textAlign: "center", lineHeight: 1.4 }}>
              Scan → <Link to={`/r/${hotel.slugQr}`} style={{ color: "var(--brand)" }}>/r/{hotel.slugQr}</Link><br />
              {hotel.scansTotal} scanů · {hotel.bookingsTotal} bookings
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => simulateScan(hotel.slugQr)}><Eye size={12} /> Test scan</button>
              <button className="btn btn-ghost btn-sm" onClick={() => simulateBooking(codes[0]?.id ?? null, hotel.slugQr)}><ShoppingBag size={12} /> Test booking</button>
            </div>
          </div>
        </div>
      </div>

      <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 12 }}>
        <div className="card" style={{ padding: 14 }}><div className="xsmall muted">7d scany</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{s7.scans}</div><div className="xsmall muted">{scans.length} celkem</div></div>
        <div className="card" style={{ padding: 14 }}><div className="xsmall muted">7d bookings</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{s7.bookings}</div><div className="xsmall" style={{ color: s7.conv >= 8 ? "var(--success)" : "var(--text-tertiary)" }}>{s7.conv}% conv</div></div>
        <div className="card" style={{ padding: 14 }}><div className="xsmall muted">30d provize</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{s30.revenue.toLocaleString("cs-CZ")} Kč</div><div className="xsmall muted">{hotel.commissionHotelPct}% hotel · {hotel.commissionReceptionPct}% recepce</div></div>
        <div className="card" style={{ padding: 14 }}><div className="xsmall muted">Celkem provize</div><div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{hotel.revenueCzkTotal.toLocaleString("cs-CZ")} Kč</div><div className="xsmall muted">{bookings.length} bookings all-time</div></div>
      </div>

      <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }}>
        <div className="card" style={{ padding: 14 }}>
          <div className="row-between" style={{ marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><QrCode size={16} /> QR kódy · hotel + personal</h3>
            <span className="count-chip">{codes.length}</span>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {codes.map((c) => {
              const url = buildQrUrl(window.location.origin, c.slug);
              return (
                <div key={c.id} className="card" style={{ padding: 10, display: "flex", gap: 12, alignItems: "center" }}>
                  <QrPreview value={url} size={64} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small" style={{ fontWeight: 700 }}>{c.displayName} <span className="xsmall muted">· {c.code}</span> {c.type === "personal" && <span className="xsmall" style={{ background: "#ede9fe", color: "#6d28d9", padding: "1px 6px", borderRadius: 999 }}>personal</span>}</div>
                    <div className="xsmall" style={{ fontFamily: "monospace", color: "var(--brand)" }}>{c.slug}</div>
                    <div className="xsmall muted" style={{ marginTop: 2 }}>{c.scansTotal} scanů · {c.bookingsTotal} bookings · {c.revenueCzkTotal.toLocaleString("cs-CZ")} Kč</div>
                  </div>
                  <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                    <Link to={`/r/${c.slug}`} className="btn btn-ghost btn-sm">Otevřít</Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => delCode(c.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <input className="input" placeholder="Jméno recepční (Petra)" style={{ flex: 1 }} value={codeName} onChange={(e) => setCodeName(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={addCode}><Plus size={14} /> Personal kód</button>
          </div>
          <p className="xsmall muted" style={{ marginTop: 8, lineHeight: 1.5 }}>Personal kód = odměna jde konkrétní recepční. Sdílený kód = hotel. Oba QR lze tisknout na tent card (malý štítek s iniciálou).</p>
        </div>

        <div className="stack" style={{ gap: 12 }}>
          <div className="card" style={{ padding: 14 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Mail size={16} /> Outreach / follow-ups</h3>
            <div className="stack" style={{ marginTop: 10, gap: 8 }}>
              {outreach.length === 0 && <div className="small muted">Žádné záznamy. <Link to="/waygo/outreach">Vytvořit v Outreach</Link></div>}
              {outreach.map((o) => (
                <div key={o.id} className="card" style={{ padding: 10, background: "var(--canvas-subtle)", borderColor: "var(--border-ghost)" }}>
                  <div className="xsmall" style={{ fontWeight: 700 }}>{o.kind} · {o.subject}</div>
                  <div className="xsmall muted" style={{ marginTop: 4, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{o.body.slice(0, 220)}{o.body.length > 220 ? "…" : ""}</div>
                  {o.nextFollowUpAt && <div className="xsmall" style={{ marginTop: 6, color: "var(--warning)" }}>Follow-up: {o.nextFollowUpAt}</div>}
                </div>
              ))}
            </div>
            <Link to="/waygo/outreach" className="btn btn-ghost btn-sm" style={{ marginTop: 10, width: "100%" }}>Otevřít outreach dashboard</Link>
          </div>

          <div className="card" style={{ padding: 14 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Banknote size={16} /> Poslední bookings</h3>
            <div className="stack" style={{ marginTop: 10, gap: 8 }}>
              {bookings.slice(0, 5).map((b) => (
                <div key={b.id} className="row-between card" style={{ padding: 10 }}>
                  <div>
                    <div className="small" style={{ fontWeight: 600 }}>{b.experienceTitle}</div>
                    <div className="xsmall muted">{b.slug} · {new Date(b.bookedAt).toLocaleDateString("cs-CZ")} · {b.guestCountry ?? "—"}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="small" style={{ fontWeight: 700 }}>{b.amountCzk.toLocaleString("cs-CZ")} Kč</div>
                    <div className="xsmall" style={{ color: "var(--success)" }}>+{b.commissionCzk} Kč</div>
                  </div>
                </div>
              ))}
              {bookings.length === 0 && <div className="small muted">Zatím žádné bookings — test booking výše nebo reálný scan.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
