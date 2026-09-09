// TeamPage — /team
import { Link } from "react-router-dom";
import { Users, Clock3, AlertTriangle, PauseCircle, Mail, MapPin, ArrowRight } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { EmptyState, SkeletonStack } from "@/components/primitives";
import { workloadFor } from "@/domain/selectors";
import { ROLE_LABELS } from "@/domain/permissions";
import type { Person } from "@/domain/types";

export default function TeamPage() {
  const { snapshot, t, today, prefs } = useApp();
  if (!snapshot) return <div className="page"><SkeletonStack count={4} /></div>;
  const { people, tasks } = snapshot;

  const maxWeek = Math.max(1, ...people.map((p) => workloadFor(p as Person, tasks, today).unfinishedDueThisWeek));
  const maxOver = Math.max(1, ...people.map((p) => workloadFor(p as Person, tasks, today).overdueCount));
  const maxBlock = Math.max(1, ...people.map((p) => workloadFor(p as Person, tasks, today).blockedCount));

  if (people.length === 0) {
    return <div className="page"><EmptyState title={t.team_title} body={t.none} icon={<Users size={20} aria-hidden />} /></div>;
  }

  return (
    <div className="page">
      <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-soft)", color: "var(--brand-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--brand-soft-strong)" }}>
          <Users size={18} />
        </span>
        {t.team_title}
      </h1>
      <p className="xsmall muted mb-12" style={{ lineHeight: 1.5, display: "flex", gap: 8 }}>
        <Clock3 size={12} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
        <span>{t.workload_hint}</span>
      </p>

      <ul className="stack" role="list">
        {people.map((p) => {
          const wl = workloadFor(p as Person, tasks, today);
          const roleLabel = ROLE_LABELS[p.role]?.[prefs.locale] ?? p.role;
          const roleTone =
            p.role === "workspace_admin" ? "st-done"
            : p.role === "project_lead" ? "st-progress"
            : p.role === "it_coordinator" ? "st-waiting"
            : p.role === "viewer" ? "st-archived"
            : "st-todo";
          return (
            <li key={p.id} className="card" style={{ padding: 16 }}>
              <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
                <span
                  aria-hidden
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: "var(--brand-soft)", color: "var(--brand-ink)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: 12, flexShrink: 0,
                    border: "1px solid var(--brand-soft-strong)",
                  }}
                >
                  {p.initials}
                </span>
                <span className="task-main" style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span className="task-title" style={{ fontSize: 15 }}>{p.name}</span>
                    <span className={`status-pill ${roleTone}`} style={{ fontSize: 11, padding: "2px 8px", minHeight: 22 }}>{roleLabel}</span>
                  </span>
                  <span className="task-meta" style={{ marginTop: 4, gap: "8px 12px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Mail size={11} aria-hidden /> {p.email}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={11} aria-hidden /> {p.tz}</span>
                  </span>
                </span>
              </div>

              <div className="mt-12" style={{ background: "var(--canvas)", border: "1px solid var(--border-ghost)", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Clock3 size={12} aria-hidden style={{ color: "var(--text-tertiary)" }} />
                  <strong className="xsmall" style={{ fontSize: 11, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)" }}>{t.workload_title}</strong>
                </div>

                <div className="stack" style={{ gap: 10 }}>
                  {/* Due this week */}
                  <div>
                    <div className="row-between xsmall" style={{ marginBottom: 4 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}><Clock3 size={11} aria-hidden /> {t.workload_due_week}</span>
                      <strong style={{ fontSize: 12 }}>{wl.unfinishedDueThisWeek}</strong>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border-ghost)", overflow: "hidden" }} aria-hidden>
                      <div style={{ width: `${Math.min(100, (wl.unfinishedDueThisWeek / maxWeek) * 100)}%`, height: "100%", background: "var(--brand)", borderRadius: 999, transition: "width 220ms var(--ease)" }} />
                    </div>
                  </div>
                  {/* Overdue */}
                  <div>
                    <div className="row-between xsmall" style={{ marginBottom: 4 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: wl.overdueCount ? "var(--danger)" : "var(--text-secondary)", fontWeight: wl.overdueCount ? 700 : 400 }}>
                        <AlertTriangle size={11} aria-hidden /> {t.workload_overdue}
                      </span>
                      <strong style={{ fontSize: 12, color: wl.overdueCount ? "var(--danger)" : "var(--ink)" }}>{wl.overdueCount}</strong>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border-ghost)", overflow: "hidden" }} aria-hidden>
                      <div style={{ width: `${Math.min(100, (wl.overdueCount / maxOver) * 100)}%`, height: "100%", background: wl.overdueCount ? "var(--danger)" : "var(--border-ghost)", borderRadius: 999, transition: "width 220ms var(--ease)" }} />
                    </div>
                  </div>
                  {/* Blocked */}
                  <div>
                    <div className="row-between xsmall" style={{ marginBottom: 4 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)" }}><PauseCircle size={11} aria-hidden /> {t.workload_blocked}</span>
                      <strong style={{ fontSize: 12 }}>{wl.blockedCount}</strong>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border-ghost)", overflow: "hidden" }} aria-hidden>
                      <div style={{ width: `${Math.min(100, (wl.blockedCount / maxBlock) * 100)}%`, height: "100%", background: wl.blockedCount ? "var(--warning)" : "var(--border-ghost)", borderRadius: 999, transition: "width 220ms var(--ease)" }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="row wrap mt-12" style={{ gap: 8 }}>
                <Link className="btn btn-secondary btn-sm" to={`/tasks?owner=${p.id}`} style={{ minHeight: 44 }}>
                  {t.tasks_title} <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
