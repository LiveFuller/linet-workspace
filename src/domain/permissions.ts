// LINET Workspace — permission model. Explicit matrix, enforced in domain services,
// local simulation AND live RLS (see supabase/setup.sql). Never implied by hidden buttons.
import type { Person, WorkspaceRole, UUID } from "./types";

export type Action =
  | "task:create"
  | "task:update:own" // owner or creator, within policy
  | "task:update:any" // manage project tasks
  | "task:complete"
  | "task:assign"
  | "task:archive"
  | "task:delete"
  | "task:view"
  | "comment:create"
  | "workstream:manage"
  | "label:manage"
  | "template:manage"
  | "meeting:manage"
  | "meeting:review"
  | "proposal:review"
  | "decision:manage"
  | "report:generate"
  | "report:manage_schedules"
  | "training:manage"
  | "training:view_overview"
  | "support:create"
  | "support:view:own"
  | "support:view:any" // coordinator/admin; NOT automatic for project lead
  | "support:coordinate" // manage queue, assign coordinators
  | "document:manage"
  | "notification:manage"
  | "settings:manage_workspace"
  | "member:manage"
  | "calendar:manage";

const MATRIX: Record<WorkspaceRole, Action[]> = {
  workspace_admin: [
    "task:create", "task:update:own", "task:update:any", "task:complete", "task:assign",
    "task:archive", "task:delete", "task:view", "comment:create", "workstream:manage",
    "label:manage", "template:manage", "meeting:manage", "meeting:review", "proposal:review",
    "decision:manage", "report:generate", "report:manage_schedules", "training:manage",
    "training:view_overview", "support:create", "support:view:own", "support:view:any",
    "support:coordinate", "document:manage", "notification:manage",
    "settings:manage_workspace", "member:manage", "calendar:manage",
  ],
  project_lead: [
    "task:create", "task:update:own", "task:update:any", "task:complete", "task:assign",
    "task:archive", "task:view", "comment:create", "workstream:manage", "label:manage",
    "template:manage", "meeting:manage", "meeting:review", "proposal:review",
    "decision:manage", "report:generate", "report:manage_schedules", "training:manage",
    "training:view_overview", "support:create", "support:view:own", "document:manage",
    "notification:manage", "calendar:manage",
    // deliberately NO support:view:any — no automatic access to private support cases
  ],
  it_coordinator: [
    "task:create", "task:update:own", "task:complete", "task:assign", "task:archive",
    "task:view", "comment:create", "meeting:manage", "meeting:review", "proposal:review",
    "report:generate", "training:manage", "training:view_overview", "support:create",
    "support:view:own", "support:view:any", "support:coordinate", "document:manage",
    "calendar:manage",
  ],
  member: [
    "task:create", "task:update:own", "task:complete", "task:archive", "task:view",
    "comment:create", "meeting:manage", "meeting:review", "proposal:review",
    "support:create", "support:view:own", "calendar:manage", "report:generate",
  ],
  viewer: [
    "task:view",
  ],
};

export function can(role: WorkspaceRole | null | undefined, action: Action): boolean {
  if (!role) return false;
  return MATRIX[role].includes(action);
}

export function canPerson(person: Person | null | undefined, action: Action): boolean {
  if (!person) return false;
  return can(person.role, action);
}

/** Task update policy: owner or creator may update within policy; leads/admins may update any. */
export function canUpdateTask(
  person: Person,
  task: { ownerId: UUID | null; createdBy: UUID; projectId: UUID },
  _projectId: UUID
): boolean {
  if (can(person.role, "task:update:any")) return true;
  if (!can(person.role, "task:update:own")) return false;
  return task.ownerId === person.id || task.createdBy === person.id;
}

/** Support visibility: requester, assigned coordinator (or any coordinator for the queue),
 *  or workspace admin. Project lead does NOT see other people's private cases. */
export function canViewSupportTicket(
  viewer: Person,
  ticket: { requesterId: UUID; coordinatorId: UUID | null },
  sanitizedBlockerPublications: UUID[] = []
): boolean {
  if (viewer.role === "workspace_admin") return true;
  if (ticket.requesterId === viewer.id) return true;
  if (ticket.coordinatorId === viewer.id) return true;
  if (viewer.role === "it_coordinator") return true; // coordinator queue
  return sanitizedBlockerPublications.includes(viewer.id);
}

export const ROLE_LABELS: Record<WorkspaceRole, { cs: string; en: string }> = {
  workspace_admin: { cs: "Správce pracoviště", en: "Workspace administrator" },
  project_lead: { cs: "Vedoucí projektu", en: "Project lead" },
  it_coordinator: { cs: "IT koordinátor", en: "IT coordinator" },
  member: { cs: "Člen týmu", en: "Team member" },
  viewer: { cs: "Pouze prohlížení", en: "Viewer" },
};
