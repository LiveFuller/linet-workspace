// Task row: one-tap complete with Undo, 44px hit area, avatar, overdue distinct.
import { Check } from "lucide-react";
import type { Person, Task } from "@/domain/types";
import { isOverdue, isDueSoon } from "@/domain/selectors";
import { relativeDayLabel, formatDateOnly } from "@/lib/dates";
import { STRINGS } from "@/locales/strings";
import type { Locale } from "@/locales/strings";

const STATUS_CLASS: Record<Task["status"], string> = {
  todo: "st-todo", in_progress: "st-progress", waiting: "st-waiting",
  blocked: "st-blocked", done: "st-done",
};

export function StatusPill({ status, locale }: { status: Task["status"]; locale: Locale }) {
  const t = STRINGS[locale];
  const labels: Record<Task["status"], string> = {
    todo: t.status_todo, in_progress: t.status_in_progress, waiting: t.status_waiting,
    blocked: t.status_blocked, done: t.status_done,
  };
  return <span className={`status-pill ${STATUS_CLASS[status]}`}>{labels[status]}</span>;
}

function Avatar({ person }: { person: Person | undefined }) {
  if (!person) {
    return (
      <span style={{
        width: 22, height: 22, borderRadius: "50%",
        background: "var(--canvas-subtle)", border: "1px solid var(--border-ghost)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 750, color: "var(--text-tertiary)", flexShrink: 0,
      }} aria-hidden>?</span>
    );
  }
  return (
    <span style={{
      width: 22, height: 22, borderRadius: "50%",
      background: "var(--brand-soft)", color: "var(--brand-ink)",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: 10, fontWeight: 800, letterSpacing: "-0.02em", flexShrink: 0,
      border: "1px solid var(--brand-soft-strong)",
    }} aria-hidden>{person.initials}</span>
  );
}

export function TaskRow({
  task, people, locale, today, onOpen, onComplete, done = false,
}: {
  task: Task;
  people: Person[];
  locale: Locale;
  today: string;
  onOpen: (taskId: string) => void;
  onComplete?: (task: Task) => void;
  done?: boolean;
}) {
  const t = STRINGS[locale];
  const owner = people.find((p) => p.id === task.ownerId);
  const overdue = isOverdue(task, today);
  const dueSoon = !overdue && isDueSoon(task, today);
  const rel = task.dueDate ? relativeDayLabel(task.dueDate, today, locale) : "";

  return (
    <li className={`task-row ${done ? "done" : ""}`}>
      <button
        className="task-check"
        aria-label={done ? t.task_reopen : t.task_complete}
        onClick={(e) => {
          e.stopPropagation();
          onComplete?.(task);
        }}
        disabled={!onComplete}
      >
        {/* visual circle via ::before, check via svg */}
        {done && <Check size={15} aria-hidden />}
      </button>
      <button
        className="task-main"
        style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", display: "block", width: "100%" }}
        onClick={() => onOpen(task.id)}
        aria-label={task.title}
      >
        <span className="task-title" style={{ display: "block", lineHeight: 1.35 }}>{task.title}</span>
        <span className="task-meta" style={{ display: "flex", alignItems: "center" }}>
          <Avatar person={owner} />
          <span>{owner ? owner.name : t.task_owner_unassigned}</span>
          {task.dueDate && (
            <span className={overdue ? "overdue" : dueSoon ? "duesoon" : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                background: overdue ? "var(--danger)" : dueSoon ? "var(--warning)" : "var(--border-strong)",
                display: "inline-block",
              }} aria-hidden />
              {rel || formatDateOnly(task.dueDate, locale)}
            </span>
          )}
          <StatusPill status={task.status} locale={locale} />
        </span>
      </button>
    </li>
  );
}
