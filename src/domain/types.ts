// LINET Workspace — domain types. Single source of truth for both data modes.

export type UUID = string;

export type DataMode = "local" | "supabase";

// ---------- Identity & membership ----------
export type WorkspaceRole = "workspace_admin" | "project_lead" | "it_coordinator" | "member" | "viewer";

export interface Person {
  id: UUID;
  name: string;
  email: string; // demo personas use example.invalid (simulation, not provisioned accounts)
  initials: string;
  role: WorkspaceRole;
  tz: string; // IANA zone used by this person for scheduling display
}

// ---------- Projects & structure ----------
export type SourceOfTruthMode = "standalone" | "microsoft_backed";

export interface Project {
  id: UUID;
  name: string;
  nameEn: string;
  description: string;
  sourceOfTruth: SourceOfTruthMode;
  timezone: string; // IANA
  createdAt: string; // ISO instant
  updatedAt: string;
}

export interface Workstream {
  id: UUID;
  projectId: UUID;
  name: string;
  nameEn: string;
  description: string;
}

export interface Label {
  id: UUID;
  projectId: UUID;
  name: string;
  color: string; // token-based, restrained palette
}

// ---------- Tasks ----------
export type TaskStatus = "todo" | "in_progress" | "waiting" | "blocked" | "done";
export type TaskLifecycle = "active" | "archived";
export type TaskSource =
  | "manual"
  | "meeting_action"
  | "email_capture"
  | "inbox_triage"
  | "quick_capture"
  | "template"
  | "external_sync";

export interface TaskChecklistItem {
  id: UUID;
  taskId: UUID;
  title: string;
  position: number;
  done: boolean;
  doneAt: string | null; // ISO instant
  doneBy: UUID | null;
}

export interface TaskComment {
  id: UUID;
  taskId: UUID;
  authorId: UUID;
  body: string;
  createdAt: string; // ISO instant
}

export interface ActivityEvent {
  id: UUID;
  // parent scope
  taskId: UUID | null;
  meetingId: UUID | null;
  supportTicketId: UUID | null;
  projectId: UUID;
  actorId: UUID | null;
  kind: string; // e.g. "task.completed"
  summary: string;
  detail: string | null;
  createdAt: string; // ISO instant
}

export interface Task {
  id: UUID;
  projectId: UUID;
  workstreamId: UUID | null;
  labelIds: UUID[];
  title: string;
  description: string;
  status: TaskStatus;
  statusNote: string | null; // reason for waiting/blocked
  ownerId: UUID | null; // null = unassigned (inbox candidate)
  createdBy: UUID;
  dueDate: string | null; // calendar date "YYYY-MM-DD", NOT a timestamp
  lifecycle: TaskLifecycle;
  completedAt: string | null; // ISO instant
  completedBy: UUID | null;
  source: TaskSource;
  sourceRef: string | null; // provenance: external id / proposal id / fingerprint
  sourceUrl: string | null; // validated link to origin
  version: number; // optimistic concurrency
  createdAt: string;
  updatedAt: string;
}

// ---------- Templates ----------
export interface TaskTemplate {
  id: UUID;
  projectId: UUID;
  name: string;
  description: string;
  checklist: { title: string }[];
}

// ---------- Calendar ----------
export type CalendarEventKind = "meeting" | "focus_block" | "deadline_marker";
export type EventDateMode = "date_only" | "timed";

