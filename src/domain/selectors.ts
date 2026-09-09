// Derived selectors. Counters are always derived from current records — never hardcoded.
// Overdue = unfinished task whose applicable deadline (date-only) has passed in the
// project timezone. Completed/cancelled/archived never count as active.
import type {
  CalendarEvent, Decision, Meeting, Person, Project, Report, SupportTicket, Task, UUID,
} from "./types";
import { dateOnlyDiffDays, parseDateOnly } from "@/lib/dates";

export interface TaskFilter {
  view?: "my" | "all" | "week" | "overdue" | "waiting" | "unassigned" | "completed";
  ownerId?: UUID | null;
  workstreamId?: UUID | null;
  labelId?: UUID | null;
  status?: Task["status"] | null;
  query?: string;
}

export interface Snapshot {
  tasks: Task[];
  events: CalendarEvent[];
  meetings: Meeting[];
  people: Person[];
  projects: Project[];
  decisions: Decision[];
  reports: Report[];
  supportTickets: SupportTicket[];
}

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeSearch(s: string): string {
  return stripDiacritics(s).toLowerCase().trim();
}

export function isOverdue(task: Task, today: string): boolean {
  if (task.status === "done" || task.lifecycle === "archived") return false;
  if (!task.dueDate) return false;
  const p = parseDateOnly(task.dueDate);
  if (!p) return false;
  return dateOnlyDiffDays(task.dueDate, today) < 0;
}

export function isDueOn(task: Task, date: string): boolean {
  if (task.status === "done" || task.lifecycle === "archived") return false;
  return task.dueDate === date;
}

export function isDueSoon(task: Task, today: string, withinDays = 3): boolean {
  if (task.status === "done" || task.lifecycle === "archived") return false;
  if (!task.dueDate) return false;
  const diff = dateOnlyDiffDays(task.dueDate, today);
  return diff >= 0 && diff <= withinDays;
}

export function isActive(task: Task): boolean {
  return task.lifecycle === "active" && task.status !== "done";
}

export function filterTasks(tasks: Task[], filter: TaskFilter, viewerId: UUID, today: string): Task[] {
  let out = tasks.filter((t) => t.lifecycle === "active");
  switch (filter.view) {
    case "my":
      out = out.filter((t) => t.ownerId === viewerId && t.status !== "done");
      break;
    case "all":
      out = out.filter((t) => t.status !== "done");
      break;
    case "week": {
      const diff = (t: Task) => (t.dueDate ? dateOnlyDiffDays(t.dueDate, today) : null);
      out = out.filter((t) => {
        const d = diff(t);
        return t.status !== "done" && d !== null && d >= 0 && d <= 7;
      });
      break;
    }
    case "overdue":
      out = out.filter((t) => isOverdue(t, today));
      break;
    case "waiting":
      out = out.filter((t) => t.status === "waiting" || t.status === "blocked");
      break;
    case "unassigned":
      out = out.filter((t) => t.ownerId === null && t.status !== "done");
      break;
    case "completed":
      out = tasks.filter((t) => t.status === "done" && t.lifecycle === "active");
      break;
  }
  if (filter.ownerId !== undefined && filter.ownerId !== null) {
    out = out.filter((t) => t.ownerId === filter.ownerId);
  }
  if (filter.workstreamId) out = out.filter((t) => t.workstreamId === filter.workstreamId);
  if (filter.labelId) out = out.filter((t) => t.labelIds.includes(filter.labelId!));
  if (filter.status) out = out.filter((t) => t.status === filter.status);
  if (filter.query) {
    const q = normalizeSearch(filter.query);
    out = out.filter((t) => normalizeSearch(t.title).includes(q) || normalizeSearch(t.description).includes(q));
  }
  return out;
}

export function sortTasksByDue(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const ad = a.dueDate ?? "9999-12-31";
    const bd = b.dueDate ?? "9999-12-31";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.updatedAt < b.updatedAt ? 1 : -1;
  });
}

export function sortTasksByUpdated(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Indicative workload — derived counts, never hours or capacity scores. */
export interface WorkloadIndicator {
  personId: UUID;
  unfinishedDueThisWeek: number;
  overdueCount: number;
  blockedCount: number;
  taskIds: UUID[];
  overdueTaskIds: UUID[];
  blockedTaskIds: UUID[];
}

export function workloadFor(
  person: Person,
  tasks: Task[],
  today: string
): WorkloadIndicator {
  const theirs = tasks.filter(
    (t) => t.lifecycle === "active" && t.status !== "done" && t.ownerId === person.id
  );
  const week = theirs.filter((t) => {
    if (!t.dueDate) return false;
    const d = dateOnlyDiffDays(t.dueDate, today);
    return d >= 0 && d <= 7;
  });
  const overdue = theirs.filter((t) => isOverdue(t, today));
  const blocked = theirs.filter((t) => t.status === "blocked" || t.status === "waiting");
  return {
    personId: person.id,
    unfinishedDueThisWeek: week.length,
    overdueCount: overdue.length,
    blockedCount: blocked.length,
    taskIds: theirs.map((t) => t.id),
    overdueTaskIds: overdue.map((t) => t.id),
    blockedTaskIds: blocked.map((t) => t.id),
  };
}

export function taskById(tasks: Task[], id: UUID): Task | null {
  return tasks.find((t) => t.id === id) ?? null;
}

export function nextMeeting(events: CalendarEvent[], meetings: Meeting[], nowIso: string): {
  meeting: Meeting; event: CalendarEvent;
} | null {
  const upcoming = events
    .filter((e) => e.kind === "meeting" && e.start > nowIso && e.meetingId)
    .sort((a, b) => (a.start < b.start ? -1 : 1));
  const ev = upcoming[0];
  if (!ev || !ev.meetingId) return null;
  const m = meetings.find((x) => x.id === ev.meetingId);
  return m ? { meeting: m, event: ev } : null;
}

export function personById(people: Person[], id: UUID | null | undefined): Person | null {
  if (!id) return null;
  return people.find((p) => p.id === id) ?? null;
}

export function initialsOf(person: Person | null): string {
  return person?.initials ?? "…";
}

/** Notification dedupe: stable key per person/kind/subject. */
export function notificationDedupeKey(personId: UUID, kind: string, subjectId: string): string {
  return `${personId}:${kind}:${subjectId}`;
}

export function projectCompletionRatio(tasks: Task[], projectId: UUID): { done: number; total: number } {
  const scoped = tasks.filter((t) => t.projectId === projectId && t.lifecycle === "active");
  const done = scoped.filter((t) => t.status === "done").length;
  return { done, total: scoped.length };
}
