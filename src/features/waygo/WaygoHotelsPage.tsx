import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, QrCode, Trash2, Building2 } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { statusBadge } from "./waygoHelpers";
import { useToast } from "@/components/Toaster";

export default function WaygoHotelsPage() {
  const { snapshot, repo, persona, refresh } = useApp();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", address: "", area: "Praha 1" as const, contactName: "", contactEmail: "", stars: "" });

  if (!snapshot || !persona) return <div className="page">Načítám…</div>;
  const hotels = snapshot.waygoHotels ?? [];
  const projectId = snapshot.projects[0]?.id ?? "";

  const filtered = hotels.filter((h) => {
    if (!q) return true;
    const qq = q.toLowerCase();
    return h.name.toLowerCase().includes(qq) || h.slug.toLowerCase().includes(qq) || h.area.toLowerCase().includes(qq);
  });

  const create = async () => {
    if (!draft.name.trim()) { toast("Název hotelu je povinný"); return; }
    const res = await repo!.createWaygoHotel({
      projectId,
      name: draft.name.trim(),
      address: draft.address.trim(),
      area: draft.area,
      contactName: draft.contactName.trim() || null,
      contactEmail: draft.contactEmail.trim() || null,
      stars: draft.stars ? Number(draft.stars) : null,
      status: "prospect",
    }, persona.id);
    if (res.ok) {
      toast("Hotel přidán — QR vygenerován");
      setDraft({ name: "", address: "", area: "Praha 1", contactName: "", contactEmail: "", stars: "" });
      setFormOpen(false);
      refresh();
    } else {
      toast(res.error.code === "validation" ? res.error.issues.map((i) => i.message).join(", ") : (res.error as { message?: string }).message ?? "Chyba");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Smazat hotel včetně QR a scanů?")) return;
    const res = await repo!.deleteWaygoHotel(id, persona.id);
    if (res.ok) { toast("Smazáno"); refresh(); }
  };

  return (
    <div className="page page-narrow">
      <div className="row-between wrap" style={{ gap: 12, marginBottom: 14 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}><Building2 size={22} /> Hotely <span className="count-chip">{hotels.length}</span></h1>
          <p className="small muted" style={{ marginTop: 4 }}>Každý hotel = 1 QR slug (<code className="xsmall">/r/:slug</code>) + sdílený + personal kódy pro recepci.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setFormOpen((v) => !v)}><Plus size={16} /> {formOpen ? "Zavřít" : "Přidat hotel"}</button>
      </div>

      {formOpen && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>Nový hotel</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="stack" style={{ gap: 4 }}><span className="xsmall muted">Název *</span><input className="input" placeholder="Hotel Mirage Praha" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <label className="stack" style={{ gap: 4 }}><span className="xsmall muted">Oblast</span><select className="input" value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value as never })}><option>Praha 1</option><option>Praha 2</option><option>Praha 3</option><option>Praha 4</option><option>Praha 5</option><option>Praha 6</option><option>Praha 7</option><option>Praha 8</option><option>Celá Praha</option></select></label>
            <label className="stack" style={{ gap: 4 }}><span className="xsmall muted">Adresa</span><input className="input" placeholder="Václavské náměstí 17, Praha 1" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></label>
            <label className="stack" style={{ gap: 4 }}><span className="xsmall muted">Hvězdy</span><select className="input" value={draft.stars} onChange={(e) => setDraft({ ...draft, stars: e.target.value })}><option value="">—</option><option value="3">3*</option><option value="4">4*</option><option value="5">5*</option></select></label>
            <label className="stack" style={{ gap: 4 }}><span className="xsmall muted">Kontakt jméno</span><input className="input" placeholder="Jan Novák" value={draft.contactName} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} /></label>
            <label className="stack" style={{ gap: 4 }}><span className="xsmall muted">E-mail</span><input className="input" placeholder="gm@hotel.cz" value={draft.contactEmail} onChange={(e) => setDraft({ ...draft, contactEmail: e.target.value })} /></label>
          </div>
          <div className="row" style={{ marginTop: 12, gap: 8 }}>
            <button className="btn btn-primary" onClick={create}>Vytvořit + generovat QR</button>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>Zrušit</button>
            <span className="xsmall muted" style={{ marginLeft: "auto" }}>Slug se vygeneruje automaticky, QR je hned dostupné na <code>/r/:slug</code></span>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 10, marginBottom: 12 }}>
        <label className="row" style={{ gap: 8, flex: 1 }}>
          <Search size={16} className="muted" />
          <input className="input" style={{ border: "none", boxShadow: "none", padding: 0, flex: 1 }} placeholder="Hledat hotel, slug, oblast…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        {filtered.map((h) => {
          const badge = statusBadge(h.status);
          return (
            <div key={h.id} className="card row-between" style={{ padding: 14, gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Link to={`/waygo/hotels/${h.id}`} style={{ fontWeight: 700, color: "var(--ink)", textDecoration: "none" }}>{h.name}</Link>
                <div className="xsmall muted" style={{ marginTop: 2 }}>{h.area} · {h.address || "—"} {h.stars ? `· ${h.stars}*` : ""} {h.rooms ? `· ${h.rooms} pokojů` : ""}</div>
                <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                  <span className="xsmall" style={{ background: badge.bg, color: badge.fg, padding: "2px 8px", borderRadius: 999, fontWeight: 700 }}>{badge.label}</span>
                  <Link to={`/r/${h.slugQr}`} className="xsmall" style={{ fontFamily: "monospace", background: "var(--canvas-subtle)", padding: "2px 6px", borderRadius: 6, color: "var(--brand)" }}>{h.slugQr}</Link>
                  <span className="xsmall muted">{h.scansTotal} scanů · {h.bookingsTotal} bookings · {h.revenueCzkTotal.toLocaleString("cs-CZ")} Kč</span>
                </div>
              </div>
              <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                <Link to={`/waygo/hotels/${h.id}/qr`} className="btn btn-secondary btn-sm"><QrCode size={14} /> QR</Link>
                <Link to={`/waygo/hotels/${h.id}`} className="btn btn-ghost btn-sm">Detail</Link>
                <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={() => remove(h.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="card" style={{ padding: 24, textAlign: "center" }}><div className="small muted">Žádné hotely pro filtr „{q}“. Přidejte první hotel.</div></div>}
      </div>
    </div>
  );
}
