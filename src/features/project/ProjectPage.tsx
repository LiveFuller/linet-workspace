// Project overview: objective/context, workstreams, members, active/blocked counts,
// decisions, latest report, docs. No invented budget/completion metrics — only
// a clearly-labeled task completion ratio.
import { Link, useParams } from "react-router-dom";
import { Code, Clipboard, CreditCard, Scale, Truck, Layers } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { EmptyState } from "@/components/primitives";
import { isActive, isOverdue, projectCompletionRatio } from "@/domain/selectors";
import { formatDateOnly } from "@/lib/dates";
import type { Workstream } from "@/domain/types";

function WorkstreamIcon({ workstream }: { workstream: Workstream }) {
  const en = workstream.nameEn.toLowerCase();
  const cs = workstream.name.toLowerCase();
  const key = `${en} ${cs}`;
  if (key.includes("digital")) return <Code size={18} aria-hidden />;
  if (key.includes("coord")) return <Clipboard size={18} aria-hidden />;
  if (key.includes("finance")) return <CreditCard size={18} aria-hidden />;
  if (key.includes("legal") || key.includes("právní")) return <Scale size={18} aria-hidden />;
  if (key.includes("procurement") || key.includes("logistic") || key.includes("nákup") || key.includes("logistika")) return <Truck size={18} aria-hidden />;
  return <Layers size={18} aria-hidden />;
}

