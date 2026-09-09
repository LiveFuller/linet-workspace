// SearchPage — /search  (global, permission-aware, diacritic-tolerant)
import { useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, ListChecks, CalendarDays, FolderOpen, GraduationCap, FileText, LifeBuoy, ChevronRight, SearchX, Sparkles } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { EmptyState, SkeletonStack } from "@/components/primitives";
import { normalizeSearch } from "@/domain/selectors";
import { canViewSupportTicket } from "@/domain/permissions";
import { formatDateOnly } from "@/lib/dates";

type Hit = { id: string; title: string; to: string; sub?: string };

const GROUP_ICON: Record<string, React.ReactNode> = {
  tasks: <ListChecks size={14} aria-hidden />,
  meetings: <CalendarDays size={14} aria-hidden />,
  documents: <FolderOpen size={14} aria-hidden />,
  learning: <GraduationCap size={14} aria-hidden />,
  decisions: <FileText size={14} aria-hidden />,
  support: <LifeBuoy size={14} aria-hidden />,
};

export default function SearchPage() {
  const { snapshot, persona, t, prefs } = useApp();
  const [params, setParams] = useSearchParams();
  const qRaw = params.get("q") ?? "";
  const qNorm = normalizeSearch(qRaw);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!snapshot || !persona) return <div className="page"><SkeletonStack count={3} /></div>;

  const groups = useMemo(() => {
    const out: { key: string; label: string; hits: Hit[] }[] = [];
    if (!qNorm) return out;
    const { tasks, meetings, documents, modules, decisions, supportTickets } = snapshot;

    const tasksHits: Hit[] = tasks
      .filter((x) => x.lifecycle === "active")
      .filter((x) => normalizeSearch(x.title).includes(qNorm) || normalizeSearch(x.description).includes(qNorm))
      .slice(0, 20)
      .map((x) => ({ id: x.id, title: x.title, to: `/tasks/${x.id}`, sub: x.description.slice(0, 80) }));

    const meetingsHits: Hit[] = meetings
      .filter((m) => normalizeSearch(m.title).includes(qNorm) || normalizeSearch(m.agenda).includes(qNorm))
      .slice(0, 20)
      .map((m) => ({ id: m.id, title: m.title, to: `/meetings/${m.id}`, sub: formatDateOnly(m.startsAt.slice(0, 10), prefs.locale) }));

    const docsHits: Hit[] = documents
      .filter((d) => normalizeSearch(d.title).includes(qNorm) || normalizeSearch(d.description).includes(qNorm))
      .slice(0, 20)
      .map((d) => ({ id: d.id, title: d.title, to: `/documents`, sub: d.description.slice(0, 80) }));

    const trainingHits: Hit[] = modules
      .filter((m) => {
        const hay = `${m.title} ${m.titleEn} ${m.objective} ${m.objectiveEn}`;
        return normalizeSearch(hay).includes(qNorm);
      })
      .slice(0, 20)
      .map((m) => ({
        id: m.id,
        title: prefs.locale === "cs" ? m.title : m.titleEn,
        to: `/learning/${m.slug}`,
        sub: (prefs.locale === "cs" ? m.objective : m.objectiveEn).slice(0, 80),
      }));

    const decisionsHits: Hit[] = decisions
      .filter((d) => normalizeSearch(d.title).includes(qNorm) || normalizeSearch(d.text).includes(qNorm))
      .slice(0, 20)
      .map((d) => ({ id: d.id, title: d.title, to: `/projects/${snapshot.projects[0]?.id ?? ""}`, sub: d.text.slice(0, 80) }));

    const supportHits: Hit[] = supportTickets
      .filter((tk) => canViewSupportTicket(persona, tk))
      .filter((tk) => normalizeSearch(tk.title).includes(qNorm) || normalizeSearch(tk.description).includes(qNorm))
      .slice(0, 20)
      .map((tk) => ({ id: tk.id, title: tk.title, to: `/support/${tk.id}`, sub: tk.description.slice(0, 80) }));

    if (tasksHits.length) out.push({ key: "tasks", label: t.search_group_tasks, hits: tasksHits });
    if (meetingsHits.length) out.push({ key: "meetings", label: t.search_group_meetings, hits: meetingsHits });
    if (docsHits.length) out.push({ key: "documents", label: t.search_group_documents, hits: docsHits });
    if (trainingHits.length) out.push({ key: "learning", label: t.search_group_learning, hits: trainingHits });
    if (decisionsHits.length) out.push({ key: "decisions", label: t.search_group_decisions, hits: decisionsHits });
    if (supportHits.length) out.push({ key: "support", label: t.search_group_support, hits: supportHits });

    return out;
  }, [qNorm, snapshot, persona, t, prefs.locale]);

  const total = groups.reduce((s, g) => s + g.hits.length, 0);

  return (
    <div className="page">
      <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-soft)", color: "var(--brand-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--brand-soft-strong)" }}>
          <Search size={18} />
        </span>
        {t.search_title}
      </h1>

      <div className="field" style={{ marginTop: 14 }}>
        <label htmlFor="search-q" className="visually-hidden">{t.search_placeholder}</label>
        <div style={{ position: "relative" }}>
          <Search size={16} aria-hidden style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)", pointerEvents: "none" }} />
          <input
            ref={inputRef}
            id="search-q"
            className="input"
            placeholder={t.search_placeholder}
            value={qRaw}
            onChange={(e) => {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set("q", e.target.value);
              else next.delete("q");
              setParams(next, { replace: true });
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                const next = new URLSearchParams(params);
                next.delete("q");
                setParams(next, { replace: true });
                inputRef.current?.blur();
              }
            }}
            autoFocus
            aria-label={t.search_placeholder}
            style={{ paddingLeft: 36, minHeight: 44 }}
          />
          {qRaw && (
            <button
              type="button"
              aria-label={t.close}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete("q");
                setParams(next, { replace: true });
                inputRef.current?.focus();
              }}
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                width: 32, height: 32, borderRadius: 999, border: "1px solid var(--border-ghost)",
                background: "var(--canvas)", color: "var(--text-secondary)", display: "inline-flex",
                alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>
      <p className="xsmall muted" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
        <Sparkles size={12} aria-hidden style={{ flexShrink: 0 }} />
        <span>{t.search_hint}</span>
        <span aria-hidden style={{ marginLeft: "auto", display: "inline-flex", gap: 4, alignItems: "center" }}>
          <kbd style={{ fontSize: 11, background: "var(--canvas)", border: "1px solid var(--border)", borderBottomWidth: 2, borderRadius: 5, padding: "1px 5px" }}>Esc</kbd>
        </span>
      </p>

      {!qNorm ? (
        <div style={{ marginTop: 16 }}>
          <EmptyState title={t.search_hint} body={t.search_placeholder} icon={<Search size={20} aria-hidden />} />
        </div>
      ) : total === 0 ? (
        <div style={{ marginTop: 16 }}>
          <EmptyState title={t.search_empty} body={`${t.search_hint} — “${qRaw}”`} icon={<SearchX size={20} aria-hidden />} />
        </div>
      ) : (
        <div className="stack mt-16" style={{ gap: 20 }}>
          <p className="xsmall muted" style={{ fontWeight: 600 }}>{total} {t.search_title.toLowerCase()} · “{qRaw}”</p>
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`h-${g.key}`}>
              <h3 id={`h-${g.key}`} style={{ fontSize: 13, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span aria-hidden style={{ width: 24, height: 24, borderRadius: 8, background: "var(--brand-soft)", color: "var(--brand-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--brand-soft-strong)" }}>
                  {GROUP_ICON[g.key] ?? <Search size={12} />}
                </span>
                {g.label} <span className="count-chip" style={{ marginLeft: 4 }}>{g.hits.length}</span>
              </h3>
              <ul className="stack" role="list" style={{ gap: 8 }}>
                {g.hits.map((h) => (
                  <li key={h.id}>
                    <Link
                      to={h.to}
                      className="card card-interactive row-between"
                      style={{ textDecoration: "none", color: "inherit", minHeight: 44, gap: 12, padding: "12px 14px" }}
                    >
                      <span className="task-main" style={{ minWidth: 0, flex: 1 }}>
                        <span className="task-title" style={{ fontSize: 14, display: "block", lineHeight: 1.35, overflowWrap: "break-word" }}>{h.title}</span>
                        {h.sub && <span className="xsmall muted" style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 3, lineHeight: 1.4 }}>{h.sub}</span>}
                      </span>
                      <span aria-hidden style={{ width: 32, height: 32, borderRadius: 999, background: "var(--canvas)", border: "1px solid var(--border-ghost)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", flexShrink: 0 }}>
                        <ChevronRight size={14} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
