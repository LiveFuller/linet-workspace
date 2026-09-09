// Task capture: title + project only required; everything else progressive.
// ~10 second capture. Owner defaults to current user; unassigned allowed.
// Templates create tasks with a ready checklist.
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { EmptyState } from "@/components/primitives";
import { workloadFor } from "@/domain/selectors";
import { Users } from "lucide-react";

export default function TaskForm() {
  const { snapshot, persona, t, prefs, repo, refresh } = useApp();
  const { toast } = useToast();
  const nav = useNavigate();
  const [_params] = useSearchParams();
  const { taskId } = useParams(); // edit mode when present
  const editing = Boolean(taskId);

  const existing = editing ? snapshot?.tasks.find((x) => x.id === taskId) : null;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [ownerId, setOwnerId] = useState<string>(existing?.ownerId ?? persona?.id ?? "");
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? "");
  const [workstreamId, setWorkstreamId] = useState(existing?.workstreamId ?? "");
  const [labelIds, setLabelIds] = useState<string[]>(existing?.labelIds ?? []);
  const [status, setStatus] = useState(existing?.status ?? "todo");
  const [statusNote, setStatusNote] = useState(existing?.statusNote ?? "");
  const [useTemplate, setUseTemplate] = useState<string>("");
  const [issues, setIssues] = useState<string[]>([]);
  const [showWorkload, setShowWorkload] = useState(false);
  const [version] = useState(existing?.version ?? 1);

  if (!snapshot || !persona) return <div className="page"><EmptyState title={t.loading} /></div>;
  const project = snapshot.projects[0];
  const { people, workstreams, labels, templates, tasks } = snapshot;

  const canEdit = persona.role !== "viewer";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!title.trim()) errs.push(t.validation_required_title);
    setIssues(errs);
    if (errs.length) return;

    const draft = {
      projectId: project.id,
      title: title.trim(),
      description,
      ownerId: ownerId || null,
      workstreamId: workstreamId || null,
      labelIds,
      dueDate: dueDate || null,
      status,
      statusNote: (status === "waiting" || status === "blocked") && statusNote ? statusNote : null,
      source: editing ? existing?.source ?? "manual" : "manual",
      sourceRef: existing?.sourceRef ?? null,
      sourceUrl: existing?.sourceUrl ?? null,
    };

    let res;
    if (editing) {
      res = await repo!.updateTask(taskId!, { ...draft, expectedVersion: version, title: title.trim() }, persona.id);
    } else {
      res = await repo!.createTask(draft, persona.id);
    }
    if (res.ok) {
      // optional template checklist
      if (!editing && useTemplate) {
        const tpl = templates.find((x) => x.id === useTemplate);
        if (tpl) {
          for (const item of tpl.checklist) {
            await repo!.addChecklistItem(res.data.id, item.title, persona.id);
          }
        }
      }
      toast(editing ? t.task_saved : t.task_created);
      refresh();
      nav(`/tasks/${res.data.id}`);
    } else {
      if (res.error.code === "conflict") {
        setIssues([res.error.message]);
      } else if (res.error.code === "validation") {
        setIssues(res.error.issues.map((i) => i.message));
      } else if (res.error.code === "forbidden") {
        setIssues([res.error.message ?? t.error_generic]);
      } else {
        setIssues([res.error.code]);
      }
    }
  };

  if (!canEdit) {
    return <div className="page page-narrow"><EmptyState title={t.not_found_title} body={t.persona_note} /></div>;
  }

  return (
    <div className="page page-narrow">
      <h1 className="page-title">{editing ? t.task_editing : t.task_new}</h1>
      <form onSubmit={submit} noValidate>
        {issues.length > 0 && (
          <div className="banner banner-danger" role="alert">
            <ul className="small" style={{ margin: 0 }}>
              {issues.map((i, n) => <li key={n}>{i}</li>)}
            </ul>
          </div>
        )}
        <div className="field">
          <label htmlFor="tf-title">{t.task_title_label} *</label>
          <input
            id="tf-title" className="input" value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus maxLength={200} required
            aria-required="true"
          />
        </div>
        <div className="detail-grid">
          <div className="field">
            <label htmlFor="tf-owner">{t.task_owner_label}</label>
            <div className="row">
              <select id="tf-owner" className="select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">{t.task_owner_unassigned}</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              {ownerId && (
                <button
                  type="button" className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}
                  onClick={() => setShowWorkload(true)}
                  aria-label={t.workload_title}
                >
                  <Users size={15} aria-hidden /> ({t.workload_due_week.split(" ")[0]})
                </button>
              )}
            </div>
          </div>
          <div className="field">
            <label htmlFor="tf-due">{t.task_due_label} <span className="muted">({t.optional})</span></label>
            <input id="tf-due" className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="detail-grid">
          <div className="field">
            <label htmlFor="tf-ws">{t.task_workstream_label} <span className="muted">({t.optional})</span></label>
            <select id="tf-ws" className="select" value={workstreamId} onChange={(e) => setWorkstreamId(e.target.value)}>
              <option value="">{t.none}</option>
              {workstreams.map((w) => <option key={w.id} value={w.id}>{prefs.locale === "cs" ? w.name : w.nameEn}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tf-status">{t.task_status_label}</label>
            <select id="tf-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="todo">{t.status_todo}</option>
              <option value="in_progress">{t.status_in_progress}</option>
              <option value="waiting">{t.status_waiting}</option>
              <option value="blocked">{t.status_blocked}</option>
            </select>
          </div>
        </div>
        {(status === "waiting" || status === "blocked") && (
          <div className="field">
            <label htmlFor="tf-note">{t.reason_label}</label>
            <input id="tf-note" className="input" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} maxLength={300} />
          </div>
        )}
        <div className="field">
          <label>{t.task_labels_label} <span className="muted">({t.optional})</span></label>
          <div className="chip-row" role="group">
            {labels.map((l) => (
              <button
                key={l.id} type="button"
                className={`chip ${labelIds.includes(l.id) ? "active" : ""}`}
                aria-pressed={labelIds.includes(l.id)}
                onClick={() => setLabelIds((prev) => prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id])}
              >
                {l.name}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="tf-desc">{t.task_desc_label} <span className="muted">({t.optional})</span></label>
          <textarea id="tf-desc" className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
        </div>
        {!editing && templates.length > 0 && (
          <div className="field">
            <label htmlFor="tf-tpl">{t.templates_title} <span className="muted">({t.optional})</span></label>
            <select id="tf-tpl" className="select" value={useTemplate} onChange={(e) => setUseTemplate(e.target.value)}>
              <option value="">{t.none}</option>
              {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
            </select>
          </div>
        )}
        <div className="row wrap mt-16" style={{ paddingBottom: "12px" }}>
          <button type="submit" className="btn btn-primary">{t.task_save}</button>
          <button type="button" className="btn btn-secondary" onClick={() => nav(-1)}>{t.cancel}</button>
        </div>
      </form>

      {showWorkload && ownerId && (() => {
        const person = people.find((p) => p.id === ownerId)!;
        const wl = workloadFor(person, tasks, useApp().today);
        return (
          <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowWorkload(false); }}>
            <div className="modal-panel" role="dialog" aria-modal="true" aria-label={`${t.workload_title} — ${person.name}`}>
              <div className="modal-head">
                <h2>{t.workload_title} — {person.name}</h2>
                <button className="icon-btn" onClick={() => setShowWorkload(false)} aria-label={t.close}>✕</button>
              </div>
              <p className="small muted mb-12">{t.workload_hint}</p>
              <ul className="stack small">
                <li className="row-between"><span>{t.workload_due_week}</span><strong>{wl.unfinishedDueThisWeek}</strong></li>
                <li className="row-between"><span>{t.workload_overdue}</span><strong>{wl.overdueCount}</strong></li>
                <li className="row-between"><span>{t.workload_blocked}</span><strong>{wl.blockedCount}</strong></li>
              </ul>
              {wl.taskIds.length > 0 && (
                <>
                  <h4 className="mt-16 mb-8">{t.workload_open_before_assign}</h4>
                  <ul className="stack">
                    {wl.taskIds.map((id) => tasks.find((x) => x.id === id)).filter(Boolean).slice(0, 8).map((x) => (
                      <li key={x!.id} className="task-row" onClick={() => { setShowWorkload(false); nav(`/tasks/${x!.id}`); }}>
                        <span className="task-main">
                          <span className="task-title">{x!.title}</span>
                          <span className="task-meta">{x!.dueDate ?? t.none}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