export interface CalendarEvent {
  id: UUID;
  projectId: UUID;
  kind: CalendarEventKind;
  title: string;
  dateMode: EventDateMode;
  // For timed events, ISO instant; for date-only, the calendar date.
  start: string;
  end: string | null;
  durationMin: number | null;
  allDay: boolean;
  timezone: string; // IANA
  linkedTaskId: UUID | null;
  location: string | null;
  meetingId: UUID | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Inbox ----------
export type InboxKind = "note" | "email" | "transcript" | "link" | "file" | "voice";
export type InboxState = "unprocessed" | "in_review" | "processed" | "ignored";

export interface InboxItem {
  id: UUID;
  projectId: UUID;
  kind: InboxKind;
  capturedById: UUID;
  isPrivateDraft: boolean; // private-to-capturer before triage
  title: string;
  body: string; // original, never replaced
  sourceMessageId: string | null; // email Message-ID when available
  fingerprint: string; // deterministic scoped fingerprint for dedupe
  state: InboxState;
  createdTaskId: UUID | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Meetings ----------
export type MeetingStatus = "planned" | "in_review" | "notes_published" | "archived";

export interface Meeting {
  id: UUID;
  projectId: UUID;
  workstreamId: UUID | null;
  title: string;
  startsAt: string; // ISO instant
  durationMin: number;
  participants: UUID[];
  agenda: string;
  status: MeetingStatus;
  notesSummary: string; // editable working summary
  publishedNotes: string | null; // published, distinguishable from working draft
  hasTranscript: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptSegment {
  id: UUID;
  meetingId: UUID;
  position: number;
  speaker: string | null; // unknown stays null
  startMs: number | null;
  endMs: number | null;
  text: string; // immutable source text
}

export type ProposalState = "needs_review" | "accepted" | "edited" | "rejected" | "postponed";
export type ExtractionMethod = "deterministic_helper" | "ai_provider" | "manual";

export interface MeetingActionProposal {
  id: UUID;
  meetingId: UUID;
  sourceActionKey: string; // unique per meeting — approve-once guarantee
  evidenceText: string; // source excerpt, never replaced
  evidenceSegmentId: UUID | null;
  startMs: number | null;
  endMs: number | null;
  proposedTitle: string;
  proposedOwnerId: UUID | null;
  proposedDueDate: string | null;
  extractionMethod: ExtractionMethod;
  state: ProposalState;
  createdTaskId: UUID | null; // set exactly once
  acceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Decisions ----------
export interface Decision {
  id: UUID;
  projectId: UUID;
  title: string;
  text: string;
  decidedOn: string; // date
  decisionMakerId: UUID | null;
  sourceMeetingId: UUID | null;
  relatedTaskIds: UUID[];
  supersededBy: UUID | null; // decision register: supersession chain
  createdAt: string;
  updatedAt: string;
}

// ---------- Reports ----------
export type ReportKind = "daily" | "weekly";

export interface ReportSnapshotItem {
  kind: "completed" | "upcoming" | "overdue" | "blocker" | "decision" | "next_step";
  taskId: UUID | null;
  decisionId: UUID | null;
  title: string;
  detail: string | null;
  ownerId: UUID | null;
  dueDate: string | null;
}

export interface Report {
  id: UUID;
  projectId: UUID;
  kind: ReportKind;
  periodStart: string; // date
  periodEnd: string; // date
  timezone: string;
  generatedAt: string; // ISO instant
  status: "draft" | "published";
  filtersSummary: string; // human description of applied filters
  commentary: string; // editable commentary
  items: ReportSnapshotItem[]; // frozen snapshot
  createdAt: string;
  updatedAt: string;
}

export interface ReportSchedule {
  id: UUID;
  projectId: UUID;
  kind: ReportKind;
  cadence: "daily" | "weekly";
  timezone: string;
  sendAtLocal: string; // "HH:MM" local send time
  channel: "in_app" | "email";
  recipients: string[]; // configured addresses (example.invalid in demo)
  enabled: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Learning ----------
export interface TrainingModule {
  id: UUID;
  slug: string;
  title: string;
  titleEn: string;
  objective: string;
  objectiveEn: string;
  content: { heading: string; body: string }[]; // cs
  contentEn: { heading: string; body: string }[];
  example: string;
  exampleEn: string;
  checklist: { id: string; title: string; titleEn: string }[];
  estimatedMinutes: number; // clearly an estimate
  contentOwner: string;
  reviewStatus: "draft" | "in_review" | "approved";
  version: number;
  isOnboardingPath: boolean;
}

export type TrainingProgressState = "not_started" | "in_progress" | "completed";

export interface TrainingProgress {
  moduleId: string;
  personId: UUID;
  state: TrainingProgressState;
  checklistDone: string[];
  completedAt: string | null;
  updatedAt: string;
}

// ---------- Support ----------
export type SupportCategory = "access" | "copilot" | "teams" | "vpn" | "hardware" | "training" | "other";
export type SupportStatus =
  | "captured"
  | "awaiting_official_ticket"
  | "with_linet_it"
  | "waiting_user"
  | "resolved";

export interface SupportTicket {
  id: UUID;
  projectId: UUID;
  title: string;
  category: SupportCategory;
  description: string;
  requesterId: UUID;
  coordinatorId: UUID | null;
  status: SupportStatus;
  impact: "low" | "medium" | "high";
  officialTicketRef: string | null; // user-recorded official reference — never fabricated
  followUpDate: string | null;
  attachmentNames: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SupportUpdate {
  id: UUID;
  ticketId: UUID;
  authorId: UUID;
  body: string;
  visibleToRequester: boolean;
  createdAt: string;
}

// ---------- Documents ----------
export interface DocumentRecord {
  id: UUID;
  projectId: UUID;
  title: string;
  category: "reference" | "procedure" | "training" | "meeting_notes" | "attachment" | "link";
  description: string;
  ownerId: UUID;
  updatedAt: string;
  workstreamId: UUID | null;
  url: string | null; // validated http(s) link when configured
  localSample: boolean; // demo renders local sample content instead of a broken link
  content: string | null; // rendered sample page for demo documents
}

// ---------- Notifications ----------
export interface Notification {
  id: UUID;
  personId: UUID;
  kind: "assigned" | "mention" | "deadline" | "action_approved" | "support" | "system";
  title: string;
  body: string;
  destination: string; // canonical route
  readAt: string | null;
  dedupeKey: string; // uniqueness against refresh duplicates
  createdAt: string;
}

// ---------- Integrations ----------
export type CapabilityState =
  | "configured"
  | "consent_required"
  | "connected"
  | "degraded"
  | "error"
  | "demo_simulation"
  | "not_configured";

export interface IntegrationStatus {
  id: "microsoft" | "ai" | "mail" | "supabase";
  state: CapabilityState;
  operations: string[];
  lastCheck: string | null;
  message: string;
}

export interface ExternalLink {
  id: UUID;
  provider: "planner" | "outlook";
  containerId: string | null; // plan/calendar id
  resourceId: string; // provider resource id (never title-based dedupe)
  etag: string | null; // provider version marker
  taskId: UUID | null;
  calendarEventId: UUID | null;
  lastSyncedAt: string | null;
  syncState: "pending" | "synced" | "conflict" | "error" | "source_unavailable";
}

// ---------- Backups ----------
export interface BackupPayload {
  format: "linet-workspace-backup";
  version: 1;
  exportedAt: string;
  dataMode: DataMode;
  data: Record<string, unknown[]>;
}

// ---------- Result pattern for services ----------
export type ServiceError =
  | { code: "not_found" }
  | { code: "forbidden"; message?: string }
  | { code: "validation"; issues: { path: string; message: string }[] }
  | { code: "conflict"; message: string }
  | { code: "not_configured"; capability: string; message: string }
  | { code: "storage_full"; message: string }
  | { code: "network"; message: string }
  | { code: "unknown"; message: string };

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: ServiceError };
