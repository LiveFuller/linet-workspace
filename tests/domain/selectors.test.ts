import { describe, it, expect } from "vitest";
import { isOverdue, filterTasks, workloadFor } from "@/domain/selectors";
import type { Task, Person } from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PROJECT_ID = "d2000000-0000-4000-8000-000000000001";
const VIEWER_ID = "d1000000-0000-4000-8000-000000000001";
const OTHER_ID = "d1000000-0000-4000-8000-000000000002";

function mkTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    projectId: PROJECT_ID,
    workstreamId: null,
    labelIds: [],
    title: "Test task",
    description: "",
    status: "todo",
    statusNote: null,
    ownerId: VIEWER_ID,
    createdBy: VIEWER_ID,
    dueDate: null,
    lifecycle: "active",
    completedAt: null,
    completedBy: null,
    source: "manual",
    sourceRef: null,
    sourceUrl: null,
    version: 1,
    createdAt: "2026-09-01T08:00:00.000Z",
    updatedAt: "2026-09-01T08:00:00.000Z",
    ...overrides,
  };
}

function mkPerson(id: string, role: Person["role"] = "member"): Person {
  return {
    id,
    name: "Test Person",
    email: "test@example.invalid",
    initials: "TP",
    role,
    tz: "Europe/Prague",
  };
}

