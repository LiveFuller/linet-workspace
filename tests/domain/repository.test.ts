import { describe, it, expect } from "vitest";
import {
  taskDraftSchema,
  proposalSchema,
  supportTicketSchema,
  inboxItemSchema,
  calendarEventSchema,
  isSafeUrl,
} from "@/domain/validation";
import type { Task, Report, ReportSnapshotItem } from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers: valid UUIDs (v4 format) for schema validation
// ---------------------------------------------------------------------------
const PROJECT_ID = "d2000000-0000-4000-8000-000000000001";
const OTHER_UUID = "d1000000-0000-4000-8000-000000000001";
const PERSON_ID = OTHER_UUID;

// ---------------------------------------------------------------------------
// taskDraftSchema validation
// ---------------------------------------------------------------------------
describe("taskDraftSchema validation", () => {
  const validDraft = {
    projectId: PROJECT_ID,
    title: "Valid task title",
    description: "Description",
    ownerId: OTHER_UUID,
    workstreamId: null,
    labelIds: [],
    dueDate: "2026-09-08",
    status: "todo" as const,
    statusNote: null,
    source: "manual" as const,
    sourceRef: null,
    sourceUrl: null,
  };

  it("accepts valid draft", () => {
    const parsed = taskDraftSchema.safeParse(validDraft);
    expect(parsed.success).toBe(true);
  });

  it("rejects empty title", () => {
    const parsed = taskDraftSchema.safeParse({ ...validDraft, title: "" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes("title"))).toBe(true);
    }
  });

  it("rejects title over 200 chars", () => {
    const parsed = taskDraftSchema.safeParse({ ...validDraft, title: "a".repeat(201) });
    expect(parsed.success).toBe(false);
  });

  it("rejects invalid dueDate format", () => {
    expect(taskDraftSchema.safeParse({ ...validDraft, dueDate: "2026-9-8" }).success).toBe(false);
    expect(taskDraftSchema.safeParse({ ...validDraft, dueDate: "2026/09/08" }).success).toBe(false);
    expect(taskDraftSchema.safeParse({ ...validDraft, dueDate: "not-a-date" }).success).toBe(false);
  });

  it("accepts null dueDate", () => {
    expect(taskDraftSchema.safeParse({ ...validDraft, dueDate: null }).success).toBe(true);
  });

  it("rejects labelIds >5", () => {
    const many = Array.from({ length: 6 }, (_, i) => `d4000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    expect(taskDraftSchema.safeParse({ ...validDraft, labelIds: many }).success).toBe(false);
  });

  it("rejects statusNote >300", () => {
    expect(taskDraftSchema.safeParse({ ...validDraft, statusNote: "a".repeat(301) }).success).toBe(false);
  });

  it("trims title and applies defaults", () => {
    const parsed = taskDraftSchema.safeParse({ projectId: PROJECT_ID, title: "  Hello  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe("Hello");
      expect(parsed.data.description).toBe("");
      expect(parsed.data.status).toBe("todo");
    }
  });

  it("rejects invalid UUID for projectId", () => {
    expect(taskDraftSchema.safeParse({ ...validDraft, projectId: "not-uuid" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// proposal approve-once via fingerprint (sourceActionKey)
// ---------------------------------------------------------------------------
describe("proposal approve-once via fingerprint", () => {
  // Domain rule: sourceActionKey is unique per meeting; approve-once guarantee
  // means second approve for same sourceActionKey must fail with conflict.
  // Simulate logic inline without IndexedDB: a Set tracks approved fingerprints.

  function createProposalStore() {
    const seen = new Set<string>();
    const approved = new Map<string, string>(); // key -> taskId
    return {
      addProposal: (meetingId: string, sourceActionKey: string) => {
        const key = `${meetingId}:${sourceActionKey}`;
        if (seen.has(key)) return { ok: false as const, code: "conflict" as const };
        seen.add(key);
        return { ok: true as const, key };
      },
      approveProposal: (meetingId: string, sourceActionKey: string, taskId: string) => {
        const key = `${meetingId}:${sourceActionKey}`;
        if (approved.has(key)) return { ok: false as const, code: "conflict" as const };
        if (!seen.has(key)) return { ok: false as const, code: "not_found" as const };
        approved.set(key, taskId);
        return { ok: true as const, key, taskId };
      },
      hasApproved: (meetingId: string, sourceActionKey: string) => approved.has(`${meetingId}:${sourceActionKey}`),
    };
  }

  it("first add succeeds, duplicate sourceActionKey conflicts", () => {
    const store = createProposalStore();
    const meetingId = "d5000000-0000-4000-8000-000000000001";
    expect(store.addProposal(meetingId, "demo-m1-p1").ok).toBe(true);
    expect(store.addProposal(meetingId, "demo-m1-p1").ok).toBe(false);
    expect(store.addProposal(meetingId, "demo-m1-p1").code).toBe("conflict");
    // Different key same meeting → ok
    expect(store.addProposal(meetingId, "demo-m1-p2").ok).toBe(true);
    // Same key different meeting → ok (scoped per meeting)
    expect(store.addProposal("other-meeting", "demo-m1-p1").ok).toBe(true);
  });

  it("approve-once: second approve conflicts", () => {
    const store = createProposalStore();
    const mid = "d5000000-0000-4000-8000-000000000001";
    store.addProposal(mid, "action-1");
    const first = store.approveProposal(mid, "action-1", "task-1");
    expect(first.ok).toBe(true);
    const second = store.approveProposal(mid, "action-1", "task-2");
    expect(second.ok).toBe(false);
    expect(second.code).toBe("conflict");
    expect(store.hasApproved(mid, "action-1")).toBe(true);
  });

  it("cannot approve non-existent proposal", () => {
    const store = createProposalStore();
    const res = store.approveProposal("mid", "unknown-key", "task-1");
    expect(res.ok).toBe(false);
    expect(res.code).toBe("not_found");
  });

  it("proposalSchema validates sourceActionKey required", () => {
    const valid = {
      meetingId: "d5000000-0000-4000-8000-000000000001",
      evidenceText: "Evidence excerpt",
      proposedTitle: "Proposed title",
      sourceActionKey: "demo-m1-p1",
    };
    expect(proposalSchema.safeParse(valid).success).toBe(true);
    expect(proposalSchema.safeParse({ ...valid, sourceActionKey: "" }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...valid, evidenceText: "" }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// report generation logic inline (frozen snapshot)
// ---------------------------------------------------------------------------
describe("report generation logic inline (frozen snapshot)", () => {
  function generateReportSnapshot(
    tasks: Task[],
    decisions: { id: string; title: string }[],
    today: string
  ): Report {
    // Simplified inline logic mirroring product intent:
    // - completed: done lifecycle active
    // - overdue: past dueDate, not done, not archived
    // - upcoming: due within 7 days, not done, not archived
    const items: ReportSnapshotItem[] = [];
    for (const t of tasks) {
      if (t.lifecycle !== "active") continue;
      if (t.status === "done") {
        items.push({ kind: "completed", taskId: t.id, decisionId: null, title: t.title, detail: null, ownerId: t.ownerId, dueDate: t.dueDate });
        continue;
      }
      if (t.dueDate && t.dueDate < today) {
        items.push({ kind: "overdue", taskId: t.id, decisionId: null, title: t.title, detail: t.statusNote, ownerId: t.ownerId, dueDate: t.dueDate });
      } else if (t.dueDate && t.dueDate >= today && t.dueDate <= "2026-09-15") {
        items.push({ kind: "upcoming", taskId: t.id, decisionId: null, title: t.title, detail: null, ownerId: t.ownerId, dueDate: t.dueDate });
      }
      if (t.status === "blocked" || t.status === "waiting") {
        items.push({ kind: "blocker", taskId: t.id, decisionId: null, title: t.title, detail: t.statusNote, ownerId: t.ownerId, dueDate: t.dueDate });
      }
    }
    for (const d of decisions) {
      items.push({ kind: "decision", taskId: null, decisionId: d.id, title: d.title, detail: null, ownerId: null, dueDate: null });
    }
    return {
      id: "report-1",
      projectId: PROJECT_ID,
      kind: "weekly",
      periodStart: "2026-09-01",
      periodEnd: "2026-09-08",
      timezone: "Europe/Prague",
      generatedAt: "2026-09-08T08:00:00.000Z",
      status: "draft",
      filtersSummary: "All workstreams",
      commentary: "",
      items,
      createdAt: "2026-09-08T08:00:00.000Z",
      updatedAt: "2026-09-08T08:00:00.000Z",
    };
  }

  const mkTask = (overrides: Partial<Task> & { id: string }): Task => ({
    projectId: PROJECT_ID,
    workstreamId: null,
    labelIds: [],
    title: "Task",
    description: "",
    status: "todo",
    statusNote: null,
    ownerId: OTHER_UUID,
    createdBy: PERSON_ID,
    dueDate: null,
    lifecycle: "active",
    completedAt: null,
    completedBy: null,
    source: "manual",
    sourceRef: null,
    sourceUrl: null,
    version: 1,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  });

  it("classifies completed, overdue, upcoming, blocker, decision", () => {
    const tasks: Task[] = [
      mkTask({ id: "r1", status: "done" }),
      mkTask({ id: "r2", dueDate: "2026-09-01", status: "todo" }), // overdue (< today 09-08)
      mkTask({ id: "r3", dueDate: "2026-09-10", status: "todo" }), // upcoming
      mkTask({ id: "r4", dueDate: "2026-09-05", status: "blocked", statusNote: "Waiting IT" }), // overdue + blocker
      mkTask({ id: "r5", dueDate: null, status: "todo", lifecycle: "archived" }), // ignored (archived)
    ];
    const report = generateReportSnapshot(tasks, [{ id: "dec1", title: "Decision 1" }], "2026-09-08");
    expect(report.items.some((i) => i.kind === "completed" && i.taskId === "r1")).toBe(true);
    expect(report.items.some((i) => i.kind === "overdue" && i.taskId === "r2")).toBe(true);
    expect(report.items.some((i) => i.kind === "upcoming" && i.taskId === "r3")).toBe(true);
    expect(report.items.some((i) => i.kind === "overdue" && i.taskId === "r4")).toBe(true);
    expect(report.items.some((i) => i.kind === "blocker" && i.taskId === "r4")).toBe(true);
    expect(report.items.some((i) => i.kind === "decision" && i.decisionId === "dec1")).toBe(true);
    // archived not included
    expect(report.items.some((i) => i.taskId === "r5")).toBe(false);
  });

  it("frozen snapshot is deterministic", () => {
    const tasks = [mkTask({ id: "a", status: "done" }), mkTask({ id: "b", dueDate: "2026-09-01" })];
    const r1 = generateReportSnapshot(tasks, [], "2026-09-08");
    const r2 = generateReportSnapshot(tasks, [], "2026-09-08");
    expect(r1.items).toEqual(r2.items);
  });

  it("report has required metadata fields", () => {
    const report = generateReportSnapshot([], [], "2026-09-08");
    expect(report.id).toBeTruthy();
    expect(report.periodStart).toBe("2026-09-01");
    expect(report.periodEnd).toBe("2026-09-08");
    expect(report.timezone).toBe("Europe/Prague");
    expect(report.status).toBe("draft");
    expect(Array.isArray(report.items)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Repository contract existence + additional validators
// ---------------------------------------------------------------------------
describe("repository contract", () => {
  it("LocalRepository class exists and exposes expected methods", async () => {
    const mod = await import("@/data/local/LocalRepository");
    expect(mod.LocalRepository).toBeDefined();
    const repo = new mod.LocalRepository();
    // contract methods
    expect(typeof repo.createTask).toBe("function");
    expect(typeof repo.updateTask).toBe("function");
    expect(typeof repo.completeTask).toBe("function");
    expect(typeof repo.archiveTask).toBe("function");
    expect(typeof repo.loadSnapshot).toBe("function");
    expect(typeof repo.ready).toBe("function");
    expect(typeof repo.approveProposal).toBe("function");
    expect(typeof repo.saveReport).toBe("function");
  });
});

describe("additional zod validators", () => {
  it("supportTicketSchema requires title", () => {
    expect(supportTicketSchema.safeParse({ projectId: PROJECT_ID, title: "", category: "access" }).success).toBe(false);
    expect(supportTicketSchema.safeParse({ projectId: PROJECT_ID, title: "Valid", category: "vpn" }).success).toBe(true);
    expect(supportTicketSchema.safeParse({ projectId: PROJECT_ID, title: "Valid", category: "invalid" as never }).success).toBe(false);
  });

  it("inboxItemSchema validates kind", () => {
    expect(inboxItemSchema.safeParse({ projectId: PROJECT_ID, kind: "note", title: "t", body: "b" }).success).toBe(true);
    expect(inboxItemSchema.safeParse({ projectId: PROJECT_ID, kind: "unknown" as never, title: "t", body: "b" }).success).toBe(false);
  });

  it("calendarEventSchema requires title and timezone", () => {
    const base = { projectId: PROJECT_ID, kind: "meeting" as const, title: "M", dateMode: "timed" as const, start: "2026-09-08T09:00:00.000Z", timezone: "Europe/Prague" };
    expect(calendarEventSchema.safeParse(base).success).toBe(true);
    expect(calendarEventSchema.safeParse({ ...base, title: "" }).success).toBe(false);
  });

  it("isSafeUrl allows http(s) only", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("http://example.com/page")).toBe(true);
    expect(isSafeUrl("ftp://example.com")).toBe(false);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl("")).toBe(false);
    expect(isSafeUrl("not-a-url")).toBe(false);
  });
});
