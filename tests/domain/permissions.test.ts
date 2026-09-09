import { describe, it, expect } from "vitest";
import { can, canUpdateTask, canViewSupportTicket } from "@/domain/permissions";
import type { Person, WorkspaceRole } from "@/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const PROJECT_ID = "d2000000-0000-4000-8000-000000000001";
const OWNER_ID = "d1000000-0000-4000-8000-000000000001";
const CREATOR_ID = "d1000000-0000-4000-8000-000000000002";
const LEAD_ID = "d1000000-0000-4000-8000-000000000003";
const ADMIN_ID = "d1000000-0000-4000-8000-000000000004";
const MEMBER_ID = "d1000000-0000-4000-8000-000000000005";
const VIEWER_ID = "d1000000-0000-4000-8000-000000000007";

function person(id: string, role: WorkspaceRole): Person {
  return { id, name: `Person ${role}`, email: `${role}@example.invalid`, initials: role.slice(0, 2).toUpperCase(), role, tz: "Europe/Prague" };
}

// ---------------------------------------------------------------------------
// can() matrix for 5 roles
// ---------------------------------------------------------------------------
describe("can() matrix", () => {
  const roles: WorkspaceRole[] = ["workspace_admin", "project_lead", "it_coordinator", "member", "viewer"];

  it("viewer can only task:view", () => {
    expect(can("viewer", "task:view")).toBe(true);
    expect(can("viewer", "task:create")).toBe(false);
    expect(can("viewer", "task:update:own")).toBe(false);
    expect(can("viewer", "comment:create")).toBe(false);
    expect(can("viewer", "support:create")).toBe(false);
    expect(can("viewer", "calendar:manage")).toBe(false);
  });

  it("member capabilities (subset)", () => {
    expect(can("member", "task:create")).toBe(true);
    expect(can("member", "task:update:own")).toBe(true);
    expect(can("member", "task:update:any")).toBe(false);
    expect(can("member", "task:complete")).toBe(true);
    expect(can("member", "task:assign")).toBe(false);
    expect(can("member", "task:archive")).toBe(true);
    expect(can("member", "task:view")).toBe(true);
    expect(can("member", "meeting:manage")).toBe(true);
    expect(can("member", "proposal:review")).toBe(true);
    expect(can("member", "support:view:any")).toBe(false);
    expect(can("member", "settings:manage_workspace")).toBe(false);
    expect(can("member", "member:manage")).toBe(false);
  });

  it("it_coordinator has support:view:any and support:coordinate", () => {
    expect(can("it_coordinator", "support:view:any")).toBe(true);
    expect(can("it_coordinator", "support:coordinate")).toBe(true);
    expect(can("it_coordinator", "support:view:own")).toBe(true);
    expect(can("it_coordinator", "task:update:any")).toBe(false);
    expect(can("it_coordinator", "task:update:own")).toBe(true);
    expect(can("it_coordinator", "workstream:manage")).toBe(false);
    expect(can("it_coordinator", "label:manage")).toBe(false);
    expect(can("it_coordinator", "training:manage")).toBe(true);
  });

  it("project_lead has task:update:any but NOT support:view:any", () => {
    expect(can("project_lead", "task:update:any")).toBe(true);
    expect(can("project_lead", "workstream:manage")).toBe(true);
    expect(can("project_lead", "label:manage")).toBe(true);
    expect(can("project_lead", "template:manage")).toBe(true);
    expect(can("project_lead", "decision:manage")).toBe(true);
    expect(can("project_lead", "support:view:any")).toBe(false);
    expect(can("project_lead", "support:coordinate")).toBe(false);
    expect(can("project_lead", "support:view:own")).toBe(true);
    expect(can("project_lead", "member:manage")).toBe(false);
  });

  it("workspace_admin has all major actions", () => {
    expect(can("workspace_admin", "task:create")).toBe(true);
    expect(can("workspace_admin", "task:update:any")).toBe(true);
    expect(can("workspace_admin", "task:delete")).toBe(true);
    expect(can("workspace_admin", "support:view:any")).toBe(true);
    expect(can("workspace_admin", "support:coordinate")).toBe(true);
    expect(can("workspace_admin", "settings:manage_workspace")).toBe(true);
    expect(can("workspace_admin", "member:manage")).toBe(true);
    expect(can("workspace_admin", "report:manage_schedules")).toBe(true);
    expect(can("workspace_admin", "document:manage")).toBe(true);
  });

  it("null/undefined role → false", () => {
    expect(can(null as unknown as WorkspaceRole, "task:view")).toBe(false);
    expect(can(undefined as unknown as WorkspaceRole, "task:view")).toBe(false);
  });

  it("full matrix snapshot for known actions", () => {
    // Spot-check a few cross-role expectations to guard regressions
    const matrix: Record<WorkspaceRole, string[]> = {
      workspace_admin: ["task:view", "task:create", "task:delete", "member:manage", "settings:manage_workspace"],
      project_lead: ["task:view", "task:create", "workstream:manage"],
      it_coordinator: ["task:view", "support:view:any", "support:coordinate"],
      member: ["task:view", "task:create"],
      viewer: ["task:view"],
    };
    for (const role of roles) {
      for (const action of matrix[role]) {
        expect(can(role, action as Parameters<typeof can>[1])).toBe(true);
      }
    }
    // viewer should not have anything beyond task:view
    expect(can("viewer", "task:create")).toBe(false);
    expect(can("viewer", "support:create")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canUpdateTask (owner/creator vs lead)
// ---------------------------------------------------------------------------
describe("canUpdateTask", () => {
  const taskOwnedByMember = { ownerId: MEMBER_ID, createdBy: CREATOR_ID, projectId: PROJECT_ID };
  const taskCreatedByMember = { ownerId: null, createdBy: MEMBER_ID, projectId: PROJECT_ID };
  const taskUnrelated = { ownerId: "other", createdBy: "other2", projectId: PROJECT_ID };
  const taskUnassigned = { ownerId: null, createdBy: CREATOR_ID, projectId: PROJECT_ID };

  it("owner can update own task (member role has task:update:own)", () => {
    const p = person(MEMBER_ID, "member");
    expect(canUpdateTask(p, taskOwnedByMember, PROJECT_ID)).toBe(true);
  });

  it("creator can update task they created (even if not owner)", () => {
    const p = person(MEMBER_ID, "member");
    expect(canUpdateTask(p, taskCreatedByMember, PROJECT_ID)).toBe(true);
  });

  it("member cannot update unrelated task", () => {
    const p = person(MEMBER_ID, "member");
    expect(canUpdateTask(p, taskUnrelated, PROJECT_ID)).toBe(false);
  });

  it("project_lead can update any task (task:update:any)", () => {
    const lead = person(LEAD_ID, "project_lead");
    expect(canUpdateTask(lead, taskUnrelated, PROJECT_ID)).toBe(true);
    expect(canUpdateTask(lead, taskUnassigned, PROJECT_ID)).toBe(true);
  });

  it("workspace_admin can update any task", () => {
    const admin = person(ADMIN_ID, "workspace_admin");
    expect(canUpdateTask(admin, taskUnrelated, PROJECT_ID)).toBe(true);
  });

  it("it_coordinator can update own/created but not any", () => {
    const it = person(OWNER_ID, "it_coordinator");
    const own = { ownerId: OWNER_ID, createdBy: CREATOR_ID, projectId: PROJECT_ID };
    const ownCreated = { ownerId: null, createdBy: OWNER_ID, projectId: PROJECT_ID };
    expect(canUpdateTask(it, own, PROJECT_ID)).toBe(true);
    expect(canUpdateTask(it, ownCreated, PROJECT_ID)).toBe(true);
    expect(canUpdateTask(it, taskUnrelated, PROJECT_ID)).toBe(false);
  });

  it("viewer cannot update even own task (no task:update:own)", () => {
    const viewer = person(VIEWER_ID, "viewer");
    const own = { ownerId: VIEWER_ID, createdBy: VIEWER_ID, projectId: PROJECT_ID };
    expect(canUpdateTask(viewer, own, PROJECT_ID)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// canViewSupportTicket privacy
// ---------------------------------------------------------------------------
describe("canViewSupportTicket", () => {
  const requesterId = "req-0000-0000-0000-000000000001";
  const coordinatorId = "coord-0000-0000-0000-000000000001";
  const adminId2 = ADMIN_ID;
  const leadId2 = LEAD_ID;
  const itCoordId = OWNER_ID; // it_coordinator
  const strangerId = "stranger-0000-0000-000000000001";

  const ticket = { requesterId, coordinatorId };
  const ticketUnassigned = { requesterId, coordinatorId: null };

  it("requester can view own ticket", () => {
    const p = person(requesterId, "member");
    expect(canViewSupportTicket(p, ticket)).toBe(true);
    expect(canViewSupportTicket(p, ticketUnassigned)).toBe(true);
  });

  it("assigned coordinator can view (member coordinator)", () => {
    const p = person(coordinatorId, "member");
    expect(canViewSupportTicket(p, ticket)).toBe(true);
  });

  it("workspace_admin can view any", () => {
    const admin = person(adminId2, "workspace_admin");
    expect(canViewSupportTicket(admin, ticket)).toBe(true);
    expect(canViewSupportTicket(admin, ticketUnassigned)).toBe(true);
    // even stranger ticket
    expect(canViewSupportTicket(admin, { requesterId: strangerId, coordinatorId: null })).toBe(true);
  });

  it("it_coordinator can view queue (any ticket)", () => {
    const it = person(itCoordId, "it_coordinator");
    expect(canViewSupportTicket(it, ticket)).toBe(true);
    expect(canViewSupportTicket(it, ticketUnassigned)).toBe(true);
    expect(canViewSupportTicket(it, { requesterId: strangerId, coordinatorId: null })).toBe(true);
  });

  it("project_lead cannot view other people's private cases (no support:view:any)", () => {
    const lead = person(leadId2, "project_lead");
    expect(canViewSupportTicket(lead, ticket)).toBe(false);
    expect(canViewSupportTicket(lead, ticketUnassigned)).toBe(false);
  });

  it("project_lead can view own request", () => {
    const lead = person(leadId2, "project_lead");
    const ownTicket = { requesterId: leadId2, coordinatorId: null };
    expect(canViewSupportTicket(lead, ownTicket)).toBe(true);
  });

  it("project_lead assigned as coordinator can view", () => {
    const lead = person(leadId2, "project_lead");
    const assigned = { requesterId, coordinatorId: leadId2 };
    expect(canViewSupportTicket(lead, assigned)).toBe(true);
  });

  it("stranger member cannot view", () => {
    const stranger = person(strangerId, "member");
    expect(canViewSupportTicket(stranger, ticket)).toBe(false);
  });

  it("viewer stranger cannot view", () => {
    const v = person(strangerId, "viewer");
    expect(canViewSupportTicket(v, ticket)).toBe(false);
  });

  it("sanitizedBlockerPublications allows explicit viewer", () => {
    const stranger = person(strangerId, "member");
    expect(canViewSupportTicket(stranger, ticket, [strangerId])).toBe(true);
    expect(canViewSupportTicket(stranger, ticket, ["other-id"])).toBe(false);
  });

  it("privacy: member not in blocker list denied even if they know ticket id", () => {
    const m = person(MEMBER_ID, "member");
    expect(canViewSupportTicket(m, { requesterId, coordinatorId: null }, [])).toBe(false);
  });
});