// ---------------------------------------------------------------------------
// isOverdue
// ---------------------------------------------------------------------------
describe("isOverdue", () => {
  const today = "2026-09-08";

  it("undated not overdue", () => {
    const t = mkTask({ id: "t1", dueDate: null });
    expect(isOverdue(t, today)).toBe(false);
  });

  it("archived not overdue even if past date", () => {
    const t = mkTask({ id: "t2", dueDate: "2026-09-01", lifecycle: "archived" });
    expect(isOverdue(t, today)).toBe(false);
  });

  it("done not overdue even if past date", () => {
    const t = mkTask({ id: "t3", dueDate: "2026-09-01", status: "done" });
    expect(isOverdue(t, today)).toBe(false);
  });

  it("past date overdue", () => {
    const t = mkTask({ id: "t4", dueDate: "2026-09-07" });
    expect(isOverdue(t, today)).toBe(true);
    expect(isOverdue(mkTask({ id: "t5", dueDate: "2026-09-01" }), today)).toBe(true);
  });

  it("today not overdue", () => {
    const t = mkTask({ id: "t6", dueDate: "2026-09-08" });
    expect(isOverdue(t, today)).toBe(false);
  });

  it("future not overdue", () => {
    const t = mkTask({ id: "t7", dueDate: "2026-09-09" });
    expect(isOverdue(t, today)).toBe(false);
  });

  it("invalid date not overdue", () => {
    const t = mkTask({ id: "t8", dueDate: "not-a-date" });
    expect(isOverdue(t, today)).toBe(false);
  });

  it("blocked/waiting with past date is overdue (still active)", () => {
    expect(isOverdue(mkTask({ id: "t9", dueDate: "2026-09-01", status: "blocked" }), today)).toBe(true);
    expect(isOverdue(mkTask({ id: "t10", dueDate: "2026-09-01", status: "waiting" }), today)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// filterTasks views (my/all/overdue/waiting)
// ---------------------------------------------------------------------------
describe("filterTasks", () => {
  const today = "2026-09-08";
  const tasks: Task[] = [
    mkTask({ id: "a1", ownerId: VIEWER_ID, status: "todo", dueDate: "2026-09-07" }), // overdue, mine
    mkTask({ id: "a2", ownerId: VIEWER_ID, status: "todo", dueDate: "2026-09-09" }), // mine, not overdue
    mkTask({ id: "a3", ownerId: OTHER_ID, status: "todo", dueDate: "2026-09-06" }), // overdue, other
    mkTask({ id: "a4", ownerId: OTHER_ID, status: "waiting", dueDate: "2026-09-10" }), // other waiting
    mkTask({ id: "a5", ownerId: VIEWER_ID, status: "blocked", dueDate: "2026-09-10" }), // mine blocked
    mkTask({ id: "a6", ownerId: null, status: "todo", dueDate: null }), // unassigned, undated
    mkTask({ id: "a7", ownerId: VIEWER_ID, status: "done", dueDate: "2026-09-01" }), // done, not counted in active views except completed
    mkTask({ id: "a8", ownerId: VIEWER_ID, status: "todo", dueDate: "2026-09-01", lifecycle: "archived" }), // archived
    mkTask({ id: "a9", ownerId: OTHER_ID, status: "blocked", dueDate: null }), // other blocked undated
  ];

  it('view "my" → only viewer unfinished active tasks', () => {
    const res = filterTasks(tasks, { view: "my" }, VIEWER_ID, today);
    const ids = res.map((t) => t.id).sort();
    expect(ids).toEqual(["a1", "a2", "a5"].sort());
  });

  it('view "all" → all unfinished active tasks', () => {
    const res = filterTasks(tasks, { view: "all" }, VIEWER_ID, today);
    const ids = res.map((t) => t.id).sort();
    // excludes a7 done, a8 archived
    expect(ids).toEqual(["a1", "a2", "a3", "a4", "a5", "a6", "a9"].sort());
  });

  it('view "overdue" → only overdue active tasks', () => {
    const res = filterTasks(tasks, { view: "overdue" }, VIEWER_ID, today);
    const ids = res.map((t) => t.id).sort();
    expect(ids).toEqual(["a1", "a3"].sort());
  });

  it('view "waiting" → waiting or blocked active', () => {
    const res = filterTasks(tasks, { view: "waiting" }, VIEWER_ID, today);
    const ids = res.map((t) => t.id).sort();
    expect(ids).toEqual(["a4", "a5", "a9"].sort());
  });

  it('view "unassigned" → null owner unfinished', () => {
    const res = filterTasks(tasks, { view: "unassigned" }, VIEWER_ID, today);
    expect(res.map((t) => t.id)).toEqual(["a6"]);
  });

  it('view "completed" → done active only', () => {
    const res = filterTasks(tasks, { view: "completed" }, VIEWER_ID, today);
    expect(res.map((t) => t.id)).toEqual(["a7"]);
  });

  it("view undefined → no view filter, just active (includes done active)", () => {
    const res = filterTasks(tasks, {}, VIEWER_ID, today);
    // No view: filters only by lifecycle === active, so done active a7 IS included
    const ids = res.map((t) => t.id).sort();
    expect(ids).toEqual(["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a9"].sort());
  });

  it("additional filter: query", () => {
    const withTitles: Task[] = [
      mkTask({ id: "q1", title: "Zařídit přístup", ownerId: VIEWER_ID }),
      mkTask({ id: "q2", title: "Prepare report", ownerId: VIEWER_ID }),
    ];
    const res = filterTasks(withTitles, { query: "zaridit" }, VIEWER_ID, today);
    expect(res.map((t) => t.id)).toEqual(["q1"]);
  });

  it("additional filter: ownerId", () => {
    const res = filterTasks(tasks, { view: "all", ownerId: VIEWER_ID }, VIEWER_ID, today);
    // my tasks that are also in "all" + owner filter
    const ids = res.map((t) => t.id).sort();
    expect(ids).toEqual(["a1", "a2", "a5"].sort());
  });

  it("status filter", () => {
    const res = filterTasks(tasks, { status: "blocked" }, VIEWER_ID, today);
    // active + blocked
    expect(res.map((t) => t.id).sort()).toEqual(["a5", "a9"].sort());
  });
});

// Additional check: ensure no-view includes active done tasks (to document behavior)
describe("filterTasks no-view includes done active tasks", () => {
  it("documents current behavior", () => {
    const today = "2026-09-08";
    const t: Task[] = [
      mkTask({ id: "x1", status: "todo" }),
      mkTask({ id: "x2", status: "done" }),
    ];
    const noView = filterTasks(t, {}, VIEWER_ID, today);
    // Implementation: without view, no status filtering → both active tasks returned
    expect(noView.map((x) => x.id).sort()).toEqual(["x1", "x2"].sort());
    const allView = filterTasks(t, { view: "all" }, VIEWER_ID, today);
    expect(allView.map((x) => x.id)).toEqual(["x1"]);
  });
});

// ---------------------------------------------------------------------------
// workloadFor counts
// ---------------------------------------------------------------------------
describe("workloadFor", () => {
  const today = "2026-09-08";
  const person = mkPerson(VIEWER_ID);

  it("counts unfinished due this week, overdue, blocked", () => {
    const tasks: Task[] = [
      mkTask({ id: "w1", ownerId: VIEWER_ID, dueDate: "2026-09-08", status: "todo" }), // today → in week
      mkTask({ id: "w2", ownerId: VIEWER_ID, dueDate: "2026-09-15", status: "todo" }), // +7 → in week (inclusive)
      mkTask({ id: "w3", ownerId: VIEWER_ID, dueDate: "2026-09-16", status: "todo" }), // +8 → outside week
      mkTask({ id: "w4", ownerId: VIEWER_ID, dueDate: "2026-09-01", status: "todo" }), // overdue
      mkTask({ id: "w5", ownerId: VIEWER_ID, dueDate: "2026-09-10", status: "blocked" }), // blocked + in week
      mkTask({ id: "w6", ownerId: VIEWER_ID, dueDate: null, status: "waiting" }), // waiting, undated → not week, not overdue
      mkTask({ id: "w7", ownerId: OTHER_ID, dueDate: "2026-09-09", status: "todo" }), // other person → ignored
      mkTask({ id: "w8", ownerId: VIEWER_ID, dueDate: "2026-09-09", status: "done" }), // done → ignored
      mkTask({ id: "w9", ownerId: VIEWER_ID, dueDate: "2026-09-02", lifecycle: "archived", status: "todo" }), // archived → ignored
    ];

    const wl = workloadFor(person, tasks, today);
    expect(wl.personId).toBe(VIEWER_ID);
    // week: w1, w2, w5 (diff 0,7,2) → 3
    expect(wl.unfinishedDueThisWeek).toBe(3);
    // overdue: w4 only (done excluded, undated excluded, future excluded)
    expect(wl.overdueCount).toBe(1);
    expect(wl.overdueTaskIds).toEqual(["w4"]);
    // blocked: w5, w6
    expect(wl.blockedCount).toBe(2);
    expect(wl.blockedTaskIds.sort()).toEqual(["w5", "w6"].sort());
    // taskIds: all active unfinished owned by person → w1,w2,w3,w4,w5,w6
    expect(wl.taskIds.sort()).toEqual(["w1", "w2", "w3", "w4", "w5", "w6"].sort());
  });

  it("empty tasks → zero counts", () => {
    const wl = workloadFor(person, [], today);
    expect(wl.unfinishedDueThisWeek).toBe(0);
    expect(wl.overdueCount).toBe(0);
    expect(wl.blockedCount).toBe(0);
    expect(wl.taskIds).toEqual([]);
  });

  it("unassigned and other-owner not counted", () => {
    const tasks: Task[] = [
      mkTask({ id: "u1", ownerId: null, dueDate: "2026-09-08" }),
      mkTask({ id: "u2", ownerId: OTHER_ID, dueDate: "2026-09-08" }),
    ];
    const wl = workloadFor(person, tasks, today);
    expect(wl.taskIds).toEqual([]);
    expect(wl.unfinishedDueThisWeek).toBe(0);
  });
});
