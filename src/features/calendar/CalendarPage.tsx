// Calendar: mobile agenda default; week/month views usable; task/event distinction;
// focus-block creation without changing task due date; ICS export; Prague/Port Moresby.
import { useMemo, useState } from "react";
import { CalendarDays, Clock, Download, Link2, PlusCircle, Trash2, Unlink } from "lucide-react";
import { useApp } from "@/app/AppProvider";
import { useToast } from "@/components/Toaster";
import { EmptyState, SkeletonStack } from "@/components/primitives";
import { Modal } from "@/components/Modal";
import { addDaysDateOnly, formatDateOnly, formatInstant, localInputToInstant, weekBounds } from "@/lib/dates";
import { downloadFile } from "@/lib/utils";
import type { CalendarEvent } from "@/domain/types";

type CalView = "agenda" | "week" | "month";

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export default function CalendarPage() {
  const { snapshot, persona, t, today, prefs, repo, refresh } = useApp();
  const { toast } = useToast();
  const [view, setView] = useState<CalView>("agenda");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  if (!snapshot || !persona) {
    return (
      <div className="page">
        <div className="skeleton skeleton-line" style={{ width: 160, height: 28, marginBottom: 16 }} aria-hidden />
        <SkeletonStack count={4} />
      </div>
    );
  }
  const { events } = snapshot;
  const canManage = persona.role !== "viewer";

  const wb = weekBounds(today);
  const agendaDays = useMemo(() => {
    const days: string[] = [];
    for (let i = -7; i < 21; i++) days.push(addDaysDateOnly(today, i));
    return days;
  }, [today]);

  const eventsForDay = (date: string) =>
    events
      .filter((e) => (e.dateMode === "date_only" ? e.start === date : e.start.slice(0, 10) === date))
      .sort((a, b) => (a.start < b.start ? -1 : 1));

  const exportIcs = () => {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LINET Workspace//CS//"];
    for (const e of events) {
      lines.push("BEGIN:VEVENT", `UID:${e.id}@linet-workspace.local`);
      if (e.dateMode === "date_only") {
        lines.push(`DTSTART;VALUE=DATE:${e.start.replace(/-/g, "")}`);
      } else {
        lines.push(`DTSTART:${e.start.replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`);
        if (e.durationMin) {
          const end = new Date(new Date(e.start).getTime() + e.durationMin * 60000);
          lines.push(`DTEND:${end.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`);
        }
      }
      // RFC5545: escape comma, semicolon, backslash, newline in TEXT values
      lines.push(`SUMMARY:${escapeIcsText(e.title)}`, "END:VEVENT");
    }
    lines.push("END:VCALENDAR");
    downloadFile("linet-workspace.ics", lines.join("\r\n"), "text/calendar");
    toast(t.saved);
  };

  const kindLabel = (k: CalendarEvent["kind"]) =>
    k === "meeting" ? t.calendar_kind_meeting : k === "focus_block" ? t.calendar_kind_focus : t.calendar_kind_deadline;

  return (
    <div className="page">
      <div className="row-between mb-8">
        <h1 className="page-title">{t.calendar_title}</h1>
        {canManage && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
            <PlusCircle size={16} aria-hidden /> {t.calendar_new_event}
          </button>
        )}
      </div>

      <div className="segmented mb-12" role="tablist">
        {(["agenda", "week", "month"] as CalView[]).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} className={view === v ? "active" : ""}
            onClick={() => setView(v)}>
            {v === "agenda" ? t.calendar_agenda : v === "week" ? t.calendar_week : t.calendar_month}
          </button>
        ))}
      </div>

      <div className="row wrap mb-12">
        <span className="xsmall muted">{t.settings_tz}: {prefs.displayTz}</span>
        <button className="btn btn-secondary btn-sm" onClick={exportIcs}>
          <Download size={15} aria-hidden /> {t.calendar_export_ics}
        </button>
      </div>
      <p className="xsmall muted mb-16">{t.calendar_ics_note}</p>

      {view === "agenda" && (
        <ul className="stack">
          {agendaDays.flatMap((date) => {
            const evs = eventsForDay(date);
            if (!evs.length) return [];
            return [
              <li key={date} className="section-block" aria-label={formatDateOnly(date, prefs.locale)}>
                <div className="section-head">
                  <h3>{date === today ? `${formatDateOnly(date, prefs.locale)} (${t.today})` : formatDateOnly(date, prefs.locale)}</h3>
                </div>
                <ul className="stack">
                  {evs.map((e) => (
                    <li key={e.id}>
                      <button
                        className="task-row"
                        style={{ cursor: canManage ? "pointer" : "default" }}
                        onClick={() => canManage && setEditing(e)}
                      >
                        <span className="task-check" style={{ borderRadius: 6, background: e.kind === "meeting" ? "var(--brand-soft)" : e.kind === "focus_block" ? "var(--success-soft)" : "var(--warning-soft)", border: "none", width: 22, height: 22 }}>
                          {e.kind === "meeting" ? <CalendarDays size={13} aria-hidden /> : e.kind === "focus_block" ? <Clock size={13} aria-hidden /> : <Link2 size={13} aria-hidden />}
                        </span>
                        <span className="task-main">
                          <span className="task-title">{e.title}</span>
                          <span className="task-meta">
                            {kindLabel(e.kind)}
                            {e.dateMode === "timed" && ` · ${formatInstant(e.start, prefs.locale, prefs.displayTz, false)}`}
                            {e.durationMin ? ` · ${e.durationMin} min` : ""}
                            {e.allDay ? ` · ${t.calendar_all_day}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>,
            ];
          })}
          {agendaDays.every((d) => eventsForDay(d).length === 0) && <li><EmptyState title={t.calendar_empty} /></li>}
        </ul>
      )}

      {view === "week" && (
        <div
          style={{
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 14px, black calc(100% - 14px), transparent)",
            maskImage: "linear-gradient(to right, transparent, black 14px, black calc(100% - 14px), transparent)",
            paddingBottom: 6,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(96px, 1fr))", gap: 8, minWidth: 672 }}>
            {Array.from({ length: 7 }, (_, i) => addDaysDateOnly(wb.start, i)).map((date) => (
              <div key={date} className="card" style={{ padding: 10, minHeight: 120 }}>
                <div className="xsmall" style={{ fontWeight: 700 }}>{formatDateOnly(date, prefs.locale)}</div>
                <ul className="stack mt-4">
                  {eventsForDay(date).map((e) => (
                    <li key={e.id}>
                      <button
                        className="xsmall card card-interactive"
                        style={{ cursor: canManage ? "pointer" : "default", width: "100%", textAlign: "left", padding: "8px 10px", minHeight: 44, display: "block" }}
                        onClick={() => canManage && setEditing(e)}
                      >
                        {e.title}
                      </button>
                    </li>
                  ))}
                  {eventsForDay(date).length === 0 && <li className="xsmall muted" style={{ padding: "6px 0" }}>{t.none}</li>}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "month" && <MonthGrid today={today} eventsForDay={eventsForDay} onPick={canManage ? setEditing : undefined} locale={prefs.locale} />}

      {showNew && (
        <EventForm
          onClose={() => setShowNew(false)}
          onSubmit={async (ev) => {
            const res = await repo!.createEvent(ev, persona.id);
            if (res.ok) { toast(t.calendar_event_saved); refresh(); setShowNew(false); }
          }}
        />
      )}
      {editing && (
        <EventForm
          event={editing}
          onClose={() => setEditing(null)}
          onSubmit={async (patch) => {
            const res = await repo!.updateEvent(editing.id, patch, persona.id);
            if (res.ok) { toast(t.calendar_event_saved); refresh(); setEditing(null); }
          }}
          onDelete={async () => {
            await repo!.deleteEvent(editing.id, persona.id);
            toast(t.calendar_event_deleted);
            refresh();
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MonthGrid({ today, eventsForDay, onPick, locale }: {
  today: string;
  eventsForDay: (d: string) => CalendarEvent[];
  onPick?: (e: CalendarEvent) => void;
  locale: string;
}) {
  const { t } = useApp();
  const wb = weekBounds(today);
  // six weeks grid starting from week start -7 days for context
  const start = addDaysDateOnly(wb.start, -14);
  const days: string[] = [];
  for (let i = 0; i < 42; i++) days.push(addDaysDateOnly(start, i));
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(64px, 1fr))", gap: 6, minWidth: 480 }}>
        {days.map((d) => {
          const evs = eventsForDay(d);
          const isToday = d === today;
          return (
            <div key={d} className="card" style={{
              padding: 6, minHeight: 88,
              borderColor: isToday ? "var(--brand)" : undefined,
              background: isToday ? "var(--brand-soft)" : undefined,
            }}>
              <div className="xsmall" style={{ fontWeight: 700 }}>{formatDateOnly(d, locale)}</div>
              <div className="stack mt-4" style={{ gap: 4 }}>
                {evs.slice(0, 3).map((e) => (
                  <button key={e.id} className="xsmall" style={{
                    display: "block", width: "100%", textAlign: "left", border: "1px solid var(--border-ghost)",
                    background: "var(--surface)", padding: "8px 6px", cursor: onPick ? "pointer" : "default",
                    color: e.kind === "deadline_marker" ? "var(--warning)" : "inherit",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    borderRadius: 8, minHeight: 44,
                  }} onClick={() => onPick?.(e)} title={e.title}>
                    • {e.title}
                  </button>
                ))}
                {evs.length > 3 && <div className="xsmall muted" style={{ paddingLeft: 6 }}>+{evs.length - 3}</div>}
                {evs.length === 0 && <div className="xsmall muted" style={{ minHeight: 44, display: "flex", alignItems: "center", paddingLeft: 4 }}>{t.none}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventForm({
  event, onClose, onSubmit, onDelete,
}: {
  event?: CalendarEvent;
  onClose: () => void;
  onSubmit: (input: { projectId: string; kind: CalendarEvent["kind"]; title: string; dateMode: CalendarEvent["dateMode"]; start: string; end: string | null; durationMin: number | null; allDay: boolean; timezone: string; linkedTaskId: string | null; location: string | null; meetingId: string | null }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const { snapshot, t, today, prefs } = useApp();
  const { tasks } = snapshot!;
  const [title, setTitle] = useState(event?.title ?? "");
  const [kind, setKind] = useState<CalendarEvent["kind"]>(event?.kind ?? "focus_block");
  const [date, setDate] = useState(event ? (event.dateMode === "date_only" ? event.start : event.start.slice(0, 10)) : today);
  const [time, setTime] = useState(event && event.dateMode === "timed" ? event.start.slice(11, 16) : "09:00");
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [duration, setDuration] = useState(String(event?.durationMin ?? 60));
  const [linkedTaskId, setLinkedTaskId] = useState(event?.linkedTaskId ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (!title.trim()) errs.push(t.validation_required_title);
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) errs.push(t.error_generic);
    setErrors(errs);
    if (errs.length) return;
    const input = {
      projectId: snapshot!.projects[0].id,
      kind, title: title.trim(),
      dateMode: allDay ? "date_only" as const : "timed" as const,
      start: allDay ? date : localInputToInstant(`${date}T${time}`, prefs.displayTz),
      end: null,
      durationMin: allDay ? null : Number(duration) || 60,
      allDay,
      timezone: prefs.displayTz,
      linkedTaskId: linkedTaskId || null,
      location: null,
      meetingId: null,
    };
    await onSubmit(input);
  };

  return (
    <>
      <Modal title={event ? t.calendar_edit : t.calendar_new_event} onClose={onClose}>
        {errors.length > 0 && <div className="banner banner-danger" role="alert"><ul className="small">{errors.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="ev-title">{t.task_title_label} *</label>
            <input id="ev-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
          </div>
          <div className="detail-grid">
            <div className="field">
              <label htmlFor="ev-kind">{t.calendar_kind_meeting} / {t.calendar_kind_focus}</label>
              <select id="ev-kind" className="select" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} disabled={Boolean(event)}>
                <option value="focus_block">{t.calendar_kind_focus}</option>
                <option value="meeting">{t.calendar_kind_meeting}</option>
                <option value="deadline_marker">{t.calendar_kind_deadline}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ev-date">{t.report_period_start}</label>
              <input id="ev-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          {!allDay && (
            <div className="detail-grid">
              <div className="field">
                <label htmlFor="ev-time">{t.calendar_time}</label>
                <input id="ev-time" className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ev-dur">{t.calendar_duration}</label>
                <input id="ev-dur" className="input" type="number" min={0} max={1440} value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
            </div>
          )}
          <div className="field">
            <label className="row" style={{ fontWeight: 400 }}>
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} style={{ width: 20, height: 20 }} />
              {t.calendar_all_day}
            </label>
            {allDay && <p className="hint">{t.calendar_all_day} — {t.calendar_ics_note}</p>}
          </div>
          <div className="field">
            <label htmlFor="ev-task">{t.calendar_link_task} <span className="muted">({t.optional})</span></label>
            <select id="ev-task" className="select" value={linkedTaskId} onChange={(e) => setLinkedTaskId(e.target.value)}>
              <option value="">{t.none}</option>
              {tasks.filter((x) => x.lifecycle === "active").map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
            </select>
            <p className="hint">{t.calendar_due_note}</p>
          </div>
          <div className="row wrap">
            <button className="btn btn-primary" type="submit">{t.save}</button>
            <button className="btn btn-secondary" type="button" onClick={onClose}>{t.cancel}</button>
            {onDelete && (
              <button className="btn btn-danger-soft" type="button" onClick={() => setConfirmOpen(true)}>
                <Trash2 size={15} aria-hidden /> {t.calendar_delete}
              </button>
            )}
          </div>
        </form>
      </Modal>
      {confirmOpen && onDelete && (
        <Modal title={t.confirm} onClose={() => setConfirmOpen(false)}>
          <p className="small">{t.calendar_delete} — {t.delete}? <br /><span className="muted">{event?.title}</span></p>
          <div className="row wrap mt-12">
            <button className="btn btn-danger" onClick={async () => { setConfirmOpen(false); await onDelete(); }}>
              <Trash2 size={15} aria-hidden /> {t.confirm}
            </button>
            <button className="btn btn-secondary" onClick={() => setConfirmOpen(false)}>{t.cancel}</button>
            <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)}><Unlink size={15} aria-hidden /> {t.close}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
