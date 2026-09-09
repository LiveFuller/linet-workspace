// Today: actionable home screen. Not a KPI wall.
// Persona-aware: lead sees delivery risks, Oliver sees his work + IT follow-ups,
// member sees own work first, viewer sees shared read-only info.
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, Clock3, GraduationCap, LifeBuoy, PlusCircle } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { TaskRow } from "@/components/TaskRow";
import { EmptyState, SkeletonStack } from "@/components/primitives";
import {
  filterTasks, isOverdue, nextMeeting, sortTasksByDue,
} from "@/domain/selectors";
import { formatDateOnly, formatInstant } from "@/lib/dates";

export default function TodayPage() {
  const app = useApp();
  const { snapshot, persona, t, today, prefs, repo, refresh } = app;
  const { toast } = useToast();
  const nav = useNavigate();
  if (!snapshot || !persona) return <div className="page page-narrow"><SkeletonStack count={3} /></div>;

  const { tasks, events, meetings, people, supportTickets, modules, trainingProgress, reports } = snapshot;
  const project = snapshot.projects[0];

  const myTasks = sortTasksByDue(filterTasks(tasks, { view: "my" }, persona.id, today));
  const dueToday = myTasks.filter((x) => x.dueDate === today);
  const overdue = sortTasksByDue(tasks.filter((x) => isOverdue(x, today) && x.ownerId === persona.id));
  const overdueAll = sortTasksByDue(tasks.filter((x) => isOverdue(x, today)));
  const waiting = myTasks.filter((x) => x.status === "waiting" || x.status === "blocked");
  const unassigned = tasks.filter((x) => x.ownerId === null && x.status !== "done" && x.lifecycle === "active");
  const blockedAll = tasks.filter((x) => x.status === "blocked" && x.lifecycle === "active");
  const next = nextMeeting(events, meetings, new Date().toISOString());
  const myProgress = trainingProgress.filter((p) => p.personId === persona.id);
  const inProgressModule = modules.find(
    (m) => myProgress.find((p) => p.moduleId === m.id && p.state === "in_progress")
  ) ?? modules.find((m) => !myProgress.find((p) => p.moduleId === m.id));
  const myOpenRequest = supportTickets.find(
    (s) => s.requesterId === persona.id && s.status !== "resolved"
  );
  const myCoordQueue = persona.role === "it_coordinator" || persona.role === "workspace_admin"
    ? supportTickets.filter((s) => s.status !== "resolved")
    : [];
  const isLead = persona.role === "project_lead" || persona.role === "workspace_admin";
  const latestReport = [...reports].sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1))[0];
  const inProgressTasks = sortTasksByDue(myTasks.filter((x) => x.status === "in_progress"));

  const open = (id: string) => nav(`/tasks/${id}`);
  const complete = async (task: typeof tasks[number]) => {
    const res = await repo!.completeTask(task.id, persona.id);
    if (res.ok) {
      toast(t.task_completed, {
        label: t.task_undo,
        run: async () => {
          await repo!.reopenTask(task.id, persona.id);
          refresh();
        },
      });
      refresh();
    }
  };

  // hero greeting — time aware, brand-soft, shows project + date + persona badge
  const displayHour = (() => {
    try {
      const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: prefs.displayTz, hour: "2-digit", hour12: false });
      return Number(fmt.format(new Date()));
    } catch {
      return new Date().getHours();
    }
  })();
  let heroGreeting: string;
  if (prefs.locale === "cs") {
    if (displayHour < 12) heroGreeting = `Dobré ráno, ${persona.name}`;
    else if (displayHour < 18) heroGreeting = `Dobré odpoledne, ${persona.name}`;
    else heroGreeting = `Dobrý večer, ${persona.name}`;
  } else {
    if (displayHour < 12) heroGreeting = `Good morning, ${persona.name}`;
    else if (displayHour < 18) heroGreeting = `Good afternoon, ${persona.name}`;
    else heroGreeting = `Good evening, ${persona.name}`;
  }
  const formattedToday = formatDateOnly(today, prefs.locale);
  const projectName = project ? (prefs.locale === "cs" ? project.name : project.nameEn) : "";
  const personaBadgeLabel = persona.role === "project_lead"
    ? t.persona_lead
    : persona.role === "it_coordinator"
      ? t.persona_oliver
      : persona.role === "viewer"
        ? t.persona_viewer
        : t.persona_member;

  return (
    <div className="page page-narrow">
      {/* Hero greeting card */}
      <section
        className="card"
        aria-labelledby="hero-greeting"
        style={{ background: "var(--brand-soft)", borderColor: "var(--brand-soft-strong)", padding: 20, marginBottom: 16 }}
      >
        <div className="row-between wrap" style={{ alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0, flex: "1 1 220px" }}>
            <h1 id="hero-greeting" className="page-title" style={{ margin: 0, lineHeight: 1.2 }}>{heroGreeting}</h1>
            <p className="small muted" style={{ marginTop: 6, lineHeight: 1.5 }}>
              {projectName}{projectName ? " · " : ""}{formattedToday}
            </p>
          </div>
          <span
            className="status-pill"
            style={{
              flexShrink: 0,
              background: "var(--surface)",
              color: "var(--brand-ink)",
              borderColor: "var(--brand-soft-strong)",
              fontSize: 12,
              fontWeight: 750,
              padding: "6px 12px",
            }}
            aria-label={personaBadgeLabel}
          >
            {personaBadgeLabel} · {persona.name}
          </span>
        </div>
      </section>

      <div className="row wrap" style={{ marginBottom: 14 }}>
        <Link className="btn btn-primary" to="/tasks/new">
          <PlusCircle size={18} aria-hidden /> {t.today_add_task}
        </Link>
      </div>

      {/* Lead emphasis: overdue delivery, blocked, unassigned, decisions */}
      {isLead && (
        <section className="section-block" aria-labelledby="h-lead">
          <div className="section-head"><h3 id="h-lead">{t.today_lead_attention}</h3></div>
          <div className="chip-row" role="list">
            <Link role="listitem" className="chip" to="/tasks?view=overdue">
              <AlertTriangle size={14} aria-hidden /> {t.today_overdue}: {overdueAll.length}
            </Link>
            <Link role="listitem" className="chip" to="/tasks?view=waiting">
              {t.today_blocked_items}: {blockedAll.length}
            </Link>
            <Link role="listitem" className="chip" to="/tasks?view=unassigned">
              {t.today_unassigned}: {unassigned.length}
            </Link>
          </div>
        </section>
      )}

      {/* Coordinator emphasis: authorized IT follow-ups */}
      {myCoordQueue.length > 0 && (
        <section className="section-block" aria-labelledby="h-coord">
          <div className="section-head">
            <h3 id="h-coord">{t.support_queue}</h3>
            {myCoordQueue.length > 0 && <span className="count-chip">{myCoordQueue.length}</span>}
            <Link to="/support" className="btn btn-ghost btn-sm">{t.today_view_all}</Link>
          </div>
          <ul className="stack">
            {myCoordQueue.slice(0, 3).map((s) => (
              <li key={s.id}>
                <Link to={`/support/${s.id}`} className="card card-interactive row-between" style={{ textDecoration: "none", color: "inherit" }}>
                  <span className="small" style={{ fontWeight: 600 }}>{s.title}</span>
                  <span className="status-pill st-waiting">{t.support_status[s.status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section-block" aria-labelledby="h-focus">
        <div className="section-head">
          <h3 id="h-focus">{t.today_focus}</h3>
          {myTasks.length > 0 && <span className="count-chip">{myTasks.length}</span>}
          {myTasks.length > 0 && <Link to="/tasks?view=my" className="btn btn-ghost btn-sm">{t.today_view_all}</Link>}
        </div>
        {myTasks.length === 0 ? (
          <EmptyState title={t.today_empty} />
        ) : (
          <ul className="stack">
            {myTasks.slice(0, 5).map((task) => (
              <TaskRow
                key={task.id} task={task} people={people} locale={prefs.locale}
                today={today} onOpen={open} onComplete={complete}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Continue where you left off — in_progress */}
      {inProgressTasks.length > 0 && (
        <section className="section-block" aria-labelledby="h-continue">
          <div className="section-head">
            <h3 id="h-continue">{prefs.locale === "cs" ? "Pokračujte, kde jste skončili" : "Continue where you left off"}</h3>
            <span className="count-chip">{inProgressTasks.length}</span>
            <Link to="/tasks?status=in_progress" className="btn btn-ghost btn-sm">{t.today_view_all}</Link>
          </div>
          <ul className="stack">
            {inProgressTasks.slice(0, 3).map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                people={people}
                locale={prefs.locale}
                today={today}
                onOpen={open}
                onComplete={complete}
              />
            ))}
          </ul>
        </section>
      )}

      <div className="detail-grid section-block">
        <section aria-labelledby="h-duetoday" className="card">
          <div className="section-head">
            <h3 id="h-duetoday">{t.today_due_today}</h3>
            {dueToday.length > 0 && <span className="count-chip">{dueToday.length}</span>}
          </div>
          {dueToday.length === 0
            ? <EmptyState title={t.today_empty} icon={<Clock3 size={20} aria-hidden />} />
            : <ul className="stack">{dueToday.slice(0, 3).map((x) => (
              <li key={x.id}><TaskRow task={x} people={people} locale={prefs.locale} today={today} onOpen={open} onComplete={complete} /></li>
            ))}</ul>}
        </section>
        <section aria-labelledby="h-overdue" className="card">
          <div className="section-head">
            <h3 id="h-overdue">{t.today_overdue}</h3>
            {overdue.length > 0 && <span className="count-chip">{overdue.length}</span>}
          </div>
          {overdue.length === 0
            ? <EmptyState title={t.today_empty_overdue} icon={<AlertTriangle size={20} aria-hidden />} />
            : <ul className="stack">{overdue.slice(0, 3).map((x) => (
              <li key={x.id}><TaskRow task={x} people={people} locale={prefs.locale} today={today} onOpen={open} onComplete={complete} /></li>
            ))}</ul>}
        </section>
      </div>

      <section className="section-block" aria-labelledby="h-waiting">
        <div className="section-head">
          <h3 id="h-waiting">{t.today_waiting}</h3>
          {waiting.length > 0 && <span className="count-chip">{waiting.length}</span>}
          {waiting.length > 0 && <Link to="/tasks?view=waiting" className="btn btn-ghost btn-sm">{t.today_view_all}</Link>}
        </div>
        {waiting.length === 0
          ? <EmptyState title={t.today_empty_waiting} icon={<Clock3 size={20} aria-hidden />} />
          : <ul className="stack">{waiting.slice(0, 3).map((x) => (
            <li key={x.id}><TaskRow task={x} people={people} locale={prefs.locale} today={today} onOpen={open} onComplete={complete} /></li>
          ))}</ul>}
      </section>

      {next && (
        <section className="section-block" aria-labelledby="h-next">
          <div className="section-head">
            <h3 id="h-next">{t.today_next_meeting}</h3>
          </div>
          <Link
            to={`/meetings/${next.meeting.id}`}
            className="card card-interactive row-between"
            style={{ textDecoration: "none", color: "inherit", gap: 12 }}
          >
            <div style={{ minWidth: 0 }}>
              <strong className="small" style={{ fontWeight: 700, display: "block" }}>{next.meeting.title}</strong>
              <span className="xsmall muted" style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                <CalendarClock size={14} aria-hidden />
                {formatInstant(next.event.start, prefs.locale, prefs.displayTz)} · {next.meeting.durationMin} min
                {next.event.location ? <> · {next.event.location}</> : null}
              </span>
            </div>
            <span
              aria-hidden
              style={{
                width: 36, height: 36, borderRadius: 9999, flexShrink: 0,
                background: "var(--surface)", border: "1px solid var(--border)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: "var(--ink)",
              }}
            >
              <ArrowRight size={16} />
            </span>
          </Link>
        </section>
      )}

      <div className="detail-grid section-block">
        {inProgressModule && (
          <section className="card card-interactive" aria-labelledby="h-learn">
            <div className="section-head"><h3 id="h-learn">{t.today_continue_learning}</h3></div>
            <Link to={`/learning/${inProgressModule.slug}`} className="row" style={{ textDecoration: "none", color: "inherit" }}>
              <GraduationCap size={18} aria-hidden />
              <span className="small" style={{ fontWeight: 600 }}>{prefs.locale === "cs" ? inProgressModule.title : inProgressModule.titleEn}</span>
              <span className="xsmall muted">{t.learning_minutes(inProgressModule.estimatedMinutes)}</span>
            </Link>
          </section>
        )}
        {myOpenRequest && (
          <section className="card card-interactive" aria-labelledby="h-req">
            <div className="section-head"><h3 id="h-req">{t.today_open_request}</h3></div>
            <Link to={`/support/${myOpenRequest.id}`} className="row" style={{ textDecoration: "none", color: "inherit" }}>
              <LifeBuoy size={18} aria-hidden />
              <span className="small" style={{ fontWeight: 600 }}>{myOpenRequest.title}</span>
              <span className="status-pill st-waiting">{t.support_status[myOpenRequest.status]}</span>
            </Link>
          </section>
        )}
      </div>

      {isLead && latestReport && (
        <section className="section-block card card-interactive" aria-labelledby="h-report">
          <div className="section-head"><h3 id="h-report">{t.project_latest_report}</h3></div>
          <Link to={`/reports/${latestReport.id}`} className="row" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="small" style={{ fontWeight: 600 }}>
              {latestReport.kind === "daily" ? t.report_kind_daily : t.report_kind_weekly}
              {" · "}{latestReport.periodStart}
            </span>
            <span className={`status-pill ${latestReport.status === "published" ? "st-done" : "st-todo"}`}>
              {latestReport.status === "published" ? t.report_published : t.report_draft}
            </span>
          </Link>
        </section>
      )}
    </div>
  );
}
