// Repository contract — the single seam between demo (IndexedDB) and live (Supabase).
// Every feature's persistence goes through these interfaces; screens never touch
// a provider client directly.
import type {
  ActivityEvent, BackupPayload, CalendarEvent, Decision, DocumentRecord, InboxItem,
  IntegrationStatus, Label, Meeting, MeetingActionProposal, Notification, Person,
  Project, Report, ReportSchedule, ServiceResult, SupportTicket, SupportUpdate,
  Task, TaskChecklistItem, TaskComment, TaskTemplate, TrainingModule,
  TrainingProgress, TranscriptSegment, UUID, Workstream,
} from "@/domain/types";
import type { TaskDraft, TaskUpdate } from "@/domain/validation";

export interface SnapshotListener {
  (): void;
}

/** Full data snapshot for the authorized scope. Demo mode returns everything the
 *  current persona may see; live mode applies the same shape post-RLS. */
export interface DataSnapshot {
  people: Person[];
  projects: Project[];
  workstreams: Workstream[];
  labels: Label[];
  tasks: Task[];
  checklistItems: TaskChecklistItem[];
  comments: TaskComment[];
  templates: TaskTemplate[];
  events: CalendarEvent[];
  inbox: InboxItem[];
  meetings: Meeting[];
  transcripts: TranscriptSegment[];
  proposals: MeetingActionProposal[];
  decisions: Decision[];
  reports: Report[];
  schedules: ReportSchedule[];
  modules: TrainingModule[];
  trainingProgress: TrainingProgress[];
  supportTickets: SupportTicket[];
  supportUpdates: SupportUpdate[];
  documents: DocumentRecord[];
  notifications: Notification[];
  activity: ActivityEvent[];
}

export interface WorkspaceRepository {
  readonly mode: "local" | "supabase";

  ready(): Promise<ServiceResult<null>>;

  loadSnapshot(): Promise<ServiceResult<DataSnapshot>>;

  subscribe(listener: SnapshotListener): () => void;

  // ---- Tasks ----
  createTask(draft: TaskDraft, actorId: UUID): Promise<ServiceResult<Task>>;
  updateTask(taskId: UUID, update: TaskUpdate, actorId: UUID): Promise<ServiceResult<Task>>;
  completeTask(taskId: UUID, actorId: UUID): Promise<ServiceResult<Task>>;
  reopenTask(taskId: UUID, actorId: UUID): Promise<ServiceResult<Task>>;
  archiveTask(taskId: UUID, actorId: UUID): Promise<ServiceResult<Task>>;
  restoreTask(taskId: UUID, actorId: UUID): Promise<ServiceResult<Task>>;
  deleteTask(taskId: UUID, actorId: UUID): Promise<ServiceResult<null>>;
  duplicateTask(taskId: UUID, actorId: UUID): Promise<ServiceResult<Task>>;

  addChecklistItem(taskId: UUID, title: string, actorId: UUID): Promise<ServiceResult<TaskChecklistItem>>;
  setChecklistItemDone(itemId: UUID, done: boolean, actorId: UUID): Promise<ServiceResult<TaskChecklistItem>>;
  removeChecklistItem(itemId: UUID, actorId: UUID): Promise<ServiceResult<null>>;

  addComment(taskId: UUID, body: string, actorId: UUID): Promise<ServiceResult<TaskComment>>;

  // ---- Meetings ----
  createMeeting(input: {
    projectId: UUID; title: string; startsAt: string; durationMin: number;
    workstreamId: UUID | null; agenda: string; participants: UUID[];
  }, actorId: UUID): Promise<ServiceResult<Meeting>>;
  updateMeeting(meetingId: UUID, patch: Partial<Meeting>, actorId: UUID): Promise<ServiceResult<Meeting>>;
  importTranscript(meetingId: UUID, segments: { speaker: string | null; startMs: number | null; endMs: number | null; text: string }[], actorId: UUID): Promise<ServiceResult<TranscriptSegment[]>>;
  addProposal(input: {
    meetingId: UUID; evidenceText: string; proposedTitle: string;
    proposedOwnerId: UUID | null; proposedDueDate: string | null; sourceActionKey: string;
    extractionMethod?: "deterministic_helper" | "ai_provider" | "manual";
  }, actorId: UUID): Promise<ServiceResult<MeetingActionProposal>>;
  updateProposal(proposalId: UUID, patch: Partial<MeetingActionProposal>, actorId: UUID): Promise<ServiceResult<MeetingActionProposal>>;
  approveProposal(proposalId: UUID, taskDraft: TaskDraft, actorId: UUID): Promise<ServiceResult<{ proposal: MeetingActionProposal; task: Task }>>;

