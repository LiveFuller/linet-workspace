// Local (demo) repository over IndexedDB. Implements the full WorkspaceRepository
// contract with the same permission rules and validation as live mode. All writes
// go through permission checks and Zod validation; activity events are recorded.
import {
  clearAllStores, getAll, getMeta, openWorkspaceDB, putAll, setMeta, StoreName, type AppDB,
} from "./db";
import { buildSeed, SEED_VERSION } from "./seed";
import { DEFAULT_CLOCK } from "@/lib/dates";
import type { DataSnapshot, WorkspaceRepository } from "@/data/contracts/repository";
import type {
  ActivityEvent, BackupPayload, CalendarEvent, Decision, DocumentRecord, InboxItem,
  Meeting, MeetingActionProposal, Notification, Person,
  Report, ReportSchedule, ServiceError, ServiceResult, SupportTicket, SupportUpdate, Task,
  TaskChecklistItem, TaskComment, TrainingProgress,
  TranscriptSegment, UUID,
} from "@/domain/types";
import { can, canPerson, canUpdateTask } from "@/domain/permissions";
import {
  calendarEventSchema, inboxItemSchema, meetingSchema, proposalSchema,
  reportScheduleSchema, supportTicketSchema, taskDraftSchema, taskUpdateSchema,
} from "@/domain/validation";
import { sha256Hex, uuid } from "@/lib/utils";

type Ok<T> = { ok: true; data: T };
const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
const fail = (error: ServiceError) => ({ ok: false as const, error });

const CHANNEL = "linet-workspace-sync";
let broadcast: BroadcastChannel | null = null;

export class LocalRepository implements WorkspaceRepository {
  readonly mode = "local" as const;
  private db: AppDB | null = null;
  private listeners = new Set<() => void>();
  private currentPersona: Person | null = null;
  private clock = DEFAULT_CLOCK;

  async setPersona(person: Person | null) {
    this.currentPersona = person;
  }

  setClock(clock: () => Date) {
    this.clock = clock;
  }

  async ready(): Promise<ServiceResult<null>> {
    try {
      this.db = await openWorkspaceDB();
      await this.ensureSeeded();
      return ok(null);
    } catch (e) {
      if (this.isQuotaError(e)) {
        return fail({ code: "storage_full", message: "Prohlížeč odmítl uložit data (kvóta úložiště)." });
      }
      return fail({ code: "unknown", message: e instanceof Error ? e.message : String(e) });
    }
  }

  private isQuotaError(e: unknown): boolean {
    return e instanceof Error && (e.name === "QuotaExceededError" || (e as Error & { code?: number }).code === 22);
  }

  private async ensureSeeded() {
    const db = this.db!;
    const version = await getMeta<number>(db, "seedVersion");
    if (version === SEED_VERSION) return;
    if (version !== undefined && version < SEED_VERSION) {
      const ref = await getMeta<string>(db, "referenceDate");
      if (ref) return; // keep existing user data; never re-seed over it silently
    }
    await this.writeSeed();
  }

  async writeSeed() {
    const db = this.db!;
    const seed = buildSeed(this.clock());
    await clearAllStores(db);
    await putAll(db, "people", seed.people);
    await putAll(db, "projects", [seed.project]);
    await putAll(db, "workstreams", seed.workstreams);
    await putAll(db, "labels", seed.labels);
    await putAll(db, "tasks", seed.tasks);
    await putAll(db, "checklistItems", seed.checklist);
    await putAll(db, "comments", seed.comments);
    await putAll(db, "templates", seed.templates);
    await putAll(db, "events", seed.events);
    await putAll(db, "inbox", seed.inbox);
    await putAll(db, "meetings", seed.meetings);
    await putAll(db, "transcripts", seed.transcriptSegments);
    await putAll(db, "proposals", seed.proposals);
    await putAll(db, "decisions", seed.decisions);
    await putAll(db, "reports", seed.reports);
    await putAll(db, "schedules", seed.schedules);
    await putAll(db, "modules", seed.modules);
    await putAll(db, "trainingProgress", seed.trainingProgress);
    await putAll(db, "supportTickets", seed.supportTickets);
    await putAll(db, "supportUpdates", seed.supportUpdates);
    await putAll(db, "documents", seed.documents);
    await putAll(db, "notifications", seed.notifications);
    await putAll(db, "activity", seed.activity);
    await setMeta(db, "seedVersion", SEED_VERSION);
    await setMeta(db, "referenceDate", seed.referenceDate);
    this.notify();
  }

