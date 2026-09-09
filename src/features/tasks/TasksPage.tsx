// Shared task list with views (My/All/week/overdue/waiting/unassigned/completed),
// filters (owner/workstream/label/status), search, sorting, and workload indicator.
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Filter, PlusCircle, X } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { TaskRow } from "@/components/TaskRow";
import { EmptyState, SkeletonStack } from "@/components/primitives";
import { Modal } from "@/components/Modal";
import { filterTasks, sortTasksByDue, sortTasksByUpdated, workloadFor, type TaskFilter } from "@/domain/selectors";

type View = TaskFilter["view"];

const STATUS_LABELS = (t: Record<string, string>): Record<string, string> => ({
  todo: t.status_todo,
  in_progress: t.status_in_progress,
  waiting: t.status_waiting,
  blocked: t.status_blocked,
  done: t.status_done,
});

export default function TasksPage() {
  const { snapshot, persona, t, today, prefs, repo, refresh } = useApp();
  const { toast } = useToast();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const [showWorkload, setShowWorkload] = useState<string | null>(null);

  const view = (params.get("view") as View) ?? "my";
  const fOwner = params.get("owner");
  const fWs = params.get("ws");
  const fLabel = params.get("label");
  const fStatus = params.get("status");
  const sort = params.get("sort") ?? "due";

  // keep local query in sync if URL changes externally (back/forward)
  useEffect(() => {
    const q = params.get("q") ?? "";
    setQuery((prev) => (prev !== q ? q : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get("q")]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  if (!snapshot || !persona) return <div className="page"><SkeletonStack count={5} /></div>;
  const { tasks, people, workstreams, labels } = snapshot;

  const filter: TaskFilter = {
    view,
    ownerId: fOwner === null || fOwner === "" ? undefined : fOwner,
    workstreamId: fWs || undefined,
    labelId: fLabel || undefined,
    status: (fStatus as TaskFilter["status"]) || undefined,
    query: query || undefined,
  };
  const visible = sort === "updated"
    ? sortTasksByUpdated(filterTasks(tasks, filter, persona.id, today))
    : sortTasksByDue(filterTasks(tasks, filter, persona.id, today));

  const statusLabels = STATUS_LABELS(t as unknown as Record<string, string>);
  const activeFilterChips: { label: string; clear: () => void }[] = [];
  if (fOwner) activeFilterChips.push({ label: `${t.filter_owner}: ${people.find((p) => p.id === fOwner)?.name ?? ""}`, clear: () => setParam("owner", null) });
  if (fWs) activeFilterChips.push({ label: `${t.filter_workstream}: ${workstreams.find((w) => w.id === fWs)?.name ?? ""}`, clear: () => setParam("ws", null) });
  if (fLabel) activeFilterChips.push({ label: `${t.filter_label}: ${labels.find((l) => l.id === fLabel)?.name ?? ""}`, clear: () => setParam("label", null) });
  if (fStatus) {
    activeFilterChips.push({ label: `${t.filter_status}: ${statusLabels[fStatus] ?? fStatus}`, clear: () => setParam("status", null) });
  }

  const views: { key: View; label: string }[] = [
    { key: "my", label: t.tasks_view_my },
    { key: "all", label: t.tasks_view_all },
    { key: "week", label: t.tasks_view_week },
    { key: "overdue", label: t.tasks_view_overdue },
    { key: "waiting", label: t.tasks_view_waiting },
    { key: "unassigned", label: t.tasks_view_unassigned },
    { key: "completed", label: t.tasks_view_completed },
  ];

  const complete = async (task: typeof tasks[number]) => {
    const res = await repo!.completeTask(task.id, persona.id);
    if (res.ok) {
      toast(t.task_completed, {
        label: t.task_undo,
        run: async () => { await repo!.reopenTask(task.id, persona.id); refresh(); },
      });
      refresh();
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setParam("q", value ? value : null);
  };

  return (
    <div className="page">
      <div className="row-between mb-8">
        <h1 className="page-title">{t.tasks_title}</h1>
        <button className="btn btn-primary btn-sm" onClick={() => nav("/tasks/new")}>
          <PlusCircle size={16} aria-hidden /> {t.task_new}
        </button>
      </div>

      {/* segmented with overflow-x scroll + fade hint via inline style */}
      <div
        className="segmented"
        role="tablist"
        aria-label={t.tasks_title}
        style={{
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          flexWrap: "nowrap",
          position: "relative",
          maskImage: "linear-gradient(to right, black 88%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, black 88%, transparent 100%)",
        } as React.CSSProperties}
      >
        {views.map((v) => (
          <button
            key={v.key}
            role="tab"
            aria-selected={view === v.key}
            className={view === v.key ? "active" : ""}
            onClick={() => setParam("view", v.key === "my" ? "" : (v.key as string))}
            style={{ flex: "0 0 auto" }}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="row mt-12 wrap" style={{ gap: 8 }}>
        <div className="row" style={{ flex: 1, minWidth: 180, maxWidth: 360, position: "relative" }}>
          <input
            className="input grow"
            style={{ maxWidth: "100%", paddingRight: query ? 40 : undefined }}
            placeholder={t.filter_search}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            aria-label={t.filter_search}
          />
          {query && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => handleQueryChange("")}
              aria-label={prefs.locale === "cs" ? "Vymazat hledání" : "Clear search"}
              style={{
                position: "absolute",
                right: 4,
                top: "50%",
                transform: "translateY(-50%)",
                minHeight: 32,
                padding: "4px 8px",
                minWidth: 32,
              }}
            >
              <X size={14} aria-hidden /> <span className="visually-hidden">×</span>
            </button>
          )}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowFilters(true)}>
          <Filter size={16} aria-hidden /> {t.filters}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setParam("sort", sort === "due" ? "updated" : "due")}
          aria-label={t.sort_by}
        >
          {sort === "due" ? t.sort_due : t.sort_updated}
        </button>
      </div>

      {activeFilterChips.length > 0 && (
        <div className="row wrap mt-8" aria-label={t.active_filters}>
          {activeFilterChips.map((c, i) => (
            <button key={i} className="chip active" onClick={c.clear} aria-label="Odstranit filtr">{c.label} ✕</button>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            {t.filters_clear}
          </button>
        </div>
      )}

      <section className="section-block">
        {visible.length === 0 ? (
          <EmptyState title={t.today_empty} body={t.search_empty} />
        ) : (
          <ul className="stack">
            {visible.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                people={people}
                locale={prefs.locale}
                today={today}
                onOpen={(id) => nav(`/tasks/${id}`)}
                onComplete={persona.role !== "viewer" ? complete : undefined}
                done={task.status === "done"}
              />
            ))}
          </ul>
        )}
      </section>

      {showFilters && (
        <Modal title={t.filters} onClose={() => setShowFilters(false)}>
          <div className="field">
            <label htmlFor="f-owner">{t.filter_owner}</label>
            <select id="f-owner" className="select" value={fOwner ?? ""} onChange={(e) => setParam("owner", e.target.value || null)}>
              <option value="">{t.none}</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-ws">{t.filter_workstream}</label>
            <select id="f-ws" className="select" value={fWs ?? ""} onChange={(e) => setParam("ws", e.target.value || null)}>
              <option value="">{t.none}</option>
              {workstreams.map((w) => <option key={w.id} value={w.id}>{prefs.locale === "cs" ? w.name : w.nameEn}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-label">{t.filter_label}</label>
            <select id="f-label" className="select" value={fLabel ?? ""} onChange={(e) => setParam("label", e.target.value || null)}>
              <option value="">{t.none}</option>
              {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-status">{t.filter_status}</label>
            <select id="f-status" className="select" value={fStatus ?? ""} onChange={(e) => setParam("status", e.target.value || null)}>
              <option value="">{t.none}</option>
              <option value="todo">{t.status_todo}</option>
              <option value="in_progress">{t.status_in_progress}</option>
              <option value="waiting">{t.status_waiting}</option>
              <option value="blocked">{t.status_blocked}</option>
              <option value="done">{t.status_done}</option>
            </select>
          </div>
          <button className="btn btn-secondary btn-block" onClick={() => { setParams(new URLSearchParams(), { replace: true }); }}>
            {t.filters_clear}
          </button>
        </Modal>
      )}

      {/* Workload sheet: before assigning work, show proposed owner's open items */}
      {showWorkload && (() => {
        const person = people.find((p) => p.id === showWorkload)!;
        const wl = workloadFor(person, tasks, today);
        return (
          <Modal title={`${t.workload_title} — ${person.name}`} onClose={() => setShowWorkload(null)}>
            <p className="small muted mb-12">{t.workload_hint}</p>
            <ul className="stack small">
              <li className="row-between"><span>{t.workload_due_week}</span><strong>{wl.unfinishedDueThisWeek}</strong></li>
              <li className="row-between"><span>{t.workload_overdue}</span><strong>{wl.overdueCount}</strong></li>
              <li className="row-between"><span>{t.workload_blocked}</span><strong>{wl.blockedCount}</strong></li>
            </ul>
            <h4 className="mt-16 mb-8">{t.workload_open_before_assign}</h4>
            <ul className="stack">
              {wl.taskIds.map((id) => tasks.find((x) => x.id === id)).filter(Boolean).slice(0, 8).map((x) => (
                <li key={x!.id}>
                  <button
                    className="task-row"
                    style={{ width: "100%", textAlign: "left" }}
                    onClick={() => { setShowWorkload(null); nav(`/tasks/${x!.id}`); }}
                  >
                    <span className="task-main">
                      <span className="task-title">{x!.title}</span>
                      <span className="task-meta">
                        {x!.dueDate ?? t.none} · {statusLabels[x!.status] ?? x!.status}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Modal>
        );
      })()}
    </div>
  );
}
