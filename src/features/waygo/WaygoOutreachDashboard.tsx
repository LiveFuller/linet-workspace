import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, Calendar, Send, Sparkles, ArrowRight, Filter } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { outreachTemplate, statusBadge } from "./waygoHelpers";
import { useToast } from "@/components/Toaster";

type Tab = "all" | "prospect" | "contacted" | "meeting" | "loi" | "installed" | "live" | "churned";

export default function WaygoOutreachDashboard() {
  const { snapshot, repo, persona, refresh } = useApp();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [kind, setKind] = useState<"first" | "followup" | "meeting">("first");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [followUp, setFollowUp] = useState("");

  if (!snapshot || !persona) return <div className="page">Načítám…</div>;
  const hotels = snapshot.waygoHotels ?? [];
  const outreach = snapshot.waygoOutreach ?? [];

  const filtered = useMemo(() => {
    let list = hotels;
    if (tab !== "all") list = list.filter((h) => h.status === tab);
    return list.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [hotels, tab]);

  const selHotel = selected ? hotels.find((h) => h.id === selected) ?? null : null;

  const applyTemplate = () => {
    if (!selHotel) return;
    const t = outreachTemplate(kind, selHotel.name, selHotel.contactName);
    setSubject(t.subject);
    setBody(t.body);
  };

  const saveOutreach = async () => {
    if (!selHotel || !subject.trim() || !body.trim()) { toast("Předmět + text povinné"); return; }
    const res = await repo!.createWaygoOutreach({ hotelId: selHotel.id, kind: kind === "first" ? "email" : kind === "followup" ? "follow_up" : "note", subject: subject.trim(), body: body.trim(), nextFollowUpAt: followUp || null }, persona.id);
    if (res.ok) {
      toast("Outreach uložen");
      if (kind === "first") await repo!.updateWaygoHotel(selHotel.id, { status: "contacted" }, persona.id);
      if (kind === "meeting") await repo!.updateWaygoHotel(selHotel.id, { status: "meeting" }, persona.id);
      setSubject(""); setBody(""); setFollowUp("");
      refresh();
    }
  };

  const pipeline = [
    { id: "prospect" as Tab, label: "Prospekt", count: hotels.filter((h) => h.status === "prospect").length },
    { id: "contacted" as Tab, label: "Kontaktován", count: hotels.filter((h) => h.status === "contacted").length },
    { id: "meeting" as Tab, label: "Schůzka", count: hotels.filter((h) => h.status === "meeting").length },
    { id: "loi" as Tab, label: "LOI", count: hotels.filter((h) => h.status === "loi").length },
    { id: "installed" as Tab, label: "Instalován", count: hotels.filter((h) => h.status === "installed").length },
    { id: "live" as Tab, label: "Live", count: hotels.filter((h) => h.status === "live").length },
  ];

  return (
    <div className="page">
      <div className="row-between wrap" style={{ gap: 12, marginBottom: 10 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}><Send size={20} /> Outreach <span className="count-chip">{hotels.length}</span></h1>
          <p className="small muted" style={{ marginTop: 4 }}>AI drafts → personalizace → 15-min schůzka → QR instalace. Pipeline klikem, ne tabulkou.</p>
        </div>
        <Link to="/waygo/hotels" className="btn btn-secondary">Přidat prospect</Link>
      </div>

      <div className="card" style={{ padding: 10, marginBottom: 12, overflowX: "auto" }}>
        <div className="row" style={{ gap: 6, minWidth: 640 }}>
          <button onClick={() => setTab("all")} className={`btn btn-sm ${tab === "all" ? "btn-primary" : "btn-ghost"}`}><Filter size={14} /> Vše ({hotels.length})</button>
          {pipeline.map((p) => (
            <button key={p.id} onClick={() => setTab(p.id)} className={`btn btn-sm ${tab === p.id ? "btn-primary" : "btn-ghost"}`} style={{ whiteSpace: "nowrap" }}>
              {p.label} <span className="count-chip" style={{ marginLeft: 6, background: tab === p.id ? "rgba(255,255,255,0.22)" : "var(--canvas-subtle)" }}>{p.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 12, alignItems: "start" }}>
        {/* List */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="row-between" style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <strong style={{ fontSize: 13 }}>Pipeline · {tab === "all" ? "vše" : tab} ({filtered.length})</strong>
            <span className="xsmall muted">{outreach.length} outreach záznamů celkem</span>
          </div>
          <div style={{ maxHeight: "72vh", overflowY: "auto" }}>
            {filtered.map((h) => {
              const badge = statusBadge(h.status);
              const hist = outreach.filter((o) => o.hotelId === h.id);
              const last = hist[0];
              const isSel = selected === h.id;
              return (
                <button
                  key={h.id}
                  onClick={() => setSelected(h.id)}
                  className="row-between"
                  style={{
                    width: "100%", textAlign: "left", padding: "12px 14px", border: "none", borderBottom: "1px solid var(--border-ghost)",
                    background: isSel ? "var(--brand-ghost)" : "var(--surface)", cursor: "pointer", gap: 10,
                    borderLeft: isSel ? "3px solid var(--brand)" : "3px solid transparent",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{h.name}</span>
                      <span className="xsmall" style={{ background: badge.bg, color: badge.fg, padding: "2px 7px", borderRadius: 999, fontWeight: 700 }}>{badge.label}</span>
                    </div>
                    <div className="xsmall muted" style={{ marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={12} /> {h.area}</span>
                      {h.contactEmail && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Mail size={12} /> {h.contactEmail}</span>}
                      {h.contactPhone && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Phone size={12} /> {h.contactPhone}</span>}
                    </div>
                    {last && <div className="xsmall" style={{ marginTop: 6, background: "var(--canvas-subtle)", padding: "4px 8px", borderRadius: 6, color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{last.kind}: {last.subject}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <span className="xsmall muted">{h.scansTotal} scanů</span>
                    <ArrowRight size={14} style={{ color: isSel ? "var(--brand)" : "var(--text-tertiary)" }} />
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <div className="small muted" style={{ padding: 24, textAlign: "center" }}>Žádné hotely v tomto stavu.</div>}
          </div>
        </div>

        {/* Detail / AI draft */}
        <div className="card" style={{ padding: 14, position: "sticky", top: 12 }}>
          {!selHotel ? (
            <div className="empty-state" style={{ padding: "32px 16px", textAlign: "center" }}>
              <div className="xsmall muted">Vyberte hotel vlevo pro AI návrh zprávy a follow-up.</div>
            </div>
          ) : (
            <>
              <div className="row-between" style={{ gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{selHotel.name}</div>
                  <div className="xsmall muted">{selHotel.address} · {selHotel.area}</div>
                </div>
                <Link to={`/waygo/hotels/${selHotel.id}`} className="btn btn-ghost btn-sm">Detail →</Link>
              </div>

              <div className="row" style={{ marginTop: 12, gap: 6 }}>
                {(["first", "followup", "meeting"] as const).map((k) => (
                  <button key={k} onClick={() => setKind(k)} className={`btn btn-sm ${kind === k ? "btn-primary" : "btn-secondary"}`} style={{ flex: 1, fontSize: 12 }}>
                    {k === "first" ? "První kontakt" : k === "followup" ? "Follow-up" : "Schůzka"}
                  </button>
                ))}
              </div>

              <button onClick={applyTemplate} className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 8, border: "1px dashed var(--border)", gap: 6 }}>
                <Sparkles size={14} /> Vygenerovat AI návrh {kind === "first" ? "prvního e-mailu" : kind === "followup" ? "follow-upu" : "potvrzení schůzky"}
              </button>

              <label className="stack" style={{ marginTop: 12, gap: 4 }}>
                <span className="xsmall muted" style={{ fontWeight: 600 }}>Předmět</span>
                <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Waygo pro Hotel …" />
              </label>
              <label className="stack" style={{ marginTop: 10, gap: 4 }}>
                <span className="xsmall muted" style={{ fontWeight: 600 }}>Text</span>
                <textarea className="input" rows={9} value={body} onChange={(e) => setBody(e.target.value)} placeholder="AI návrh — upravte před odesláním" style={{ resize: "vertical", lineHeight: 1.5 }} />
              </label>
              <label className="stack" style={{ marginTop: 10, gap: 4 }}>
                <span className="xsmall muted" style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><Calendar size={12} /> Next follow-up</span>
                <input className="input" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
              </label>

              <button className="btn btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={saveOutreach}><Send size={16} /> Uložit outreach + posunout pipeline</button>
              <p className="xsmall muted" style={{ marginTop: 8, lineHeight: 1.5 }}>Uloží se do IndexedDB (local) / Supabase (live). Reálné odeslání e-mailu řeší vaše schránka — zde máte 1-klik kopii.</p>

              <div style={{ marginTop: 14, borderTop: "1px solid var(--border-ghost)", paddingTop: 12 }}>
                <div className="xsmall" style={{ fontWeight: 700, marginBottom: 6 }}>Historie pro tento hotel</div>
                <div className="stack" style={{ gap: 6 }}>
                  {outreach.filter((o) => o.hotelId === selHotel.id).map((o) => (
                    <div key={o.id} className="card" style={{ padding: 8, background: "var(--canvas-subtle)" }}>
                      <div className="xsmall" style={{ fontWeight: 600 }}>{o.kind} · {o.subject}</div>
                      <div className="xsmall muted" style={{ marginTop: 2, whiteSpace: "pre-wrap" }}>{o.body.slice(0, 180)}</div>
                    </div>
                  ))}
                  {outreach.filter((o) => o.hotelId === selHotel.id).length === 0 && <div className="xsmall muted">Zatím prázdné.</div>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
