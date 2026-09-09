// Report generation from actual authorized records. Deterministic template in demo;
// optional AI-assisted wording in live mode (facts never change).
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, Printer, BarChart3 } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { EmptyState } from "@/components/primitives";
import { formatDateOnly, weekBounds } from "@/lib/dates";
import { downloadFile } from "@/lib/utils";
import type { Report, ReportSnapshotItem } from "@/domain/types";

type Mode = "generate" | "schedule";

export default function ReportsPage() {
  const { snapshot, persona, t, today, prefs, repo, refresh } = useApp();
  const { toast } = useToast();
  const nav = useNavigate();
  const [tab, setTab] = useState<Mode>("generate");
  const [kind, setKind] = useState<"daily" | "weekly">("weekly");
  const wb = weekBounds(today);
  const [from, setFrom] = useState(kind === "weekly" ? wb.start : today);
  const [to, setTo] = useState(kind === "weekly" ? wb.end : today);
  const [preview, setPreview] = useState<Report | null>(null);
  const [commentary, setCommentary] = useState("");

  if (!snapshot || !persona) return <div className="page"><EmptyState title={t.loading} /></div>;
  const project = snapshot.projects[0];
  const canGenerate = persona.role !== "viewer";

  // Light premium: completion ratio progress
  const ratio = useMemo(() => {
    const total = snapshot.tasks.length || 1;
    const done = snapshot.tasks.filter((x) => x.status === "done").length;
    const pct = Math.round((done / total) * 100);
    return { total, done, pct };
  }, [snapshot.tasks]);

  const generate = (): Omit<Report, "id" | "createdAt" | "updatedAt"> => {
    const { tasks, decisions } = snapshot;
    const inPeriod = (d: string | null) => d && d >= from && d <= to;
    const items: ReportSnapshotItem[] = [];
    // Completed in period (completion date inside period; tasks remain visible after edits via snapshot)
    for (const task of tasks) {
      if (task.status === "done" && task.completedAt && inPeriod(task.completedAt.slice(0, 10))) {
        items.push({ kind: "completed", taskId: task.id, decisionId: null, title: task.title, detail: null, ownerId: task.completedBy ?? task.ownerId, dueDate: task.dueDate });
      }
    }
    for (const task of tasks) {
      if (task.status !== "done" && task.lifecycle === "active" && task.dueDate && task.dueDate >= from && task.dueDate <= to) {
        items.push({ kind: "upcoming", taskId: task.id, decisionId: null, title: task.title, detail: task.statusNote, ownerId: task.ownerId, dueDate: task.dueDate });
      }
    }
    for (const task of tasks) {
      if (task.status !== "done" && task.lifecycle === "active" && task.dueDate && task.dueDate < from) {
        items.push({ kind: "overdue", taskId: task.id, decisionId: null, title: task.title, detail: task.statusNote, ownerId: task.ownerId, dueDate: task.dueDate });
      }
    }
    for (const task of tasks) {
      if (task.status === "blocked" && task.lifecycle === "active") {
        items.push({ kind: "blocker", taskId: task.id, decisionId: null, title: task.title, detail: task.statusNote, ownerId: task.ownerId, dueDate: task.dueDate });
      }
    }
    for (const d of decisions) {
      if (inPeriod(d.decidedOn)) {
        items.push({ kind: "decision", taskId: null, decisionId: d.id, title: d.title, detail: d.text, ownerId: null, dueDate: null });
      }
    }
    return {
      projectId: project.id,
      kind,
      periodStart: from,
      periodEnd: to,
      timezone: prefs.displayTz,
      generatedAt: new Date().toISOString(),
      status: "draft",
      filtersSummary: `${project.name} · ${from} → ${to}`,
      commentary,
      items,
    };
  };

  const buildPreview = () => {
    const p = generate();
    setPreview({ ...p, id: "preview", createdAt: "", updatedAt: "" });
    toast(t.report_preview_note);
  };

  const save = async (publish: boolean) => {
    const p = generate();
    const res = await repo!.saveReport({ ...p, status: publish ? "published" : "draft", commentary }, persona.id);
    if (res.ok) {
      toast(publish ? t.report_published_ok : t.report_saved);
      refresh();
      nav(`/reports/${res.data.id}`);
    }
  };

  const toMarkdown = (r: Report): string => {
    const lines = [
      `# ${t.reports_title} — ${r.kind === "daily" ? t.report_kind_daily : t.report_kind_weekly}`,
      `**${r.filtersSummary}** (${r.timezone})`,
      `${t.report_generated}: ${r.generatedAt}`,
      "",
    ];
    const groups: [ReportSnapshotItem["kind"], string][] = [
      ["completed", t.report_completed_work], ["upcoming", t.report_upcoming],
      ["overdue", t.report_overdue], ["blocker", t.report_blockers],
      ["decision", t.report_decisions], ["next_step", t.report_next_steps],
    ];
    for (const [g, label] of groups) {
      const rows = r.items.filter((i) => i.kind === g);
      if (!rows.length) continue;
      lines.push(`## ${label}`);
      for (const row of rows) {
        const owner = row.ownerId ? people.find((p) => p.id === row.ownerId)?.name : null;
        lines.push(`- ${row.title}${owner ? ` (${owner})` : ""}${row.dueDate ? ` — ${row.dueDate}` : ""}${row.detail ? `: ${row.detail}` : ""}`);
      }
      lines.push("");
    }
    if (r.commentary) lines.push(`## ${t.report_commentary}`, r.commentary);
    return lines.join("\n");
  };

  const { people } = snapshot;

  // preview ratio for bar
  const previewRatio = useMemo(() => {
    if (!preview) return null;
    const total = preview.items.length || 1;
    const done = preview.items.filter((i) => i.kind === "completed").length;
    return Math.round((done / total) * 100);
  }, [preview]);

  return (
    <div className="page">
      <h1 className="page-title">{t.reports_title}</h1>

      <div className="card mb-12" style={{ padding: 16 }}>
        <div className="row-between">
          <span className="small" style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart3 size={16} aria-hidden /> {t.project_task_ratio}
          </span>
          <span className="xsmall muted">{ratio.done} / {ratio.total}</span>
        </div>
        <div style={{ height: 8, background: "var(--canvas-subtle)", borderRadius: 999, overflow: "hidden", marginTop: 10, border: "1px solid var(--border-ghost)" }}>
          <div style={{ width: `${ratio.pct}%`, height: "100%", background: "linear-gradient(90deg, var(--brand) 0%, var(--brand-strong) 100%)", borderRadius: 999, transition: "width 320ms var(--ease)" }} />
        </div>
        <p className="xsmall muted mt-8" style={{ marginBottom: 0 }}>{ratio.pct}% · {t.project_task_ratio_note}</p>
      </div>

      <div className="segmented mb-12" role="tablist">
        <button role="tab" aria-selected={tab === "generate"} className={tab === "generate" ? "active" : ""} onClick={() => setTab("generate")}>{t.reports_new}</button>
        <button role="tab" aria-selected={tab === "schedule"} className={tab === "schedule" ? "active" : ""} onClick={() => setTab("schedule")}>{t.report_schedule}</button>
      </div>

      {tab === "generate" && (
        <>
          {!canGenerate && <div className="banner banner-warn small">{t.persona_note}</div>}
          <div className="card mb-12">
            <div className="detail-grid">
              <div className="field">
                <label htmlFor="rp-kind">{t.report_period}</label>
                <select id="rp-kind" className="select" value={kind}
                  onChange={(e) => {
                    const k = e.target.value as "daily" | "weekly";
                    setKind(k);
                    if (k === "weekly") { setFrom(wb.start); setTo(wb.end); }
                    else { setFrom(today); setTo(today); }
                  }}>
                  <option value="daily">{t.report_kind_daily}</option>
                  <option value="weekly">{t.report_kind_weekly}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="rp-from">{t.report_period_start}</label>
                <input id="rp-from" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="rp-to">{t.report_period_end}</label>
                <input id="rp-to" className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
            <div className="row wrap">
              <button className="btn btn-secondary" onClick={buildPreview} disabled={!canGenerate}>{t.report_preview}</button>
              <span className="xsmall muted">{t.report_preview_note}</span>
            </div>
          </div>

          {preview && (
            <div className="card mb-12">
              <div className="row-between">
                <h3>{t.report_preview}</h3>
                <span className="xsmall muted">{preview.items.length} items</span>
              </div>
              <p className="xsmall muted mb-12">{t.report_preview_note}</p>
              {previewRatio !== null && (
                <div className="mb-12">
                  <div className="row-between">
                    <span className="xsmall" style={{ fontWeight: 600 }}>{t.report_completed_work}</span>
                    <span className="xsmall muted">{previewRatio}%</span>
                  </div>
                  <div style={{ height: 6, background: "var(--canvas-subtle)", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
                    <div style={{ width: `${previewRatio}%`, height: "100%", background: "var(--success)", borderRadius: 999 }} />
                  </div>
                </div>
              )}
              <ReportItems report={preview} t={t} _locale={prefs.locale} />
              <div className="field mt-12">
                <label htmlFor="rp-comm">{t.report_commentary}</label>
                <textarea id="rp-comm" className="textarea" value={commentary} onChange={(e) => setCommentary(e.target.value)} placeholder={t.report_commentary} />
              </div>
              <div className="row wrap">
                <button className="btn btn-secondary" onClick={() => save(false)} disabled={!canGenerate}>{t.report_save_draft}</button>
                <button className="btn btn-primary" onClick={() => save(true)} disabled={!canGenerate}>{t.report_publish}</button>
                <button className="btn btn-secondary" onClick={() => downloadFile("report.md", toMarkdown({ ...preview, commentary }), "text/markdown")}>
                  <Download size={15} aria-hidden /> {t.report_export_md}
                </button>
                <button className="btn btn-secondary" onClick={() => window.print()}>
                  <Printer size={15} aria-hidden /> {t.report_print}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "schedule" && <SchedulePanel />}

      {/* Saved reports */}
      <section className="section-block" aria-labelledby="h-saved">
        <div className="section-head"><h3 id="h-saved">{t.reports_title}</h3><span className="count-chip">{snapshot.reports.length}</span></div>
        <ul className="stack">
          {[...snapshot.reports].sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1)).map((r) => (
            <li key={r.id}>
              <Link to={`/reports/${r.id}`} className="card card-interactive row-between" style={{ textDecoration: "none", color: "inherit" }}>
                <div>
                  <strong className="small">{r.kind === "daily" ? t.report_kind_daily : t.report_kind_weekly} · {r.periodStart} → {r.periodEnd}</strong>
                  <p className="xsmall muted">{r.items.length} · {formatDateOnly(r.generatedAt.slice(0, 10), prefs.locale)}</p>
                </div>
                <span className={`status-pill ${r.status === "published" ? "st-done" : "st-todo"}`}>
                  {r.status === "published" ? t.report_published : t.report_draft}
                </span>
              </Link>
            </li>
          ))}
          {snapshot.reports.length === 0 && (
            <li><EmptyState title={t.reports_title} body={t.none} /></li>
          )}
        </ul>
      </section>
    </div>
  );
}

function ReportItems({ report, t }: { report: Report; t: ReturnType<typeof useApp>["t"]; _locale: string }) {
  const groups: [ReportSnapshotItem["kind"], string][] = [
    ["completed", t.report_completed_work], ["upcoming", t.report_upcoming],
    ["overdue", t.report_overdue], ["blocker", t.report_blockers],
    ["decision", t.report_decisions], ["next_step", t.report_next_steps],
  ];
  return (
    <>
      {groups.map(([g, label]) => {
        const rows = report.items.filter((i) => i.kind === g);
        if (!rows.length) return null;
        return (
          <div key={g} className="mt-12">
            <h4 className="mb-8">{label}</h4>
            <ul className="stack small">
              {rows.map((row, i) => (
                <li key={i} className="row-between">
                  <span>{row.title}{row.detail ? ` — ${row.detail}` : ""}</span>
                  {row.taskId && <Link className="xsmall" to={`/tasks/${row.taskId}`}>{row.dueDate ?? ""} →</Link>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

function SchedulePanel() {
  const { snapshot, persona, t, prefs, repo, refresh } = useApp();
  const { toast } = useToast();
  const schedule = snapshot?.schedules[0];
  const [cadence, setCadence] = useState<"daily" | "weekly">(schedule?.cadence ?? "weekly");
  const [sendAt, setSendAt] = useState(schedule?.sendAtLocal ?? "08:00");
  const [channel, setChannel] = useState<"in_app" | "email">(schedule?.channel ?? "in_app");
  const [recipients, setRecipients] = useState((schedule?.recipients ?? []).join(", "));
  const [enabled, setEnabled] = useState(schedule?.enabled ?? false);

  if (!snapshot || !persona) return null;
  const canManage = persona.role === "project_lead" || persona.role === "workspace_admin";
  const project = snapshot.projects[0];

  return (
    <div className="card mb-12">
      <h3>{t.report_schedule}</h3>
      <p className="xsmall muted mb-12">{t.report_demo_send_note}</p>
      <div className="detail-grid">
        <div className="field">
          <label htmlFor="sc-cad">{t.report_schedule_cadence}</label>
          <select id="sc-cad" className="select" value={cadence} onChange={(e) => setCadence(e.target.value as typeof cadence)} disabled={!canManage}>
            <option value="daily">{t.report_kind_daily}</option>
            <option value="weekly">{t.report_kind_weekly}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sc-time">{t.report_schedule_time}</label>
          <input id="sc-time" className="input" type="time" value={sendAt} onChange={(e) => setSendAt(e.target.value)} disabled={!canManage} />
        </div>
        <div className="field">
          <label htmlFor="sc-ch">{t.report_schedule_channel}</label>
          <select id="sc-ch" className="select" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} disabled={!canManage}>
            <option value="in_app">In-app</option>
            <option value="email">E-mail</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sc-rec">{t.report_schedule_recipients}</label>
          <input id="sc-rec" className="input" value={recipients} onChange={(e) => setRecipients(e.target.value)} disabled={!canManage} placeholder="jmeno@example.invalid" />
        </div>
      </div>
      <div className="field">
        <label className="row" style={{ fontWeight: 400 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 20, height: 20 }} />
          {enabled ? t.report_schedule_enabled : t.report_schedule_disabled}
        </label>
      </div>
      <div className="row wrap">
        <button
          className="btn btn-primary"
          disabled={!canManage}
          onClick={async () => {
            const res = await repo!.upsertSchedule({
              projectId: project.id, kind: cadence, cadence, timezone: prefs.displayTz,
              sendAtLocal: sendAt, channel, enabled,
              recipients: recipients.split(",").map((x) => x.trim()).filter(Boolean),
            }, persona.id);
            if (res.ok) { toast(t.report_schedule_saved); refresh(); }
          }}
        >
          {t.save}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => toast(t.report_run_preview)}
          disabled={!canManage}
        >
          {t.report_run_preview}
        </button>
      </div>
      {!canManage && <p className="xsmall muted mt-8">{t.persona_note}</p>}
    </div>
  );
}