export default function ProjectPage() {
  const { snapshot, persona, t, today, prefs } = useApp();
  const { projectId } = useParams();
  if (!snapshot || !persona) return <div className="page"><EmptyState title={t.loading} /></div>;

  const project = snapshot.projects.find((p) => p.id === projectId);
  if (!project) {
    return <div className="page page-narrow"><EmptyState title={t.not_found_title} body={t.not_found_object} /></div>;
  }

  const { workstreams, people, tasks, decisions, reports, documents } = snapshot;
  const projTasks = tasks.filter((x) => x.projectId === project.id);
  const active = projTasks.filter(isActive);
  const blocked = projTasks.filter((x) => x.status === "blocked" && x.lifecycle === "active");
  const overdue = projTasks.filter((x) => isOverdue(x, today));
  const ratio = projectCompletionRatio(projTasks, project.id);
  const pct = ratio.total > 0 ? Math.round((ratio.done / ratio.total) * 100) : 0;
  const latestReport = [...reports].sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1))[0];
  const recentDecisions = [...decisions].sort((a, b) => (a.decidedOn < b.decidedOn ? 1 : -1)).slice(0, 4);
  const usefulDocs = documents.slice(0, 4);

  return (
    <div className="page">
      <h1 className="page-title">{prefs.locale === "cs" ? project.name : project.nameEn}</h1>
      <p className="page-subtitle">{project.description}</p>

      <div className="chip-row mb-16" role="list" aria-label={t.project_active_tasks}>
        <Link role="listitem" className="chip" to="/tasks?view=all">{t.project_active_tasks}: {active.length}</Link>
        <Link role="listitem" className="chip" to="/tasks?view=overdue">{t.today_overdue}: {overdue.length}</Link>
        <Link role="listitem" className="chip" to="/tasks?view=waiting">{t.project_blocked}: {blocked.length}</Link>
      </div>

      {/* Hero: task ratio thin progress bar */}
      <section className="card" role="note" aria-label={t.project_task_ratio} style={{ padding: 16, marginBottom: 8 }}>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <span className="small" style={{ fontWeight: 700 }}>{t.project_task_ratio}</span>
          <span className="small muted" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
            {ratio.done}/{ratio.total} · {pct}%
          </span>
        </div>
        <div
          style={{
            height: 8,
            background: "var(--canvas-subtle)",
            borderRadius: 999,
            overflow: "hidden",
            border: "1px solid var(--border-ghost)",
          }}
          aria-hidden
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: "var(--brand)",
              borderRadius: 999,
              transition: "width 320ms var(--ease)",
            }}
          />
        </div>
        <p className="xsmall muted" style={{ marginTop: 10, lineHeight: 1.5 }}>
          {t.project_task_ratio_note}
        </p>
      </section>

      <section className="section-block" aria-labelledby="h-ws">
        <div className="section-head"><h3 id="h-ws">{t.project_workstreams}</h3></div>
        <ul className="detail-grid">
          {workstreams.filter((w) => w.projectId === project.id).map((w) => {
            const wsTasks = active.filter((x) => x.workstreamId === w.id);
            return (
              <li key={w.id} style={{ listStyle: "none" }}>
                <Link
                  to={`/tasks?ws=${w.id}`}
                  className="card card-interactive"
                  style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
                >
                  <span
                    style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: "var(--brand-soft)", color: "var(--brand-ink)",
                      border: "1px solid var(--brand-soft-strong)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      marginBottom: 12, flexShrink: 0,
                    }}
                    aria-hidden
                  >
                    <WorkstreamIcon workstream={w} />
                  </span>
                  <strong className="small" style={{ display: "block", fontWeight: 700 }}>
                    {prefs.locale === "cs" ? w.name : w.nameEn}
                  </strong>
                  <p className="xsmall muted mt-4" style={{ lineHeight: 1.5 }}>{w.description}</p>
                  <span className="xsmall" style={{ fontWeight: 600, color: "var(--brand-strong)", display: "inline-flex", alignItems: "center", gap: 4, marginTop: 12 }}>
                    {t.project_active_tasks}: {wsTasks.length} →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="detail-grid section-block">
        <section className="card" aria-labelledby="h-dec">
          <div className="section-head"><h3 id="h-dec">{t.project_recent_decisions}</h3></div>
          {recentDecisions.length === 0 ? (
            <p className="small muted">{t.none}</p>
          ) : (
            <ul className="stack">
              {recentDecisions.map((d) => {
                const maker = d.decisionMakerId ? people.find((p) => p.id === d.decisionMakerId) : null;
                return (
                  <li key={d.id} className="card" style={{ padding: 12, boxShadow: "none", borderColor: "var(--border-ghost)" }}>
                    <div className="row-between" style={{ alignItems: "flex-start", gap: 8 }}>
                      <strong className="small" style={{ fontWeight: 700, flex: 1, lineHeight: 1.35 }}>{d.title}</strong>
                      <span className="xsmall muted" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                        {formatDateOnly(d.decidedOn, prefs.locale)}
                      </span>
                    </div>
                    <p className="xsmall muted" style={{ marginTop: 6, lineHeight: 1.5 }}>{d.text}</p>
                    {maker ? (
                      <div className="row" style={{ marginTop: 10, gap: 8 }}>
                        <span
                          style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: "var(--brand-soft)", color: "var(--brand-ink)",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 800, flexShrink: 0,
                            border: "1px solid var(--brand-soft-strong)",
                          }}
                          aria-hidden
                        >
                          {maker.initials}
                        </span>
                        <span className="xsmall" style={{ fontWeight: 600 }}>{maker.name}</span>
                      </div>
                    ) : (
                      <span className="xsmall muted" style={{ display: "block", marginTop: 10 }}>{t.none}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="card" aria-labelledby="h-rep">
          <div className="section-head"><h3 id="h-rep">{t.project_latest_report}</h3></div>
          {latestReport ? (
            <Link to={`/reports/${latestReport.id}`} className="small" style={{ fontWeight: 600 }}>
              {latestReport.kind === "daily" ? t.report_kind_daily : t.report_kind_weekly} · {latestReport.periodStart} →
            </Link>
          ) : <p className="small muted">{t.none}</p>}
        </section>
      </div>

      <section className="section-block" aria-labelledby="h-docs">
        <div className="section-head"><h3 id="h-docs">{t.project_useful_docs}</h3><Link to="/documents" className="btn btn-ghost btn-sm">{t.today_view_all}</Link></div>
        <ul className="stack">
          {usefulDocs.map((d) => (
            <li key={d.id} className="card row-between" style={{ padding: 12 }}>
              <div style={{ minWidth: 0 }}>
                <strong className="small">{d.title}</strong>
                <p className="xsmall muted">{d.description}</p>
              </div>
              <Link className="btn btn-secondary btn-sm" to="/documents">{t.documents_open}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="section-block" aria-labelledby="h-team">
        <div className="section-head"><h3 id="h-team">{t.project_responsible}</h3><Link to="/team" className="btn btn-ghost btn-sm">{t.today_view_all}</Link></div>
        <ul className="chip-row">
          {people.map((p) => (
            <li key={p.id} className="chip" style={{ cursor: "default" }}>
              {p.name} · {t.team_role}: {p.role === "project_lead" ? t.persona_lead : p.role === "it_coordinator" ? t.persona_oliver : p.role === "viewer" ? t.persona_viewer : t.persona_member}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
