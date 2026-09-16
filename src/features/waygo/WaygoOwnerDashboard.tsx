import { Link } from "react-router-dom";
import { QrCode, TrendingUp, Eye, ShoppingBag, Banknote, MapPin, ExternalLink, Plus, Filter } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { useMemo, useState } from "react";
import { statsForHotel, statusBadge } from "./waygoHelpers";
import { buildQrUrl } from "@/lib/waygoSlug";

export default function WaygoOwnerDashboard() {
  const { snapshot, persona } = useApp();
  const [filter, setFilter] = useState<string>("all");
  if (!snapshot || !persona) return <div className="page">Načítám…</div>;
  const { waygoHotels: hotels = [], waygoScans: scans = [], waygoBookings: bookings = [], waygoCodes: codes = [] } = snapshot;

  const filtered = useMemo(() => {
    if (filter === "all") return hotels;
    return hotels.filter((h) => h.status === filter);
  }, [hotels, filter]);

  const totals = useMemo(() => {
    const live = hotels.filter((h) => h.status === "live");
    const scans7 = scans.filter((s) => new Date(s.scannedAt).getTime() > Date.now() - 7 * 86400000).length;
    const bookings7 = bookings.filter((b) => new Date(b.bookedAt).getTime() > Date.now() - 7 * 86400000).length;
    const rev30 = bookings.filter((b) => new Date(b.bookedAt).getTime() > Date.now() - 30 * 86400000).reduce((a, b) => a + b.commissionCzk, 0);
    const revAll = bookings.reduce((a, b) => a + b.commissionCzk, 0);
    return { liveCount: live.length, scans7, bookings7, rev30, revAll, hotelCount: hotels.length };
  }, [hotels, scans, bookings]);

  const topHotels = [...hotels].sort((a, b) => (b.scansTotal ?? 0) - (a.scansTotal ?? 0)).slice(0, 3);

  return (
    <div className="page">
      <div className="row-between wrap" style={{ gap: 12, marginBottom: 12 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>W</span>
            WAYGO <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>Owner</span>
          </h1>
          <p className="small muted" style={{ marginTop: 4 }}>Hand-picked Prague · QR distribuce · Owner + German giant backing</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link to="/waygo/hotels" className="btn btn-secondary"><Plus size={16} /> Přidat hotel</Link>
          <Link to="/waygo/outreach" className="btn btn-primary"><TrendingUp size={16} /> Outreach</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="xsmall muted" style={{ display: "flex", alignItems: "center", gap: 6 }}><MapPin size={14} /> Hotely live</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{totals.liveCount} <span className="small muted" style={{ fontWeight: 400 }}>/ {totals.hotelCount}</span></div>
          <div className="xsmall muted" style={{ marginTop: 4 }}>{totals.hotelCount - totals.liveCount} v pipeline</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="xsmall muted" style={{ display: "flex", alignItems: "center", gap: 6 }}><Eye size={14} /> Scany 7d</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{totals.scans7}</div>
          <div className="xsmall muted" style={{ marginTop: 4 }}>{scans.length} celkem</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="xsmall muted" style={{ display: "flex", alignItems: "center", gap: 6 }}><ShoppingBag size={14} /> Bookings 7d</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{totals.bookings7}</div>
          <div className="xsmall" style={{ marginTop: 4, color: totals.bookings7 ? "var(--success)" : "var(--text-tertiary)" }}>{totals.bookings7 && totals.scans7 ? `${((totals.bookings7 / totals.scans7) * 100).toFixed(1)}% conv` : "—"}</div>
        </div>
        <div className="card" style={{ padding: 16, borderColor: "var(--brand-soft-strong)", background: "var(--brand-ghost)" }}>
          <div className="xsmall muted" style={{ display: "flex", alignItems: "center", gap: 6 }}><Banknote size={14} /> Provize 30d</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{totals.rev30.toLocaleString("cs-CZ")} <span style={{ fontSize: 14, fontWeight: 600 }}>Kč</span></div>
          <div className="xsmall muted" style={{ marginTop: 4 }}>{totals.revAll.toLocaleString("cs-CZ")} Kč all-time</div>
        </div>
      </div>

      {/* Top performers + funnel */}
      <div className="detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Top hotely podle scanů</h3>
            <Link to="/waygo/hotels" className="xsmall" style={{ color: "var(--brand)" }}>Všechny →</Link>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {topHotels.map((h) => {
              const s = statsForHotel(h, scans, bookings, 7);
              const badge = statusBadge(h.status);
              const qrUrl = buildQrUrl(window.location.origin, h.slugQr);
              return (
                <Link key={h.id} to={`/waygo/hotels/${h.id}`} className="card card-interactive row-between" style={{ padding: 12, textDecoration: "none", color: "inherit", gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong className="small" style={{ fontWeight: 700 }}>{h.name}</strong>
                      <span className="xsmall" style={{ background: badge.bg, color: badge.fg, padding: "2px 8px", borderRadius: 999, fontWeight: 600 }}>{badge.label}</span>
                    </div>
                    <div className="xsmall muted" style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}><QrCode size={12} /> {h.slugQr} · {qrUrl.replace(/^https?:\/\//, "")}</div>
                    <div className="xsmall muted" style={{ marginTop: 6, display: "flex", gap: 10 }}><span>{h.scansTotal} scanů</span><span>{h.bookingsTotal} bookings</span><span>{s.conv}% conv 7d</span></div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{h.revenueCzkTotal.toLocaleString("cs-CZ")} Kč</div>
                    <div className="xsmall muted">{h.commissionHotelPct}% hotel · {h.commissionReceptionPct}% recepce</div>
                  </div>
                </Link>
              );
            })}
            {topHotels.length === 0 && <div className="small muted">Zatím žádná data — přidejte první hotel.</div>}
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Trychtýř pipeline</h3>
          <p className="xsmall muted" style={{ marginTop: 4 }}>Kde padají hotely? Klik pro filtr.</p>
          <div className="stack" style={{ marginTop: 12, gap: 6 }}>
            {[
              { k: "prospect", label: "Prospekt" },
              { k: "contacted", label: "Kontaktován" },
              { k: "meeting", label: "Schůzka" },
              { k: "loi", label: "LOI" },
              { k: "installed", label: "Instalován" },
              { k: "live", label: "Live" },
            ].map((f) => {
              const cnt = hotels.filter((h) => h.status === f.k).length;
              const pct = hotels.length ? Math.round((cnt / hotels.length) * 100) : 0;
              return (
                <button key={f.k} onClick={() => setFilter(f.k)} className="row-between" style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 10, border: filter === f.k ? "1.5px solid var(--brand)" : "1px solid var(--border}", background: filter === f.k ? "var(--brand-ghost)" : "var(--surface)", cursor: "pointer" }}>
                  <span className="small" style={{ fontWeight: 600 }}>{f.label}</span>
                  <span className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ width: 36, height: 6, borderRadius: 999, background: "var(--canvas-subtle)", overflow: "hidden", display: "inline-block" }}><span style={{ display: "block", height: "100%", width: `${pct}%`, background: "var(--brand)" }} /></span> {cnt}</span>
                </button>
              );
            })}
            <button onClick={() => setFilter("all")} className="xsmall" style={{ marginTop: 6, color: "var(--brand)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Zobrazit všechny ({hotels.length})</button>
          </div>
        </div>
      </div>

      {/* Hotel table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row-between" style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}><Filter size={16} /> Hotely · {filter === "all" ? "všechny" : filter} ({filtered.length})</h3>
          <span className="xsmall muted">{codes.length} QR kódů celkem (hotel + recepce personal)</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr className="xsmall muted" style={{ textAlign: "left", borderBottom: "1px solid var(--border-ghost)" }}>
                <th style={{ padding: "10px 14px", fontWeight: 600 }}>Hotel</th>
                <th style={{ padding: "10px 14px", fontWeight: 600 }}>Stav</th>
                <th style={{ padding: "10px 14px", fontWeight: 600 }}>QR slug</th>
                <th style={{ padding: "10px 14px", fontWeight: 600, textAlign: "right" }}>7d scany</th>
                <th style={{ padding: "10px 14px", fontWeight: 600, textAlign: "right" }}>7d book</th>
                <th style={{ padding: "10px 14px", fontWeight: 600, textAlign: "right" }}>Conv</th>
                <th style={{ padding: "10px 14px", fontWeight: 600, textAlign: "right" }}>30d Kč</th>
                <th style={{ padding: "10px 14px" }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                const s7 = statsForHotel(h, scans, bookings, 7);
                const s30 = statsForHotel(h, scans, bookings, 30);
                const badge = statusBadge(h.status);
                return (
                  <tr key={h.id} style={{ borderBottom: "1px solid var(--border-ghost)" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <Link to={`/waygo/hotels/${h.id}`} style={{ fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>{h.name}</Link>
                      <div className="xsmall muted">{h.area} · {h.address.slice(0, 28)}</div>
                    </td>
                    <td style={{ padding: "10px 14px" }}><span className="xsmall" style={{ background: badge.bg, color: badge.fg, padding: "3px 8px", borderRadius: 999, fontWeight: 700, whiteSpace: "nowrap" }}>{badge.label}</span></td>
                    <td style={{ padding: "10px 14px" }}><Link to={`/r/${h.slugQr}`} className="xsmall" style={{ fontFamily: "monospace", color: "var(--brand)" }}>{h.slugQr}</Link></td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600 }}>{s7.scans}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{s7.bookings}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: s7.conv >= 8 ? "var(--success)" : "var(--text-tertiary)" }}>{s7.conv}%</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>{s30.revenue.toLocaleString("cs-CZ")} Kč</td>
                    <td style={{ padding: "10px 14px" }}><Link to={`/waygo/hotels/${h.id}/qr`} className="btn btn-ghost btn-sm" style={{ padding: "4px 8px", fontSize: 12 }}><QrCode size={14} /> QR</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="small muted" style={{ padding: 24, textAlign: "center" }}>Žádné hotely v tomto stavu.</div>}
        </div>
      </div>

      <div className="row" style={{ marginTop: 12, gap: 8 }}>
        <a href="https://waygo.cz" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={14} /> waygo.cz live</a>
        <span className="xsmall muted" style={{ marginLeft: "auto" }}>Data: IndexedDB local demo · seed 8 hotelů · scan tracking: /r/:slug</span>
      </div>
    </div>
  );
}