  // ---- Decisions ----
  createDecision(input: {
    projectId: UUID; title: string; text: string; decidedOn: string;
    decisionMakerId: UUID | null; sourceMeetingId: UUID | null; relatedTaskIds: UUID[];
  }, actorId: UUID): Promise<ServiceResult<Decision>>;

  // ---- Inbox ----
  addInboxItem(input: {
    projectId: UUID; kind: InboxItem["kind"]; title: string; body: string;
    sourceMessageId: string | null; isPrivateDraft: boolean;
  }, actorId: UUID): Promise<ServiceResult<InboxItem>>;
  updateInboxItem(id: UUID, patch: Partial<InboxItem>, actorId: UUID): Promise<ServiceResult<InboxItem>>;

  // ---- Calendar ----
  createEvent(input: {
    projectId: UUID; kind: CalendarEvent["kind"]; title: string;
    dateMode: CalendarEvent["dateMode"]; start: string; end: string | null;
    durationMin: number | null; allDay: boolean; timezone: string;
    linkedTaskId: UUID | null; location: string | null; meetingId: UUID | null;
  }, actorId: UUID): Promise<ServiceResult<CalendarEvent>>;
  updateEvent(eventId: UUID, patch: Partial<CalendarEvent>, actorId: UUID): Promise<ServiceResult<CalendarEvent>>;
  deleteEvent(eventId: UUID, actorId: UUID): Promise<ServiceResult<null>>;

  // ---- Support ----
  createSupportTicket(input: {
    projectId: UUID; title: string; category: SupportTicket["category"];
    description: string; impact: "low" | "medium" | "high";
  }, actorId: UUID): Promise<ServiceResult<SupportTicket>>;
  updateSupportTicket(id: UUID, patch: Partial<SupportTicket>, actorId: UUID): Promise<ServiceResult<SupportTicket>>;
  addSupportUpdate(ticketId: UUID, body: string, visibleToRequester: boolean, actorId: UUID): Promise<ServiceResult<SupportUpdate>>;

  // ---- Documents ----
  createDocument(input: {
    projectId: UUID; title: string; category: DocumentRecord["category"];
    description: string; workstreamId: UUID | null; url: string | null; content: string | null;
  }, actorId: UUID): Promise<ServiceResult<DocumentRecord>>;

  // ---- Reports ----
  saveReport(report: Omit<Report, "id" | "createdAt" | "updatedAt">, actorId: UUID): Promise<ServiceResult<Report>>;
  updateReport(id: UUID, patch: Partial<Report>, actorId: UUID): Promise<ServiceResult<Report>>;
  upsertSchedule(input: Omit<ReportSchedule, "id" | "lastRunAt" | "createdAt" | "updatedAt">, actorId: UUID): Promise<ServiceResult<ReportSchedule>>;

  // ---- Learning ----
  setTrainingProgress(moduleId: string, patch: { state?: TrainingProgress["state"]; checklistDone?: string[] }, actorId: UUID): Promise<ServiceResult<TrainingProgress>>;

  // ---- Notifications ----
  markNotificationRead(id: UUID): Promise<ServiceResult<Notification>>;
  markAllNotificationsRead(personId: UUID): Promise<ServiceResult<null>>;

  // ---- Backup / demo lifecycle ----
  exportBackup(): Promise<ServiceResult<BackupPayload>>;
  resetDemoData(): Promise<ServiceResult<null>>;

  // ---- Integration capability reporting (no secrets) ----
  integrationStatuses(): IntegrationStatus[];
}
