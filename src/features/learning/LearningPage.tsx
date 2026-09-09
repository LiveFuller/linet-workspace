// Learning: first-class destination. Progress per user, onboarding path, coordinator overview.
import { Link } from "react-router-dom";
import { GraduationCap, Clock3, CheckCircle2, BookOpen, Users, ChevronRight, Award } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { EmptyState, SkeletonStack } from "@/components/primitives";

export default function LearningPage() {
  const { snapshot, persona, t, prefs } = useApp();
  if (!snapshot || !persona) return <div className="page"><SkeletonStack count={3} /></div>;
  const { modules, trainingProgress } = snapshot;
  const mine = trainingProgress.filter((p) => p.personId === persona.id);
  const progressFor = (slug: string) => mine.find((p) => p.moduleId === slug);
  const onboarding = modules.filter((m) => m.isOnboardingPath);
  const other = modules.filter((m) => !m.isOnboardingPath);
  const canSeeOverview = ["project_lead", "it_coordinator", "workspace_admin"].includes(persona.role);

  const completedOnboarding = onboarding.filter((m) => progressFor(m.slug)?.state === "completed").length;
  const onboardingPct = onboarding.length ? Math.round((completedOnboarding / onboarding.length) * 100) : 0;

  const statePill = (slug: string) => {
    const p = progressFor(slug);
    if (!p || p.state === "not_started") return <span className="status-pill st-todo">{t.learning_progress_not_started}</span>;
    if (p.state === "in_progress") return <span className="status-pill st-progress">{t.learning_progress_in_progress}</span>;
    return <span className="status-pill st-done">{t.learning_progress_completed}</span>;
  };

  const ModuleCard = ({ m }: { m: typeof modules[number] }) => {
    const title = prefs.locale === "cs" ? m.title : m.titleEn;
    const p = progressFor(m.slug);
    const isDone = p?.state === "completed";
    const isProgress = p?.state === "in_progress";
    return (
      <Link
        to={`/learning/${m.slug}`}
        className="card card-interactive row-between"
        style={{ textDecoration: "none", color: "inherit", minHeight: 44, gap: 12 }}
      >
        <span style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0, flex: 1 }}>
          <span
            aria-hidden
            style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: isDone ? "var(--success-soft)" : isProgress ? "var(--brand-soft)" : "var(--canvas-subtle)",
              color: isDone ? "var(--success)" : isProgress ? "var(--brand-strong)" : "var(--text-tertiary)",
              border: `1px solid ${isDone ? "var(--success-border)" : isProgress ? "var(--brand-soft-strong)" : "var(--border-ghost)"}`,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {isDone ? <CheckCircle2 size={18} /> : <BookOpen size={18} />}
          </span>
          <span className="task-main" style={{ minWidth: 0 }}>
            <span className="task-title" style={{ fontSize: 14.5, display: "block", lineHeight: 1.35 }}>{title}</span>
            <span className="task-meta" style={{ marginTop: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Clock3 size={12} aria-hidden /> {t.learning_minutes(m.estimatedMinutes)}
              </span>
              <span
                style={{
                  fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                  background: m.reviewStatus === "approved" ? "var(--success-soft)" : m.reviewStatus === "in_review" ? "var(--warning-soft)" : "var(--canvas-subtle)",
                  color: m.reviewStatus === "approved" ? "var(--success)" : m.reviewStatus === "in_review" ? "var(--warning)" : "var(--text-tertiary)",
                  border: `1px solid ${m.reviewStatus === "approved" ? "var(--success-border)" : m.reviewStatus === "in_review" ? "var(--warning-border)" : "var(--border-ghost)"}`,
                }}
              >
                {m.reviewStatus === "approved" ? t.learning_review_approved : m.reviewStatus === "in_review" ? t.learning_review_in_review : t.learning_review_draft}
              </span>
            </span>
          </span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {statePill(m.slug)}
          <ChevronRight size={16} aria-hidden style={{ color: "var(--text-tertiary)" }} />
        </span>
      </Link>
    );
  };

  return (
    <div className="page">
      <h1 className="page-title">{t.learning_title}</h1>
      <p className="page-subtitle">
        {t.learning_onboarding_path} · {onboarding.length} {t.nav_learning.toLowerCase()} · {completedOnboarding}/{onboarding.length} {t.learning_progress_completed.toLowerCase()}
      </p>

      {/* Onboarding hero */}
      <section
        className="card"
        aria-labelledby="h-ob-hero"
        style={{ background: "var(--brand-soft)", borderColor: "var(--brand-soft-strong)", padding: 20, marginBottom: 16 }}
      >
        <div className="row-between" style={{ alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span aria-hidden style={{ width: 32, height: 32, borderRadius: 8, background: "var(--brand)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <GraduationCap size={18} />
              </span>
              <h2 id="h-ob-hero" style={{ fontSize: 17 }}>{t.learning_onboarding_path}</h2>
            </div>
            <p className="small muted" style={{ margin: 0, lineHeight: 1.5 }}>
              {prefs.locale === "cs"
                ? "Základní cesta nového kolegy — dokončete v tomto pořadí. Každý modul je krátký a praktický."
                : "New colleague baseline — complete in order. Each module is short and practical."}
            </p>
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--brand-soft-strong)", overflow: "hidden" }} aria-hidden>
                <div style={{ width: `${onboardingPct}%`, height: "100%", background: "var(--brand)", transition: "width 220ms var(--ease)" }} />
              </div>
              <span className="xsmall" style={{ fontWeight: 750, color: "var(--brand-ink)", whiteSpace: "nowrap" }}>{onboardingPct}%</span>
            </div>
            <p className="xsmall muted" style={{ marginTop: 6 }}>{completedOnboarding} / {onboarding.length} · {t.learning_progress_completed}</p>
          </div>
          <span className="status-pill" style={{ background: "var(--surface)", color: "var(--brand-ink)", borderColor: "var(--brand-soft-strong)", flexShrink: 0 }}>
            <Award size={12} aria-hidden /> {t.learning_estimated}
          </span>
        </div>
      </section>

      <section className="section-block" aria-labelledby="h-ob">
        <div className="section-head">
          <h3 id="h-ob" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <GraduationCap size={16} aria-hidden style={{ color: "var(--brand-strong)" }} /> {t.learning_onboarding_path}
          </h3>
          <span className="count-chip">{onboarding.length}</span>
        </div>
        {onboarding.length === 0 ? (
          <EmptyState title={t.none} icon={<GraduationCap size={20} aria-hidden />} />
        ) : (
          <ul className="stack" role="list">
            {onboarding.map((m) => (
              <li key={m.id}><ModuleCard m={m} /></li>
            ))}
          </ul>
        )}
      </section>

      <section className="section-block" aria-labelledby="h-all">
        <div className="section-head">
          <h3 id="h-all" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BookOpen size={16} aria-hidden style={{ color: "var(--text-tertiary)" }} /> {t.learning_title}
          </h3>
          <span className="count-chip">{other.length}</span>
        </div>
        {other.length === 0 ? (
          <EmptyState title={t.none} icon={<BookOpen size={20} aria-hidden />} />
        ) : (
          <ul className="stack" role="list">
            {other.map((m) => (
              <li key={m.id}><ModuleCard m={m} /></li>
            ))}
          </ul>
        )}
      </section>

      {canSeeOverview ? (
        <section className="section-block" aria-labelledby="h-ov">
          <div className="section-head">
            <h3 id="h-ov" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={16} aria-hidden style={{ color: "var(--brand-strong)" }} /> {t.learning_overview}
            </h3>
            <span className="xsmall muted">{snapshot.people.filter((p) => p.role !== "viewer").length} {t.nav_team.toLowerCase()}</span>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="small" style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--surface)" }}>
                  <tr style={{ borderBottom: "1px solid var(--border-ghost)", background: "var(--canvas-subtle)" }}>
                    <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", position: "sticky", left: 0, background: "var(--canvas-subtle)", zIndex: 2, minWidth: 140, borderRight: "1px solid var(--border-ghost)" }}>
                      {t.nav_team}
                    </th>
                    {modules.map((m) => (
                      <th key={m.id} style={{ padding: "10px 8px", fontSize: 11, fontWeight: 700, color: "var(--ink)", textAlign: "center", minWidth: 84, whiteSpace: "nowrap" }} title={prefs.locale === "cs" ? m.title : m.titleEn}>
                        {(prefs.locale === "cs" ? m.title : m.titleEn).slice(0, 20)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snapshot.people.filter((p) => p.role !== "viewer").map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border-ghost)" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 650, position: "sticky", left: 0, background: "var(--surface)", borderRight: "1px solid var(--border-ghost)", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <span aria-hidden style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--brand-soft)", color: "var(--brand-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>{p.initials}</span>
                          {p.name}
                        </span>
                      </td>
                      {modules.map((m) => {
                        const pr = snapshot.trainingProgress.find((x) => x.personId === p.id && x.moduleId === m.slug);
                        const isDone = pr?.state === "completed";
                        const isProg = pr?.state === "in_progress";
                        return (
                          <td key={m.id} style={{ padding: "8px", textAlign: "center" }}>
                            <span
                              aria-label={isDone ? t.learning_progress_completed : isProg ? t.learning_progress_in_progress : t.learning_progress_not_started}
                              style={{
                                width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
                                fontSize: 13, fontWeight: 800,
                                background: isDone ? "var(--success-soft)" : isProg ? "var(--brand-soft)" : "var(--canvas)",
                                color: isDone ? "var(--success)" : isProg ? "var(--brand-strong)" : "var(--text-tertiary)",
                                border: `1px solid ${isDone ? "var(--success-border)" : isProg ? "var(--brand-soft-strong)" : "var(--border-ghost)"}`,
                              }}
                            >
                              {isDone ? "✓" : isProg ? "…" : "—"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border-ghost)", background: "var(--canvas)", display: "flex", gap: 12, flexWrap: "wrap" }} className="xsmall muted">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--success-soft)", border: "1px solid var(--success-border)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--success)", fontSize: 11 }}>✓</span> {t.learning_progress_completed}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--brand-soft)", border: "1px solid var(--brand-soft-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--brand-strong)", fontSize: 11 }}>…</span> {t.learning_progress_in_progress}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--canvas)", border: "1px solid var(--border-ghost)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 11 }}>—</span> {t.learning_progress_not_started}</span>
            </div>
          </div>
        </section>
      ) : (
        <div className="banner banner-info small mt-12" role="note" style={{ display: "flex", gap: 10 }}>
          <Users size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{t.learning_no_access_overview}</span>
        </div>
      )}
    </div>
  );
}
