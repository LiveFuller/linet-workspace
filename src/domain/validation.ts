// Zod validation for persisted entities. Both repositories validate on write.
import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const taskStatusSchema = z.enum(["todo", "in_progress", "waiting", "blocked", "done"]);
export const taskSourceSchema = z.enum([
  "manual", "meeting_action", "email_capture", "inbox_triage", "quick_capture", "template", "external_sync",
]);
export const taskLifecycleSchema = z.enum(["active", "archived"]);

export const taskDraftSchema = z.object({
  projectId: uuidSchema,
  title: z.string().trim().min(1, "Název je povinný / Title is required").max(200),
  description: z.string().max(4000).default(""),
  ownerId: uuidSchema.nullable().default(null),
  workstreamId: uuidSchema.nullable().default(null),
  labelIds: z.array(uuidSchema).max(5).default([]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum ve formátu DD.MM.RRRR / date format").nullable().default(null),
  status: taskStatusSchema.default("todo"),
  statusNote: z.string().max(300).nullable().default(null),
  source: taskSourceSchema.default("manual"),
  sourceRef: z.string().max(200).nullable().default(null),
  sourceUrl: z.string().max(500).nullable().default(null),
});

export type TaskDraft = z.infer<typeof taskDraftSchema>;

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(4000).optional(),
  ownerId: uuidSchema.nullable().optional(),
  workstreamId: uuidSchema.nullable().optional(),
  labelIds: z.array(uuidSchema).max(5).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: taskStatusSchema.optional(),
  statusNote: z.string().max(300).nullable().optional(),
  expectedVersion: z.number().int().nonnegative(),
  reason: z.string().max(300).optional(),
});

export type TaskUpdate = z.infer<typeof taskUpdateSchema>;

export const checklistItemSchema = z.object({
  taskId: uuidSchema,
  title: z.string().trim().min(1).max(200),
});

export const commentSchema = z.object({
  taskId: uuidSchema,
  body: z.string().trim().min(1, "Text komentáře je povinný / Comment text required").max(2000),
});

export const meetingSchema = z.object({
  projectId: uuidSchema,
  title: z.string().trim().min(1).max(200),
  startsAt: z.string().datetime({ offset: true }),
  durationMin: z.number().int().min(5).max(600).default(60),
  workstreamId: uuidSchema.nullable().default(null),
  agenda: z.string().max(3000).default(""),
  participants: z.array(uuidSchema).max(30).default([]),
});

export const proposalSchema = z.object({
  meetingId: uuidSchema,
  evidenceText: z.string().min(1).max(2000),
  proposedTitle: z.string().trim().min(1).max(200),
  proposedOwnerId: uuidSchema.nullable().default(null),
  proposedDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  sourceActionKey: z.string().min(1).max(120),
});

export const supportTicketSchema = z.object({
  projectId: uuidSchema,
  title: z.string().trim().min(1).max(200),
  category: z.enum(["access", "copilot", "teams", "vpn", "hardware", "training", "other"]),
  description: z.string().max(4000).default(""),
  impact: z.enum(["low", "medium", "high"]).default("medium"),
});

export const inboxItemSchema = z.object({
  projectId: uuidSchema,
  kind: z.enum(["note", "email", "transcript", "link", "file", "voice"]),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(200000),
  sourceMessageId: z.string().max(300).nullable().default(null),
});

export const calendarEventSchema = z.object({
  projectId: uuidSchema,
  kind: z.enum(["meeting", "focus_block", "deadline_marker"]),
  title: z.string().trim().min(1).max(200),
  dateMode: z.enum(["date_only", "timed"]),
  start: z.string(), // date or instant depending on mode
  end: z.string().nullable().default(null),
  durationMin: z.number().int().min(0).max(1440).nullable().default(null),
  allDay: z.boolean().default(false),
  timezone: z.string().max(64),
  linkedTaskId: uuidSchema.nullable().default(null),
  location: z.string().max(200).nullable().default(null),
  meetingId: uuidSchema.nullable().default(null),
});

export const documentSchema = z.object({
  projectId: uuidSchema,
  title: z.string().trim().min(1).max(200),
  category: z.enum(["reference", "procedure", "training", "meeting_notes", "attachment", "link"]),
  description: z.string().max(1000).default(""),
  workstreamId: uuidSchema.nullable().default(null),
  url: z.string().max(500).nullable().default(null),
  content: z.string().max(50000).nullable().default(null),
});

export const reportScheduleSchema = z.object({
  projectId: uuidSchema,
  kind: z.enum(["daily", "weekly"]),
  cadence: z.enum(["daily", "weekly"]),
  timezone: z.string().max(64),
  sendAtLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  channel: z.enum(["in_app", "email"]),
  recipients: z.array(z.string().email().or(z.literal(""))).max(20),
  enabled: z.boolean().default(false),
});

export const trainingProgressSchema = z.object({
  moduleId: z.string().min(1).max(60),
  state: z.enum(["not_started", "in_progress", "completed"]),
  checklistDone: z.array(z.string().max(60)).max(40),
});

export function zodIssuesToServiceError(err: z.ZodError): {
  ok: false;
  error: { code: "validation"; issues: { path: string; message: string }[] };
} {
  return {
    ok: false,
    error: {
      code: "validation",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    },
  };
}

/** Allowed URL schemes for user-supplied links. */
export function isSafeUrl(u: string | null | undefined): boolean {
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