  // ---------------- snapshot ----------------
  async loadSnapshot(): Promise<ServiceResult<DataSnapshot>> {
    try {
      const db = this.db!;
      const [
        people, projects, workstreams, labels, tasks, checklistItems, comments,
        templates, events, inbox, meetings, transcripts, proposals, decisions,
        reports, schedules, modules, trainingProgress, supportTickets,
        supportUpdates, documents, notifications, activity,
      ] = await Promise.all([
        getAll(db, "people"), getAll(db, "projects"), getAll(db, "workstreams"),
        getAll(db, "labels"), getAll(db, "tasks"), getAll(db, "checklistItems"),
        getAll(db, "comments"), getAll(db, "templates"), getAll(db, "events"),
        getAll(db, "inbox"), getAll(db, "meetings"), getAll(db, "transcripts"),
        getAll(db, "proposals"), getAll(db, "decisions"), getAll(db, "reports"),
        getAll(db, "schedules"), getAll(db, "modules"), getAll(db, "trainingProgress"),
        getAll(db, "supportTickets"), getAll(db, "supportUpdates"),
        getAll(db, "documents"), getAll(db, "notifications"), getAll(db, "activity"),
      ]);
      // Privacy: support records are filtered per-persona at selector level;
      // screens apply canViewSupportTicket. Demo switcher is simulation, not auth.
      const snap: DataSnapshot = {
        people, projects, workstreams, labels, tasks, checklistItems, comments,
        templates, events, inbox, meetings, transcripts, proposals, decisions,
        reports, schedules, modules, trainingProgress, supportTickets,
        supportUpdates, documents, notifications, activity,
      };
      return ok(snap);
    } catch (e) {
      return fail({ code: "unknown", message: e instanceof Error ? e.message : String(e) });
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    if (!broadcast) {
      try {
        broadcast = new BroadcastChannel(CHANNEL);
        broadcast.onmessage = () => {
          this.listeners.forEach((l) => l());
        };
      } catch {
        /* BroadcastChannel unsupported — single-tab operation */
      }
    }
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
    try {
      broadcast?.postMessage({ t: Date.now() });
    } catch { /* ignore */ }
  }

  private async withTx<T>(fn: () => Promise<T>): Promise<ServiceResult<T>> {
    try {
      return ok(await fn());
    } catch (e) {
      const appErr = e as { code?: string; error?: ServiceError };
      if (appErr && appErr.code === "APP" && appErr.error) {
        return fail(appErr.error);
      }
      if (this.isQuotaError(e)) {
        return fail({ code: "storage_full", message: "Úložiště je plné — proveďte export zálohy a smažte staré záznamy." });
      }
      return fail({ code: "unknown", message: e instanceof Error ? e.message : String(e) });
    }
  }

  private appErr(error: ServiceError): never {
    throw { code: "APP", error };
  }

  private requirePersona(): Person {
    if (!this.currentPersona) this.appErr({ code: "forbidden", message: "Není vybrána demo osoba." });
    return this.currentPersona;
  }

  private require(action: Parameters<typeof can>[1]) {
    const p = this.requirePersona();
    if (!canPerson(p, action)) {
      this.appErr({ code: "forbidden", message: `Demo osoba ${p.name} nemá oprávnění k této akci (${action}).` });
    }
    return p;
  }

  private now(): string {
    return this.clock().toISOString();
  }

  private async emitActivity(a: Omit<ActivityEvent, "id" | "createdAt">) {
    await this.db!.add("activity", { ...a, id: uuid(), createdAt: this.now() });
  }

  // ---------------- Tasks ----------------
  async createTask(draft: unknown, actorId: UUID): Promise<ServiceResult<Task>> {
    return this.withTx(async () => {
      const parsed = taskDraftSchema.safeParse(draft);
      if (!parsed.success) this.appErr({ code: "validation", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      const d = parsed.data!;
      const actor = this.require("task:create");
      if (actorId !== actor.id) this.appErr({ code: "forbidden" });
      const task: Task = {
        id: uuid(), projectId: d.projectId, workstreamId: d.workstreamId, labelIds: d.labelIds,
        title: d.title, description: d.description, status: d.status, statusNote: d.statusNote,
        ownerId: d.ownerId, createdBy: actor.id, dueDate: d.dueDate, lifecycle: "active",
        completedAt: null, completedBy: null, source: d.source, sourceRef: d.sourceRef,
        sourceUrl: d.sourceUrl, version: 1, createdAt: this.now(), updatedAt: this.now(),
      };
      await this.db!.put("tasks", task);
      await this.emitActivity({ taskId: task.id, meetingId: null, supportTicketId: null, projectId: task.projectId, actorId: actor.id, kind: "task.created", summary: `Vytvořen úkol: ${task.title}`, detail: null });
      this.notify();
      return task;
    });
  }

  async updateTask(taskId: UUID, update: unknown, _actorId: UUID): Promise<ServiceResult<Task>> {
    return this.withTx(async () => {
      const parsed = taskUpdateSchema.safeParse(update);
      if (!parsed.success) this.appErr({ code: "validation", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      const u = parsed.data!;
      const persona = this.requirePersona();
      const task = await this.db!.get("tasks", taskId);
      if (!task) this.appErr({ code: "not_found" });
      if (!canUpdateTask(persona, task, task.projectId)) {
        this.appErr({ code: "forbidden", message: "Úkol můžete upravovat jen jako vlastník nebo tvůrce (nebo vedoucí projektu)." });
      }
      if (u.expectedVersion !== task.version) {
        this.appErr({ code: "conflict", message: "Úkol byl mezitím změněn někým jiným. Načtěte jej znovu a zopakujte změnu." });
      }
      const next: Task = {
        ...task,
        ...(u.title !== undefined ? { title: u.title } : {}),
        ...(u.description !== undefined ? { description: u.description } : {}),
        ...(u.ownerId !== undefined ? { ownerId: u.ownerId } : {}),
        ...(u.workstreamId !== undefined ? { workstreamId: u.workstreamId } : {}),
        ...(u.labelIds !== undefined ? { labelIds: u.labelIds } : {}),
        ...(u.dueDate !== undefined ? { dueDate: u.dueDate } : {}),
        ...(u.statusNote !== undefined ? { statusNote: u.statusNote } : {}),
        ...(u.status !== undefined ? { status: u.status } : {}),
        version: task.version + 1,
        updatedAt: this.now(),
      };
      if (u.status === "done" && task.status !== "done") {
        next.completedAt = this.now();
        next.completedBy = persona.id;
      }
      if (u.status && u.status !== "done" && task.status === "done") {
        next.completedAt = null;
        next.completedBy = null;
      }
      await this.db!.put("tasks", next);
      await this.emitActivity({ taskId: next.id, meetingId: null, supportTicketId: null, projectId: next.projectId, actorId: persona.id, kind: "task.updated", summary: `Upraven úkol: ${next.title}`, detail: u.reason ?? null });
      this.notify();
      return next;
    });
  }

  private async setStatus(taskId: UUID, _actorId: UUID, status: Task["status"]): Promise<ServiceResult<Task>> {
    return this.withTx(async () => {
      const persona = this.requirePersona();
      const task = await this.db!.get("tasks", taskId);
      if (!task) this.appErr({ code: "not_found" });
      const isOwn = task.ownerId === persona.id || task.createdBy === persona.id;
      const allowed = isOwn
        ? can(persona.role, "task:complete")
        : can(persona.role, "task:update:any");
      if (!allowed) this.appErr({ code: "forbidden", message: "Nemáte oprávnění měnit stav tohoto úkolu." });
      const next: Task = {
        ...task, status,
        completedAt: status === "done" ? this.now() : null,
        completedBy: status === "done" ? persona.id : null,
        version: task.version + 1, updatedAt: this.now(),
      };
      await this.db!.put("tasks", next);
      await this.emitActivity({
        taskId: next.id, meetingId: null, supportTicketId: null, projectId: next.projectId,
        actorId: persona.id, kind: status === "done" ? "task.completed" : "task.reopened",
        summary: status === "done" ? `Dokončeno: ${next.title}` : `Znovu otevřeno: ${next.title}`, detail: null,
      });
      this.notify();
      return next;
    });
  }

  completeTask(taskId: UUID, actorId: UUID) { return this.setStatus(taskId, actorId, "done"); }
  reopenTask(taskId: UUID, actorId: UUID) { return this.setStatus(taskId, actorId, "todo"); }

  async archiveTask(taskId: UUID, _actorId: UUID): Promise<ServiceResult<Task>> {
    return this.withTx(async () => {
      const persona = this.requirePersona();
      const task = await this.db!.get("tasks", taskId);
      if (!task) this.appErr({ code: "not_found" });
      const allowed = canUpdateTask(persona, task, task.projectId) || can(persona.role, "task:archive");
      if (!allowed) this.appErr({ code: "forbidden" });
      const next = { ...task, lifecycle: "archived" as const, version: task.version + 1, updatedAt: this.now() };
      await this.db!.put("tasks", next);
      await this.emitActivity({ taskId: next.id, meetingId: null, supportTicketId: null, projectId: next.projectId, actorId: persona.id, kind: "task.archived", summary: `Archivováno: ${next.title}`, detail: null });
      this.notify();
      return next;
    });
  }

  async restoreTask(taskId: UUID, _actorId: UUID): Promise<ServiceResult<Task>> {
    return this.withTx(async () => {
      const persona = this.requirePersona();
      const task = await this.db!.get("tasks", taskId);
      if (!task) this.appErr({ code: "not_found" });
      if (!canUpdateTask(persona, task, task.projectId) && !can(persona.role, "task:archive")) this.appErr({ code: "forbidden" });
      const next = { ...task, lifecycle: "active" as const, version: task.version + 1, updatedAt: this.now() };
      await this.db!.put("tasks", next);
      this.notify();
      return next;
    });
  }

  async deleteTask(taskId: UUID, _actorId: UUID): Promise<ServiceResult<null>> {
    return this.withTx(async () => {
      const persona = this.require("task:delete");
      const task = await this.db!.get("tasks", taskId);
      if (!task) this.appErr({ code: "not_found" });
      await this.db!.delete("tasks", taskId);
      const cmts = await this.db!.getAllFromIndex("comments", "by-task", taskId);
      for (const c of cmts) await this.db!.delete("comments", c.id);
      const items = await this.db!.getAllFromIndex("checklistItems", "by-task", taskId);
      for (const it of items) await this.db!.delete("checklistItems", it.id);
      await this.emitActivity({ taskId: null, meetingId: null, supportTicketId: null, projectId: task.projectId, actorId: persona.id, kind: "task.deleted", summary: `Smazán úkol: ${task.title}`, detail: null });
      this.notify();
      return null;
    });
  }

  async duplicateTask(taskId: UUID, _actorId: UUID): Promise<ServiceResult<Task>> {
    return this.withTx(async () => {
      this.require("task:create");
      const task = await this.db!.get("tasks", taskId);
      if (!task) this.appErr({ code: "not_found" });
      const copy: Task = {
        ...task, id: uuid(), title: `${task.title} (kopie)`, status: "todo",
        completedAt: null, completedBy: null, version: 1,
        createdAt: this.now(), updatedAt: this.now(), source: "manual",
      };
      await this.db!.put("tasks", copy);
      const items = await this.db!.getAllFromIndex("checklistItems", "by-task", taskId);
      for (const [i, it] of items.entries()) {
        await this.db!.put("checklistItems", { ...it, id: uuid(), taskId: copy.id, done: false, doneAt: null, doneBy: null, position: i });
      }
      this.notify();
      return copy;
    });
  }

  // ---------------- Checklist ----------------
  async addChecklistItem(taskId: UUID, title: string, _actorId: UUID): Promise<ServiceResult<TaskChecklistItem>> {
    return this.withTx(async () => {
      const persona = this.requirePersona();
      const task = await this.db!.get("tasks", taskId);
      if (!task) this.appErr({ code: "not_found" });
      if (!canUpdateTask(persona, task, task.projectId)) this.appErr({ code: "forbidden" });
      const items = await this.db!.getAllFromIndex("checklistItems", "by-task", taskId);
      const item: TaskChecklistItem = {
        id: uuid(), taskId, title: title.trim(), position: items.length,
        done: false, doneAt: null, doneBy: null,
      };
      await this.db!.put("checklistItems", item);
      this.notify();
      return item;
    });
  }

  async setChecklistItemDone(itemId: UUID, done: boolean, _actorId: UUID): Promise<ServiceResult<TaskChecklistItem>> {
    return this.withTx(async () => {
      const persona = this.requirePersona();
      const item = await this.db!.get("checklistItems", itemId);
      if (!item) this.appErr({ code: "not_found" });
      const task = await this.db!.get("tasks", item.taskId);
      if (!task) this.appErr({ code: "not_found" });
      if (!canUpdateTask(persona, task, task.projectId)) this.appErr({ code: "forbidden" });
      const next = { ...item, done, doneAt: done ? this.now() : null, doneBy: done ? persona.id : null };
      await this.db!.put("checklistItems", next);
      this.notify();
      return next;
    });
  }

  async removeChecklistItem(itemId: UUID, _actorId: UUID): Promise<ServiceResult<null>> {
    return this.withTx(async () => {
      const persona = this.requirePersona();
      const item = await this.db!.get("checklistItems", itemId);
      if (!item) this.appErr({ code: "not_found" });
      const task = await this.db!.get("tasks", item.taskId);
      if (!task || !canUpdateTask(persona, task, task.projectId)) this.appErr({ code: "forbidden" });
      await this.db!.delete("checklistItems", itemId);
      this.notify();
      return null;
    });
  }

  // ---------------- Comments ----------------
  async addComment(taskId: UUID, body: string, _actorId: UUID): Promise<ServiceResult<TaskComment>> {
    return this.withTx(async () => {
      const persona = this.require("comment:create");
      const task = await this.db!.get("tasks", taskId);
      if (!task) this.appErr({ code: "not_found" });
      const c: TaskComment = { id: uuid(), taskId, authorId: persona.id, body: body.trim(), createdAt: this.now() };
      await this.db!.put("comments", c);
      this.notify();
      return c;
    });
  }

  // ---------------- Meetings ----------------
  async createMeeting(input: unknown, _actorId: UUID): Promise<ServiceResult<Meeting>> {
    return this.withTx(async () => {
      this.require("meeting:manage");
      const parsed = meetingSchema.safeParse(input);
      if (!parsed.success) this.appErr({ code: "validation", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      const d = parsed.data!;
      const m: Meeting = {
        id: uuid(), projectId: d.projectId, workstreamId: d.workstreamId, title: d.title,
        startsAt: d.startsAt, durationMin: d.durationMin, participants: d.participants,
        agenda: d.agenda, status: "planned", notesSummary: "", publishedNotes: null,
        hasTranscript: false, createdAt: this.now(), updatedAt: this.now(),
      };
      await this.db!.put("meetings", m);
      await this.db!.put("events", {
        id: uuid(), projectId: m.projectId, kind: "meeting", title: m.title,
        dateMode: "timed", start: m.startsAt, end: null, durationMin: m.durationMin,
        allDay: false, timezone: "Europe/Prague", linkedTaskId: null, location: null,
        meetingId: m.id, createdAt: this.now(), updatedAt: this.now(),
      });
      this.notify();
      return m;
    });
  }

  async updateMeeting(meetingId: UUID, patch: Partial<Meeting>, _actorId: UUID): Promise<ServiceResult<Meeting>> {
    return this.withTx(async () => {
      this.require("meeting:manage");
      const m = await this.db!.get("meetings", meetingId);
      if (!m) this.appErr({ code: "not_found" });
      const next = { ...m, ...patch, updatedAt: this.now() };
      await this.db!.put("meetings", next);
      this.notify();
      return next;
    });
  }

  async importTranscript(meetingId: UUID, segments: { speaker: string | null; startMs: number | null; endMs: number | null; text: string }[], _actorId: UUID): Promise<ServiceResult<TranscriptSegment[]>> {
    return this.withTx(async () => {
      this.require("meeting:review");
      const m = await this.db!.get("meetings", meetingId);
      if (!m) this.appErr({ code: "not_found" });
      if (segments.length === 0) this.appErr({ code: "validation", issues: [{ path: "segments", message: "Prázdný přepis — není co importovat." }] });
      const existing = await this.db!.getAllFromIndex("transcripts", "by-meeting", meetingId);
      const out: TranscriptSegment[] = [];
      const tx = this.db!.transaction("transcripts", "readwrite");
      for (const [i, s] of segments.entries()) {
        const seg: TranscriptSegment = {
          id: uuid(), meetingId, position: existing.length + i,
          speaker: s.speaker?.trim() || null, startMs: s.startMs, endMs: s.endMs,
          text: s.text,
        };
        await tx.store.put(seg);
        out.push(seg);
      }
      await tx.done;
      await this.db!.put("meetings", { ...m, hasTranscript: true, updatedAt: this.now() });
      this.notify();
      return out;
    });
  }

  async addProposal(input: unknown, _actorId: UUID): Promise<ServiceResult<MeetingActionProposal>> {
    return this.withTx(async () => {
      this.require("proposal:review");
      const parsed = proposalSchema.safeParse(input);
      if (!parsed.success) this.appErr({ code: "validation", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      const d = parsed.data!;
      const all = await this.db!.getAllFromIndex("proposals", "by-meeting", d.meetingId);
      if (all.some((p) => p.sourceActionKey === d.sourceActionKey)) {
        this.appErr({ code: "conflict", message: "Návrh s tímto zdrojovým klíčem už existuje (ochrana proti duplicitám)." });
      }
      const p: MeetingActionProposal = {
        id: uuid(), meetingId: d.meetingId, sourceActionKey: d.sourceActionKey,
        evidenceText: d.evidenceText, evidenceSegmentId: null, startMs: null, endMs: null,
        proposedTitle: d.proposedTitle, proposedOwnerId: d.proposedOwnerId,
        proposedDueDate: d.proposedDueDate, extractionMethod: "manual", state: "needs_review",
        createdTaskId: null, acceptedAt: null, createdAt: this.now(), updatedAt: this.now(),
      };
      await this.db!.put("proposals", p);
      this.notify();
      return p;
    });
  }

  async updateProposal(proposalId: UUID, patch: Partial<MeetingActionProposal>, _actorId: UUID): Promise<ServiceResult<MeetingActionProposal>> {
    return this.withTx(async () => {
      this.require("proposal:review");
      const p = await this.db!.get("proposals", proposalId);
      if (!p) this.appErr({ code: "not_found" });
      const next = { ...p, ...patch, updatedAt: this.now() };
      await this.db!.put("proposals", next);
      this.notify();
      return next;
    });
  }

  /** Approve-once guarantee: unique sourceActionKey + createdTaskId set exactly once. */
  async approveProposal(proposalId: UUID, taskDraft: unknown, _actorId: UUID): Promise<ServiceResult<{ proposal: MeetingActionProposal; task: Task }>> {
    return this.withTx(async () => {
      const persona = this.require("proposal:review");
      const p = await this.db!.get("proposals", proposalId);
      if (!p) this.appErr({ code: "not_found" });
      if (p.createdTaskId) {
        const existing = await this.db!.get("tasks", p.createdTaskId);
        if (existing) {
          this.appErr({ code: "conflict", message: "Akce už byla schválena — úkol už existuje, odkaz je zobrazen u návrhu." });
        }
      }
      const parsed = taskDraftSchema.safeParse(taskDraft);
      if (!parsed.success) this.appErr({ code: "validation", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      const d = parsed.data!;
      const m = await this.db!.get("meetings", p.meetingId);
      const task: Task = {
        id: uuid(), projectId: d.projectId ?? m?.projectId ?? "", workstreamId: d.workstreamId,
        labelIds: d.labelIds, title: d.title, description: d.description, status: "todo",
        statusNote: null, ownerId: d.ownerId, createdBy: persona.id, dueDate: d.dueDate,
        lifecycle: "active", completedAt: null, completedBy: null, source: "meeting_action",
        sourceRef: p.sourceActionKey, sourceUrl: null, version: 1,
        createdAt: this.now(), updatedAt: this.now(),
      };
      await this.db!.put("tasks", task);
      const nextProposal: MeetingActionProposal = {
        ...p, state: "accepted", createdTaskId: task.id, acceptedAt: this.now(), updatedAt: this.now(),
      };
      await this.db!.put("proposals", nextProposal);
      await this.emitActivity({ taskId: task.id, meetingId: p.meetingId, supportTicketId: null, projectId: task.projectId, actorId: persona.id, kind: "proposal.approved", summary: `Schválena akce z porady: ${task.title}`, detail: p.evidenceText.slice(0, 200) });
      this.notify();
      return { proposal: nextProposal, task };
    });
  }

  // ---------------- Decisions ----------------
  async createDecision(input: {
    projectId: UUID; title: string; text: string; decidedOn: string;
    decisionMakerId: UUID | null; sourceMeetingId: UUID | null; relatedTaskIds: UUID[];
  }, _actorId: UUID): Promise<ServiceResult<Decision>> {
    return this.withTx(async () => {
      this.require("decision:manage");
      const dec: Decision = {
        id: uuid(), projectId: input.projectId, title: input.title, text: input.text,
        decidedOn: input.decidedOn, decisionMakerId: input.decisionMakerId,
        sourceMeetingId: input.sourceMeetingId, relatedTaskIds: input.relatedTaskIds,
        supersededBy: null, createdAt: this.now(), updatedAt: this.now(),
      };
      await this.db!.put("decisions", dec);
      this.notify();
      return dec;
    });
  }

  // ---------------- Inbox ----------------
  async addInboxItem(input: unknown, _actorId: UUID): Promise<ServiceResult<InboxItem>> {
    return this.withTx(async () => {
      const persona = this.requirePersona();
      const parsed = inboxItemSchema.safeParse(input);
      if (!parsed.success) this.appErr({ code: "validation", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      const d = parsed.data!;
      const bodyNorm = d.body.replace(/\s+/g, " ").trim().toLowerCase();
      const fp = await sha256Hex(`${d.kind}|${d.title}|${bodyNorm}`);
      const existing = await getAll(this.db!, "inbox");
      const dup = existing.find((x) => x.fingerprint === fp && x.state !== "ignored");
      if (dup) {
        this.appErr({ code: "conflict", message: "Podobný vstup už je ve sběrné schránce (dedupe). Otevřete jej k nahlédnutí." });
      }
      const item: InboxItem = {
        id: uuid(), projectId: d.projectId, kind: d.kind, capturedById: persona.id,
        isPrivateDraft: d.kind === "note", title: d.title, body: d.body,
        sourceMessageId: d.sourceMessageId, fingerprint: fp, state: "unprocessed",
        createdTaskId: null, createdAt: this.now(), updatedAt: this.now(),
      };
      await this.db!.put("inbox", item);
      this.notify();
      return item;
    });
  }

  async updateInboxItem(id: UUID, patch: Partial<InboxItem>, _actorId: UUID): Promise<ServiceResult<InboxItem>> {
    return this.withTx(async () => {
      const persona = this.requirePersona();
      const item = await this.db!.get("inbox", id);
      if (!item) this.appErr({ code: "not_found" });
      if (item.isPrivateDraft && item.capturedById !== persona.id && !can(persona.role, "task:update:any")) {
        this.appErr({ code: "forbidden", message: "Soukromý koncept vidí jen jeho autor." });
      }
      const next = { ...item, ...patch, updatedAt: this.now() };
      await this.db!.put("inbox", next);
      this.notify();
      return next;
    });
  }

  // ---------------- Calendar ----------------
  async createEvent(input: unknown, _actorId: UUID): Promise<ServiceResult<CalendarEvent>> {
    return this.withTx(async () => {
      this.require("calendar:manage");
      const parsed = calendarEventSchema.safeParse(input);
      if (!parsed.success) this.appErr({ code: "validation", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      const d = parsed.data!;
      const ev: CalendarEvent = {
        id: uuid(), projectId: d.projectId, kind: d.kind, title: d.title,
        dateMode: d.dateMode, start: d.start, end: d.end, durationMin: d.durationMin,
        allDay: d.allDay, timezone: d.timezone, linkedTaskId: d.linkedTaskId,
        location: d.location, meetingId: d.meetingId, createdAt: this.now(), updatedAt: this.now(),
      };
      await this.db!.put("events", ev);
      this.notify();
      return ev;
    });
  }

  async updateEvent(eventId: UUID, patch: Partial<CalendarEvent>, _actorId: UUID): Promise<ServiceResult<CalendarEvent>> {
    return this.withTx(async () => {
      this.require("calendar:manage");
      const ev = await this.db!.get("events", eventId);
      if (!ev) this.appErr({ code: "not_found" });
      const next = { ...ev, ...patch, updatedAt: this.now() };
      await this.db!.put("events", next);
      this.notify();
      return next;
    });
  }

  async deleteEvent(eventId: UUID, _actorId: UUID): Promise<ServiceResult<null>> {
    return this.withTx(async () => {
      this.require("calendar:manage");
      await this.db!.delete("events", eventId);
      this.notify();
      return null;
    });
  }

  // ---------------- Support ----------------
  async createSupportTicket(input: unknown, _actorId: UUID): Promise<ServiceResult<SupportTicket>> {
    return this.withTx(async () => {
      const persona = this.require("support:create");
      const parsed = supportTicketSchema.safeParse(input);
      if (!parsed.success) this.appErr({ code: "validation", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      const d = parsed.data!;
      const t: SupportTicket = {
        id: uuid(), projectId: d.projectId, title: d.title, category: d.category,
        description: d.description, requesterId: persona.id, coordinatorId: null,
        status: "captured", impact: d.impact, officialTicketRef: null, followUpDate: null,
        attachmentNames: [], createdAt: this.now(), updatedAt: this.now(),
      };
      await this.db!.put("supportTickets", t);
      await this.emitActivity({ taskId: null, meetingId: null, supportTicketId: t.id, projectId: t.projectId, actorId: persona.id, kind: "support.created", summary: `Zaevidován požadavek: ${t.title}`, detail: null });
      this.notify();
      return t;
    });
  }

  async updateSupportTicket(id: UUID, patch: Partial<SupportTicket>, _actorId: UUID): Promise<ServiceResult<SupportTicket>> {
    return this.withTx(async () => {
      const persona = this.requirePersona();
      const t = await this.db!.get("supportTickets", id);
      if (!t) this.appErr({ code: "not_found" });
      const isCoordinator = can(persona.role, "support:coordinate");
      const isRequester = t.requesterId === persona.id;
      if (!isCoordinator && !isRequester && persona.role !== "workspace_admin") {
        this.appErr({ code: "forbidden", message: "Požadavek je soukromý — vidí jej žadatel a koordinátoři." });
      }
      const next = { ...t, ...patch, updatedAt: this.now() };
      await this.db!.put("supportTickets", next);
      this.notify();
      return next;
    });
  }

  async addSupportUpdate(ticketId: UUID, body: string, visibleToRequester: boolean, _actorId: UUID): Promise<ServiceResult<SupportUpdate>> {
    return this.withTx(async () => {
      const persona = this.requirePersona();
      const t = await this.db!.get("supportTickets", ticketId);
      if (!t) this.appErr({ code: "not_found" });
      const isCoordinator = can(persona.role, "support:coordinate");
      if (!isCoordinator && t.requesterId !== persona.id) this.appErr({ code: "forbidden" });
      const u: SupportUpdate = {
        id: uuid(), ticketId, authorId: persona.id, body: body.trim(),
        visibleToRequester: isCoordinator ? visibleToRequester : true,
        createdAt: this.now(),
      };
      await this.db!.put("supportUpdates", u);
      this.notify();
      return u;
    });
  }

  // ---------------- Documents ----------------
  async createDocument(input: {
    projectId: UUID; title: string; category: DocumentRecord["category"];
    description: string; workstreamId: UUID | null; url: string | null; content: string | null;
  }, _actorId: UUID): Promise<ServiceResult<DocumentRecord>> {
    return this.withTx(async () => {
      const persona = this.require("document:manage");
      const doc: DocumentRecord = {
        id: uuid(), projectId: input.projectId, title: input.title,
        category: input.category, description: input.description, ownerId: persona.id,
        updatedAt: this.now(), workstreamId: input.workstreamId,
        url: input.url && /^https?:\/\//.test(input.url) ? input.url : null,
        localSample: !input.url, content: input.content,
      };
      await this.db!.put("documents", doc);
      this.notify();
      return doc;
    });
  }

  // ---------------- Reports ----------------
  async saveReport(report: Omit<Report, "id" | "createdAt" | "updatedAt">, _actorId: UUID): Promise<ServiceResult<Report>> {
    return this.withTx(async () => {
      this.require("report:generate");
      const r: Report = { ...report, id: uuid(), createdAt: this.now(), updatedAt: this.now() };
      await this.db!.put("reports", r);
      this.notify();
      return r;
    });
  }

  async updateReport(id: UUID, patch: Partial<Report>, _actorId: UUID): Promise<ServiceResult<Report>> {
    return this.withTx(async () => {
      this.require("report:generate");
      const r = await this.db!.get("reports", id);
      if (!r) this.appErr({ code: "not_found" });
      const next = { ...r, ...patch, updatedAt: this.now() };
      await this.db!.put("reports", next);
      this.notify();
      return next;
    });
  }

  async upsertSchedule(input: unknown, _actorId: UUID): Promise<ServiceResult<ReportSchedule>> {
    return this.withTx(async () => {
      this.require("report:manage_schedules");
      const parsed = reportScheduleSchema.safeParse(input);
      if (!parsed.success) this.appErr({ code: "validation", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
      const d = parsed.data!;
      const existing = await getAll(this.db!, "schedules");
      const found = existing.find(
        (s) => s.projectId === d.projectId && s.kind === d.kind && s.channel === d.channel
      );
      const s: ReportSchedule = found
        ? { ...found, ...d, id: found.id, updatedAt: this.now() }
        : { ...d, id: uuid(), lastRunAt: null, createdAt: this.now(), updatedAt: this.now() };
      await this.db!.put("schedules", s);
      this.notify();
      return s;
    });
  }

  // ---------------- Learning ----------------
  async setTrainingProgress(moduleId: string, patch: { state?: TrainingProgress["state"]; checklistDone?: string[] }, _actorId: UUID): Promise<ServiceResult<TrainingProgress>> {
    return this.withTx(async () => {
      const persona = this.requirePersona();
      const key: [string, string] = [moduleId, persona.id];
      const existing = await this.db!.get("trainingProgress", key);
      const next: TrainingProgress = {
        moduleId, personId: persona.id,
        state: patch.state ?? existing?.state ?? "not_started",
        checklistDone: patch.checklistDone ?? existing?.checklistDone ?? [],
        completedAt: patch.state === "completed" ? this.now() : existing?.completedAt ?? null,
        updatedAt: this.now(),
      };
      await this.db!.put("trainingProgress", next);
      this.notify();
      return next;
    });
  }

  // ---------------- Notifications ----------------
  async markNotificationRead(id: UUID): Promise<ServiceResult<Notification>> {
    return this.withTx(async () => {
      const n = await this.db!.get("notifications", id);
      if (!n) this.appErr({ code: "not_found" });
      const next = { ...n, readAt: n.readAt ?? this.now() };
      await this.db!.put("notifications", next);
      this.notify();
      return next;
    });
  }

  async markAllNotificationsRead(personId: UUID): Promise<ServiceResult<null>> {
    return this.withTx(async () => {
      const all = await this.db!.getAllFromIndex("notifications", "by-person", personId);
      for (const n of all) {
        if (!n.readAt) await this.db!.put("notifications", { ...n, readAt: this.now() });
      }
      this.notify();
      return null;
    });
  }

  // ---------------- Backup / reset ----------------
  async exportBackup(): Promise<ServiceResult<BackupPayload>> {
    try {
      const db = this.db!;
      const stores: StoreName[] = [
        "people", "projects", "workstreams", "labels", "tasks", "checklistItems",
        "comments", "templates", "events", "inbox", "meetings", "transcripts",
        "proposals", "decisions", "reports", "schedules", "modules",
        "trainingProgress", "supportTickets", "supportUpdates", "documents",
        "notifications", "activity",
      ];
      const data: Record<string, unknown[]> = {};
      for (const s of stores) data[s] = await getAll(db, s);
      return ok({
        format: "linet-workspace-backup", version: 1, exportedAt: this.now(),
        dataMode: "local", data,
      });
    } catch (e) {
      return fail({ code: "unknown", message: e instanceof Error ? e.message : String(e) });
    }
  }

  async resetDemoData(): Promise<ServiceResult<null>> {
    try {
      await this.writeSeed();
      return ok(null);
    } catch (e) {
      return fail({ code: "unknown", message: e instanceof Error ? e.message : String(e) });
    }
  }

  integrationStatuses() {
    return [
      { id: "supabase" as const, state: "demo_simulation" as const, operations: [], lastCheck: null, message: "Databáze: lokální demo (IndexedDB na tomto zařízení)." },
      { id: "microsoft" as const, state: "not_configured" as const, operations: [], lastCheck: null, message: "Microsoft 365: nenakonfigurováno. Ruční import přepisů a e-mailů zůstává plně funkční." },
      { id: "ai" as const, state: "not_configured" as const, operations: [], lastCheck: null, message: "AI poskytovatel: nenakonfigurováno. Deterministický helper s povinným ručním přehledem." },
      { id: "mail" as const, state: "not_configured" as const, operations: [], lastCheck: null, message: "E-mailová sběrná adresa: nenakonfigurována. K dispozici ruční vložení e-mailu." },
    ];
  }
}
