// LearningModulePage — /learning/:moduleId
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, HelpCircle, ChevronLeft, Clock3, User2, BadgeCheck, BookOpen, GraduationCap, ListChecks } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { EmptyState, SkeletonStack } from "@/components/primitives";

export default function LearningModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const { snapshot, persona, t, prefs, repo, refresh } = useApp();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  if (!snapshot || !persona) {
    return <div className="page page-narrow"><SkeletonStack count={3} /></div>;
  }
  if (!moduleId) {
    return <div className="page page-narrow"><EmptyState title={t.not_found_title} body={t.not_found_object} icon={<BookOpen size={20} aria-hidden />} /></div>;
  }

  const mod = snapshot.modules.find((m) => m.slug === moduleId || m.id === moduleId);
  if (!mod) {
    return (
      <div className="page page-narrow">
        <EmptyState title={t.not_found_title} body={t.not_found_object} icon={<BookOpen size={20} aria-hidden />} />
        <Link className="btn btn-secondary mt-12" to="/learning" style={{ minHeight: 44 }}>{t.nav_learning}</Link>
      </div>
    );
  }

  const isCs = prefs.locale === "cs";
  const title = isCs ? mod.title : mod.titleEn;
  const objective = isCs ? mod.objective : mod.objectiveEn;
  const content = isCs ? mod.content : mod.contentEn;
  const example = isCs ? mod.example : mod.exampleEn;

  const progress = snapshot.trainingProgress.find(
    (p) => p.moduleId === mod.slug && p.personId === persona.id
  );
  const doneIds = progress?.checklistDone ?? [];
  const isCompleted = progress?.state === "completed";

  const allChecked = useMemo(
    () => mod.checklist.length === 0 || mod.checklist.every((c) => doneIds.includes(c.id)),
    [mod.checklist, doneIds]
  );

  const reviewLabel =
    mod.reviewStatus === "approved" ? t.learning_review_approved
    : mod.reviewStatus === "in_review" ? t.learning_review_in_review
    : t.learning_review_draft;

  const toggleCheck = async (checkId: string, nextChecked: boolean) => {
    if (!persona || !repo) return;
    const next = nextChecked ? [...doneIds, checkId] : doneIds.filter((id) => id !== checkId);
    const dedup = Array.from(new Set(next));
    const state: "in_progress" | "completed" | "not_started" =
      dedup.length === 0 ? "not_started"
      : dedup.length >= mod.checklist.length && mod.checklist.length > 0 ? (progress?.state === "completed" ? "completed" : "in_progress")
      : "in_progress";
    const patch: { checklistDone: string[]; state?: string } =
      progress?.state === "completed" && dedup.length < mod.checklist.length
        ? { checklistDone: dedup, state: "in_progress" }
        : { checklistDone: dedup, state };
    setBusy(true);
    const res = await (repo as unknown as { setTrainingProgress: (a: string, b: unknown, c: string) => Promise<{ ok: boolean }> }).setTrainingProgress(mod.slug, patch, persona.id);
    setBusy(false);
    if (res.ok) {
      toast(t.saved);
      refresh();
    }
  };

  const markComplete = async () => {
    if (!persona || !repo) return;
    if (!allChecked) return;
    setBusy(true);
    const res = await (repo as unknown as { setTrainingProgress: (a: string, b: unknown, c: string) => Promise<{ ok: boolean }> }).setTrainingProgress(mod.slug, { state: "completed", checklistDone: doneIds }, persona.id);
    setBusy(false);
    if (res.ok) {
      toast(t.learning_completed);
      refresh();
    }
  };

  const askQuestion = async () => {
    if (!persona || !repo) return;
    const projectId = snapshot.projects[0]?.id;
    if (!projectId) return;
    setBusy(true);
    const res = await repo.createSupportTicket(
      {
        projectId,
        title: `${t.learning_ask_question}: ${title}`,
        category: "training",
        description: `${t.learning_title}: ${title} (${mod.slug})\n\n${objective}\n\n${t.learning_ask_question}: `,
        impact: "low",
      },
      persona.id
    );
    setBusy(false);
    if (res.ok) {
      toast(t.learning_question_sent);
      refresh();
    }
  };

  const progressPct = mod.checklist.length ? Math.round((doneIds.length / mod.checklist.length) * 100) : (isCompleted ? 100 : 0);

  return (
    <div className="page page-narrow">
      <div className="row-between mb-12" style={{ gap: 12 }}>
        <Link className="btn btn-ghost btn-sm" to="/learning" style={{ minHeight: 44 }}>
          <ChevronLeft size={16} aria-hidden /> {t.back}
        </Link>
        <span className={`status-pill ${isCompleted ? "st-done" : doneIds.length > 0 ? "st-progress" : "st-todo"}`} style={{ flexShrink: 0 }}>
          {isCompleted ? t.learning_progress_completed : doneIds.length > 0 ? t.learning_progress_in_progress : t.learning_progress_not_started}
        </span>
      </div>

      {/* Hero card */}
      <div className="card" style={{ background: "var(--brand-soft)", borderColor: "var(--brand-soft-strong)", padding: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span aria-hidden style={{ width: 44, height: 44, borderRadius: 12, background: "var(--brand)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <GraduationCap size={22} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: 22, lineHeight: 1.25 }}>{title}</h1>
            <p className="small muted mt-4" style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Clock3 size={14} aria-hidden /> {t.learning_minutes(mod.estimatedMinutes)}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><User2 size={14} aria-hidden /> {mod.contentOwner}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><BadgeCheck size={14} aria-hidden /> {reviewLabel}</span>
            </p>
            {mod.isOnboardingPath && (
              <span className="status-pill st-progress mt-8" style={{ background: "var(--surface)", borderColor: "var(--brand-soft-strong)", color: "var(--brand-ink)" }}>
                {t.learning_onboarding_path}
              </span>
            )}
          </div>
        </div>
        {mod.checklist.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ height: 8, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--brand-soft-strong)", overflow: "hidden" }} aria-hidden>
              <div style={{ width: `${progressPct}%`, height: "100%", background: isCompleted ? "var(--success)" : "var(--brand)", transition: "width 220ms var(--ease)" }} />
            </div>
            <p className="xsmall muted mt-4" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{t.learning_checklist}: {doneIds.length}/{mod.checklist.length}</span>
              <span style={{ fontWeight: 700, color: isCompleted ? "var(--success)" : "var(--brand-ink)" }}>{progressPct}%</span>
            </p>
          </div>
        )}
      </div>

      <div className="card mt-12">
        <p className="small" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          <strong style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><BookOpen size={14} aria-hidden /> {t.learning_objective}:</strong> {objective}
        </p>
      </div>

      {content.map((sec, idx) => (
        <section key={idx} className="card mt-12" style={{ padding: 18 }}>
          <h3 style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden style={{ width: 28, height: 28, borderRadius: 8, background: "var(--canvas)", border: "1px solid var(--border-ghost)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 12, fontWeight: 800 }}>{idx + 1}</span>
            {sec.heading}
          </h3>
          <p className="small mt-8" style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, color: "var(--ink)" }}>{sec.body}</p>
        </section>
      ))}

      {example && (
        <section className="card mt-12" style={{ background: "var(--canvas)", borderStyle: "dashed" }}>
          <h3 style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 8, color: "var(--brand-ink)" }}>
            <span aria-hidden style={{ width: 26, height: 26, borderRadius: 8, background: "var(--brand-soft)", border: "1px solid var(--brand-soft-strong)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--brand-strong)" }}>✦</span>
            {t.learning_example}
          </h3>
          <p className="small mt-8" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{example}</p>
        </section>
      )}

      <section className="section-block mt-16" aria-labelledby="h-check">
        <div className="section-head">
          <h3 id="h-check" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ListChecks size={16} aria-hidden style={{ color: "var(--brand-strong)" }} /> {t.learning_checklist}
          </h3>
          <span className="count-chip">{doneIds.length}/{mod.checklist.length}</span>
        </div>
        {mod.checklist.length === 0 ? (
          <EmptyState title={t.none} body={t.learning_checklist} icon={<ListChecks size={20} aria-hidden />} />
        ) : (
          <ul className="stack" role="list">
            {mod.checklist.map((item) => {
              const label = isCs ? item.title : item.titleEn;
              const checked = doneIds.includes(item.id);
              return (
                <li key={item.id} className={`task-row ${checked ? "done" : ""}`} style={{ minHeight: 44 }}>
                  <button
                    className="task-check"
                    aria-label={label}
                    aria-pressed={checked}
                    disabled={busy}
                    onClick={() => toggleCheck(item.id, !checked)}
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    {checked && <Check size={15} aria-hidden style={{ color: "#fff" }} />}
                  </button>
                  <span className="task-main" style={{ display: "flex", alignItems: "center" }}>
                    <span className="task-title" style={{ fontSize: 14, textDecoration: checked ? "line-through" : "none", opacity: checked ? 0.85 : 1 }}>{label}</span>
                  </span>
                  {checked && <span className="status-pill st-done" style={{ flexShrink: 0 }}><Check size={12} aria-hidden /> {t.learning_progress_completed}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="row wrap mt-16" style={{ gap: 10 }}>
        <button
          className="btn btn-primary"
          disabled={busy || isCompleted || !allChecked}
          onClick={markComplete}
          title={!allChecked ? t.learning_complete_needs_checklist : undefined}
          style={{ minHeight: 44 }}
        >
          <Check size={16} aria-hidden /> {isCompleted ? t.learning_completed : t.learning_mark_complete}
        </button>
        {!allChecked && !isCompleted && mod.checklist.length > 0 && (
          <span className="xsmall muted" role="note" style={{ alignSelf: "center", maxWidth: 260, lineHeight: 1.4 }}>{t.learning_complete_needs_checklist}</span>
        )}
        <button className="btn btn-secondary" onClick={askQuestion} disabled={busy} style={{ minHeight: 44 }}>
          <HelpCircle size={16} aria-hidden /> {t.learning_ask_question}
        </button>
      </div>
    </div>
  );
}
