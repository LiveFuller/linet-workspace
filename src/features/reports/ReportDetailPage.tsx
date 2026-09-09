// Saved report detail: immutable snapshot, distinguishable from current task state.
import { Link, useNavigate, useParams } from "react-router-dom";
import { Download, Printer } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { EmptyState } from "@/components/primitives";
import { formatDateOnly } from "@/lib/dates";
import { downloadFile } from "@/lib/utils";
import type { Report } from "@/domain/types";

export default function ReportDetailPage() {
  const { snapshot, t, prefs, repo, persona, refresh } = useApp();
  const { toast } = useToast();
  const nav = useNavigate();
  const { reportId } = useParams();

  if (!snapshot || !reportId) return <div className="page"><EmptyState title={t.loading} /></div>;
  const report = snapshot.reports.find((r) => r.id === reportId);
  if (!report) {
    return (
      <div className="page page-narrow">
        <EmptyState title={t.not_found_title} body={t.not_found_object} />
        <Link to="/reports" className="btn btn-secondary mt-12">{t.reports_title}</Link>
      </div>
    );
  }

  const toMarkdown = (r: Report): string => {
    const lines = [
      `# ${r.kind === "daily" ? t.report_kind_daily : t.report_kind_weekly} — ${t.reports_title}`,
      `**${r.filtersSummary}** (${r.timezone})`,
      `${t.report_generated}: ${r.generatedAt}`,
      `${t.report_filters_note} ${r.filtersSummary}`,
      "",
    ];
    const groups: [Report["items"][number]["kind"], string][] = [
      ["completed", t.report_completed_work], ["upcoming", t.report_upcoming],
      ["overdue", t.report_overdue], ["blocker", t.report_blockers],
      ["decision", t.report_decisions], ["next_step", t.report_next_steps],
    ];
    for (const [g, label] of groups) {
      const rows = r.items.filter((i) => i.kind === g);
      if (!rows.length) continue;
      lines.push(`## ${label}`);
      for (const row of rows) lines.push(`- ${row.title}${row.dueDate ? ` — ${row.dueDate}` : ""}${row.detail ? `: ${row.detail}` : ""}`);
      lines.push("");
    }
    if (r.commentary) lines.push(`## ${t.report_commentary}`, r.commentary);
    return lines.join("\n");
  };

  const groups: [Report["items"][number]["kind"], string][] = [
    ["completed", t.report_completed_work], ["upcoming", t.report_upcoming],
    ["overdue", t.report_overdue], ["blocker", t.report_blockers],
    ["decision", t.report_decisions], ["next_step", t.report_next_steps],
  ];

  return (
    <div className="page page-narrow">
      <div className="row-between mb-8">
        <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)}>← {t.back}</button>
        <span className={`status-pill ${report.status === "published" ? "st-done" : "st-todo"}`}>
          {report.status === "published" ? t.report_published : t.report_draft}
        </span>
      </div>
      <div className="card no-print-skip">
        <h1 style={{ fontSize: 20 }}>{report.kind === "daily" ? t.report_kind_daily : t.report_kind_weekly}</h1>
        <p className="small muted mt-4">
          {formatDateOnly(report.periodStart, prefs.locale)} → {formatDateOnly(report.periodEnd, prefs.locale)} · {report.timezone}
        </p>
        <p className="xsmall muted">
          {t.report_generated}: {report.generatedAt} · {t.report_snapshot_note}
        </p>
        <div className="banner banner-info mt-12 small" role="note">{t.report_snapshot_note}</div>
      </div>

      {groups.map(([g, label]) => {
        const rows = report.items.filter((i) => i.kind === g);
        if (!rows.length) return null;
        return (
          <section key={g} className="section-block" aria-labelledby={`g-${g}`}>
            <div className="section-head"><h3 id={`g-${g}`}>{label}</h3><span className="count-chip">{rows.length}</span></div>
            <ul className="stack small">
              {rows.map((row, i) => (
                <li key={i} className="task-row" style={{ cursor: "default" }}>
                  <span className="task-main">
                    <span className="task-title" style={{ fontSize: 14 }}>{row.title}</span>
                    <span className="task-meta">
                      {row.dueDate ? `${t.due}: ${formatDateOnly(row.dueDate, prefs.locale)}` : ""}
                      {row.detail ? ` · ${row.detail}` : ""}
                    </span>
                  </span>
                  {row.taskId && <Link className="xsmall" to={`/tasks/${row.taskId}`}>→</Link>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {report.commentary && (
        <section className="section-block">
          <div className="section-head"><h3>{t.report_commentary}</h3></div>
          <p className="small" style={{ whiteSpace: "pre-wrap" }}>{report.commentary}</p>
        </section>
      )}

      <div className="row wrap mt-16 no-print">
        {report.status === "draft" && persona?.role !== "viewer" && (
          <button
            className="btn btn-primary"
            onClick={async () => {
              await repo!.updateReport(report.id, { status: "published" }, persona!.id);
              toast(t.report_published_ok);
              refresh();
            }}
          >
            {t.report_publish}
          </button>
        )}
        <button
          className="btn btn-secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(toMarkdown(report));
              toast(t.saved);
            } catch { toast(t.error_generic); }
          }}
        >
          {t.report_copy_text}
        </button>
        <button className="btn btn-secondary" onClick={() => downloadFile(`report-${report.periodStart}.md`, toMarkdown(report), "text/markdown")}>
          <Download size={15} aria-hidden /> {t.report_export_md}
        </button>
        <button className="btn btn-secondary" onClick={() => window.print()}>
          <Printer size={15} aria-hidden /> {t.report_print}
        </button>
      </div>
    </div>
  );
}
