// Task detail: full lifecycle in one screen. Mobile-first; desktop side-panel layout
// achieved via narrow max-width. Includes provenance (source), checklist, comments, history.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, Check, Copy, MessageSquare, PlusCircle, Trash2, Undo2 } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { StatusPill } from "@/components/TaskRow";
import { EmptyState } from "@/components/primitives";
import { Modal } from "@/components/Modal";
import { canUpdateTask } from "@/domain/permissions";
import { formatInstant, formatDateOnly } from "@/lib/dates";

export default function TaskDetailPage() {
  const { snapshot, persona, t, today, prefs, repo, refresh } = useApp();
  const { toast } = useToast();
  const nav = useNavigate();
  const { taskId } = useParams();
  const [newChecklist, setNewChecklist] = useState("");
  const [newComment, setNewComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!snapshot || !persona || !taskId) return <div className="page"><EmptyState title={t.loading} /></div>;

  const task = snapshot.tasks.find((x) => x.id === taskId);
  if (!task) {    return (
      <div className="page page-narrow">
        <EmptyState title={t.not_found_title} body={t.not_found_object} />
        <Link className="btn btn-secondary mt-12" to="/tasks">{t.nav_tasks}</Link>
      </div>
    );
  }

  const { people, workstreams, labels, checklistItems, comments, activity, meetings, inbox } = snapshot;
  const owner = people.find((p) => p.id === task.ownerId);
  const ws = workstreams.find((w) => w.id === task.workstreamId);
  const taskLabels = labels.filter((l) => task.labelIds.includes(l.id));
  const items = checklistItems.filter((c) => c.taskId === task.id).sort((a, b) => a.position - b.position);
  const taskComments = comments.filter((c) => c.taskId === task.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const history = activity.filter((a) => a.taskId === task.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const sourceMeeting = meetings.find((m) =>
    snapshot.proposals.some((p) => p.meetingId === m.id && p.createdTaskId === task.id)
  );
  const linkedInbox = inbox.find((i) => i.createdTaskId === task.id);
  const editable = canUpdateTask(persona, task, task.projectId);
  const isDone = task.status === "done";

  const complete = async () => {
    const res = await repo!.completeTask(task.id, persona.id);
    if (res.ok) {
      toast(t.task_completed, {
        label: t.task_undo,
        run: async () => { await repo!.reopenTask(task.id, persona.id); refresh(); },
      });
      refresh();
    }
  };
  const reopen = async () => {
    const res = await repo!.reopenTask(task.id, persona.id);
    if (res.ok) { toast(t.task_reopened); refresh(); }
  };

  return (
    <div className="page page-narrow">
      <div className="row-between mb-8">
        <button className="btn btn-ghost btn-sm" onClick={() => nav(-1)} aria-label={t.back}>← {t.back}</button>
        <div className="row">
          {editable && (
            <Link className="btn btn-secondary btn-sm" to={`/tasks/${task.id}/edit`}>{t.task_edit}</Link>
          )}
        </div>
      </div>

      <div className="card">
        <div className="row-between">
          <h1 style={{ fontSize: 21 }}>{task.title}</h1>
          <StatusPill status={task.status} locale={prefs.locale} />
        </div>
        {task.description && <p className="mt-8" style={{ whiteSpace: "pre-wrap" }}>{task.description}</p>}
        <dl className="detail-grid mt-12 kv">
          <div><dt>{t.task_owner_label}</dt><dd>{owner?.name ?? t.task_owner_unassigned}</dd></div>
          <div><dt>{t.task_due_label}</dt>
            <dd>
              {task.dueDate ? formatDateOnly(task.dueDate, prefs.locale) : t.none}
              {task.dueDate && !isDone && task.dueDate < today && (
                <span className="status-pill st-blocked" style={{ marginLeft: 8 }}>{t.tasks_view_overdue}</span>
              )}
            </dd>
          </div>
          <div><dt>{t.task_workstream_label}</dt><dd>{ws ? (prefs.locale === "cs" ? ws.name : ws.nameEn) : t.none}</dd></div>
          <div><dt>{t.task_labels_label}</dt>
            <dd>{taskLabels.length ? taskLabels.map((l) => l.name).join(", ") : t.none}</dd>
          </div>
          <div><dt>{t.task_source}</dt>
            <dd>
              {task.source === "meeting_action" && t.task_source_meeting}
              {task.source === "email_capture" && t.task_source_email}
              {task.source === "manual" && t.task_source_manual}
              {task.source === "quick_capture" && t.task_source_quick}
              {task.source === "template" && t.task_source_template}
              {sourceMeeting && (
                <> · <Link to={`/meetings/${sourceMeeting.id}`}>{sourceMeeting.title}</Link></>
              )}
              {linkedInbox && <> · <Link to="/inbox">{t.nav_inbox}</Link></>}
            </dd>
          </div>
          <div><dt>{t.task_status_label}</dt>
            <dd>{task.statusNote ? `${task.statusNote}` : ""}</dd>
          </div>
        </dl>

        <div className="row wrap mt-16">
          {!isDone ? (
            <button className="btn btn-success" onClick={complete}>
              <Check size={18} aria-hidden /> {t.task_complete}
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={reopen}>
              <Undo2 size={18} aria-hidden /> {t.task_reopen}
            </button>
          )}
          {editable && (
            <button
              className="btn btn-secondary"
              onClick={async () => {
                const res = await repo!.duplicateTask(task.id, persona.id);
                if (res.ok) { toast(t.saved); refresh(); nav(`/tasks/${res.data.id}`); }
              }}
            >
              <Copy size={16} aria-hidden /> {t.task_duplicate}
            </button>
          )}
          {editable && task.lifecycle === "active" && (
            <button
              className="btn btn-secondary"
              onClick={async () => { await repo!.archiveTask(task.id, persona.id); toast(t.task_archived); refresh(); nav("/tasks"); }}
            >
              <Archive size={16} aria-hidden /> {t.task_archive}
            </button>
          )}
          {task.lifecycle === "archived" && (
            <button
              className="btn btn-secondary"
              onClick={async () => { await repo!.restoreTask(task.id, persona.id); toast(t.saved); refresh(); }}
            >
              <ArchiveRestore size={16} aria-hidden /> {t.task_restore}
            </button>
          )}
          {persona.role === "workspace_admin" && (
            <button className="btn btn-danger-soft" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={16} aria-hidden /> {t.task_delete}
            </button>
          )}
        </div>
        {task.completedAt && (
          <p className="xsmall muted mt-12">
            {t.status_done}: {formatInstant(task.completedAt, prefs.locale, prefs.displayTz)}
            {(() => { const c = people.find((p) => p.id === task.completedBy); return c ? ` · ${c.name}` : ""; })()}
          </p>
        )}
      </div>

      {/* Checklist */}
      <section className="section-block" aria-labelledby="h-check">
        <div className="section-head"><h3 id="h-check">{t.task_checklist}</h3></div>
        <ul className="stack">
          {items.map((it) => (
            <li key={it.id} className="task-row">
              <button
                className="task-check"
                style={it.done ? { background: "var(--success)", borderColor: "var(--success)", color: "#fff" } : undefined}
                aria-label={it.title}
                disabled={!editable}
                onClick={async () => {
                  await repo!.setChecklistItemDone(it.id, !it.done, persona.id);
                  refresh();
                }}
              >
                {it.done && <Check size={14} aria-hidden />}
              </button>
              <span className="task-main">
                <span className="task-title" style={{ fontSize: 14, textDecoration: it.done ? "line-through" : "none" }}>{it.title}</span>
              </span>
              {editable && (
                <button
                  className="icon-btn" style={{ width: 44, height: 44, minWidth: 44, minHeight: 44 }} aria-label={t.delete}
                  onClick={async () => { if (!window.confirm(`${t.delete} — ${it.title}?`)) return; await repo!.removeChecklistItem(it.id, persona.id); refresh(); }}
                >✕</button>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <form
            className="row mt-8"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newChecklist.trim()) return;
              await repo!.addChecklistItem(task.id, newChecklist.trim(), persona.id);
              setNewChecklist("");
              refresh();
            }}
          >
            <input
              className="input grow" placeholder={t.task_add_checklist} value={newChecklist}
              onChange={(e) => setNewChecklist(e.target.value)} aria-label={t.task_add_checklist} maxLength={200}
            />
            <button className="btn btn-secondary btn-sm" type="submit"><PlusCircle size={16} aria-hidden /></button>
          </form>
        )}
      </section>

      {/* Comments */}
      <section className="section-block" aria-labelledby="h-comments">
        <div className="section-head"><h3 id="h-comments">{t.task_comments}</h3></div>
        {taskComments.length === 0 && <p className="small muted">{t.none}</p>}
        <ul className="stack">
          {taskComments.map((c) => {
            const author = people.find((p) => p.id === c.authorId);
            return (
              <li key={c.id} className="card" style={{ padding: 12 }}>
                <div className="row-between">
                  <strong className="small">{author?.name ?? "?"}</strong>
                  <span className="xsmall muted">{formatInstant(c.createdAt, prefs.locale, prefs.displayTz, false)}</span>
                </div>
                <p className="small mt-4" style={{ whiteSpace: "pre-wrap" }}>{c.body}</p>
              </li>
            );
          })}
        </ul>
        {persona.role !== "viewer" && (
          <form
            className="row mt-8"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newComment.trim()) return;
              await repo!.addComment(task.id, newComment.trim(), persona.id);
              setNewComment("");
              refresh();
            }}
          >
            <input
              className="input grow" placeholder={t.task_add_comment} value={newComment}
              onChange={(e) => setNewComment(e.target.value)} aria-label={t.task_add_comment} maxLength={2000}
            />
            <button className="btn btn-secondary btn-sm" type="submit"><MessageSquare size={16} aria-hidden /></button>
          </form>
        )}
      </section>

      {/* Activity */}
      <section className="section-block" aria-labelledby="h-activity">
        <div className="section-head"><h3 id="h-activity">{t.task_activity}</h3></div>
        <ul className="stack small">
          {history.map((h) => {
            const actor = people.find((p) => p.id === h.actorId);
            return (
              <li key={h.id} className="row" style={{ gap: 6 }}>
                <span className="xsmall muted" style={{ minWidth: 96 }}>{formatInstant(h.createdAt, prefs.locale, prefs.displayTz, false)}</span>
                <span>{h.summary}{actor ? ` (${actor.name})` : ""}</span>
              </li>
            );
          })}
          {history.length === 0 && <li className="muted">—</li>}
        </ul>
      </section>

      {confirmDelete && (
        <Modal title={t.task_delete} onClose={() => setConfirmDelete(false)}>
          <p className="small">{t.task_delete_confirm}</p>
          <div className="row mt-12">
            <button
              className="btn btn-danger"
              onClick={async () => {
                await repo!.deleteTask(task.id, persona.id);
                toast(t.task_deleted);
                refresh();
                nav("/tasks");
              }}
            >
              {t.task_delete}
            </button>
            <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>{t.cancel}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
