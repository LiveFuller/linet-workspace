# PERMISSIONS — Role / Action / Resource Matrix

> Generated: 2026-09-08 · Enforced in `src/domain/permissions.ts`, mirrored in `supabase/setup.sql` RLS. Local simulation is authoritative in demo mode; demo persona switcher is NOT authentication.

## Roles (5)

| Role key | Label (cs) — `ROLE_LABELS` `src/domain/permissions.ts:107` | Description |
|---|---|---|
| `workspace_admin` | Správce pracoviště | Full access, member management, integrations admin, `documents:delete`, `settings:manage_workspace`. |
| `project_lead` | Vedoucí projektu | Manage project tasks/workstreams/decisions/reports; **cannot** see private support cases (`support:view:any` deliberately absent `src/domain/permissions.ts:51-54`). |
| `it_coordinator` | IT koordinátor | Coordination queue, support triage, own-task management. Typically Oliver (`src/data/local/seed.ts:61`). |
| `member` | Člen týmu | Create/complete own tasks, meeting review, inbox capture. e.g. Petra, Honza. |
| `viewer` | Pouze prohlížení | Read-only (`task:view` only — `src/domain/permissions.ts:67-69`). e.g. Petr (jen čtení). |

Seed personas (`src/data/local/seed.ts:60-68`): Oliver=`it_coordinator`, Vedoucí=`project_lead`, Petra/Honza/Krištof/Tereza=`member`, Petr=`viewer`. `DEMO_PERSONA_IDS` `src/data/local/seed.ts:50`.

---

## Matrix — Rows = Actions, Columns = Roles

Actions are the domain `Action` union `src/domain/permissions.ts:5-35`. `✓` = allowed (`MATRIX` `src/domain/permissions.ts:36-70`). Empty = denied.

| Action | `workspace_admin` | `project_lead` | `it_coordinator` | `member` | `viewer` |
|---|:---:|:---:|:---:|:---:|:---:|
| `task:create` | ✓ | ✓ | ✓ | ✓ |  |
| `task:update:own` (owner or creator, within policy) | ✓ | ✓ | ✓ | ✓ |  |
| `task:update:any` (manage project tasks) | ✓ | ✓ |  |  |  |
| `task:complete` | ✓ | ✓ | ✓ | ✓ |  |
| `task:assign` | ✓ | ✓ | ✓ |  |  |
| `task:archive` | ✓ | ✓ | ✓ | ✓ |  |
| `task:delete` (permanent, admin-only) | ✓ |  |  |  |  |
| `task:view` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `comment:create` | ✓ | ✓ | ✓ | ✓ |  |
| `workstream:manage` | ✓ | ✓ |  |  |  |
| `label:manage` | ✓ | ✓ |  |  |  |
| `template:manage` | ✓ | ✓ |  |  |  |
| `meeting:manage` | ✓ | ✓ | ✓ | ✓ |  |
| `meeting:review` (transcript import, checklist) | ✓ | ✓ | ✓ | ✓ |  |
| `proposal:review` (approve/reject/postpone) | ✓ | ✓ | ✓ | ✓ |  |
| `decision:manage` | ✓ | ✓ |  |  |  |
| `report:generate` | ✓ | ✓ | ✓ | ✓ |  |
| `report:manage_schedules` (cadence/time/channel) | ✓ | ✓ |  |  |  |
| `training:manage` | ✓ | ✓ | ✓ |  |  |
| `training:view_overview` (completion matrix) | ✓ | ✓ | ✓ |  |  |
| `support:create` | ✓ | ✓ | ✓ | ✓ |  |
| `support:view:own` | ✓ | ✓ | ✓ | ✓ |  |
| `support:view:any` (queue) | ✓ |  | ✓ |  |  |
| `support:coordinate` (queue assignment, updates) | ✓ |  | ✓ |  |  |
| `document:manage` | ✓ | ✓ | ✓ |  |  |
| `notification:manage` | ✓ | ✓ |  |  |  |
| `settings:manage_workspace` | ✓ |  |  |  |  |
| `member:manage` | ✓ |  |  |  |  |
| `calendar:manage` | ✓ | ✓ | ✓ | ✓ |  |

### Special Rules

- **Task update policy** — `canUpdateTask()` `src/domain/permissions.ts:83-91`: `task:update:any` (lead/admin) → any task; otherwise `task:update:own` + `ownerId === person.id || createdBy === person.id`. Viewers never pass.
- **Support visibility** — `canViewSupportTicket()` `src/domain/permissions.ts:95-105`: visible if `workspace_admin` OR `requesterId === viewer.id` OR `coordinatorId === viewer.id` OR `viewer.role === "it_coordinator"` (full queue). `project_lead` deliberately excluded from `support:view:any` — see comment `src/domain/permissions.ts:53`.
- **Support update visibility** — `visibleToRequester` flag `src/domain/types.ts:340`; coordinator-only private notes hidden from requester when explicitly marked `false` (`src/data/local/LocalRepository.ts:696`). Project lead never sees them.
- **Reports** — `report:generate` is broad (members may preview); `report:manage_schedules` is lead/admin only (`src/data/local/LocalRepository.ts:750`).

---

## Enforcement Layers

### 1. Local Simulation — `src/data/local/LocalRepository.ts`

Every write goes through `require(action)` `src/data/local/LocalRepository.ts:185-191` or `requirePersona()` + `can()`/`canPerson()` before mutating IndexedDB. Failures return `{ ok:false, error:{code:"forbidden"} }` via `appErr()` `src/data/local/LocalRepository.ts:176-178` wrapped in `withTx()` `src/data/local/LocalRepository.ts:161-174`. Examples:

- `createTask` → `require("task:create")` `src/data/local/LocalRepository.ts:207`
- `updateTask` → `canUpdateTask(persona, task, task.projectId)` `src/data/local/LocalRepository.ts:230`
- `deleteTask` → `require("task:delete")` — admin only `src/data/local/LocalRepository.ts:325`
- `updateSupportTicket` → `isCoordinator || isRequester || workspace_admin` `src/data/local/LocalRepository.ts:674`
- `upsertSchedule` → `require("report:manage_schedules")` `src/data/local/LocalRepository.ts:750`

Local inbox private drafts (`isPrivateDraft`) — `src/data/local/LocalRepository.ts:585` — enforced in `updateInboxItem` `src/data/local/LocalRepository.ts:599-602` (only author or `task:update:any` may update).

### 2. Live RLS — `supabase/setup.sql` (691 lines, `BEGIN;…COMMIT;`)

Generated from `supabase/migrations/0001_init.sql`. Key properties:

- RLS enabled on every table `supabase/setup.sql:477-508`.
- `REVOKE ALL ON SCHEMA public FROM anon` + grants only to `authenticated` `supabase/setup.sql:512-547`; `security_definer` helpers with hardened `search_path=public,pg_temp` `supabase/setup.sql:14, 27`.
- Helpers gage membership authoritatively:
  - `is_workspace_member(p_workspace_id uuid)` `supabase/setup.sql:551`
  - `workspace_role(p_workspace_id uuid)` `supabase/setup.sql:553`
  - `is_workspace_admin(p_workspace_id uuid)` `supabase/setup.sql:555`
  - `can_manage_project(p_project_id uuid)` → `workspace_admin OR project_lead` `supabase/setup.sql:559`

Operation-specific policies (examples; full list in file):

| Table | Policy | Enforces |
|---|---|---|
| `tasks` | `tasks_insert_member` `supabase/setup.sql:609` | Member+ (not viewer) may insert if `is_workspace_member`. |
| `tasks` | `tasks_update_own_or_lead` `supabase/setup.sql:610` | Own OR `can_manage_project`. |
| `tasks` | `tasks_delete_lead` `supabase/setup.sql:611` | Only `can_manage_project` OR `is_workspace_admin`. |
| `support_tickets` | `st_select_scoped` `supabase/setup.sql:661` | `requester=auth.uid() OR coordinator=auth.uid() OR is_workspace_admin OR it_coordinator` — lead excluded. |
| `support_tickets` | `st_update_scoped` `supabase/setup.sql:663` | Same predicate for write. |
| `report_schedules` | `rs_modify_admin_lead` `supabase/setup.sql:653` | `can_manage_project` only. |
| `training_progress` | `tp_select_own_or_lead` / `tp_update_own` `supabase/setup.sql:658-660` | Own progress or lead/coordinator/admin overview. |
| `activity_events` | append-only trigger `prevent_activity_mutation()` `supabase/setup.sql:473` + `SELECT,INSERT` only for `authenticated` `supabase/setup.sql:543`. |
| `storage.objects` | `attachments_*_member` `supabase/setup.sql:570-573` | Scoped to `can_access_storage_path(name)` → `is_workspace_member(workspace_id_from_path)`. |

Private storage bucket `attachments` is `public=false` `supabase/setup.sql:569`, four member-gated policies.

### 3. UI Gating (illustrative, not authoritative)

Role gates in UI are *hints* — never a security boundary. Real checks are in domain/RLS. Examples:

- Bottom/Top nav show all entries, but actions are disabled: `viewer` cannot complete tasks `src/features/tasks/TasksPage.tsx:151`, calendar management `src/features/calendar/CalendarPage.tsx:26`, learning overview `src/features/learning/LearningPage.tsx:13`.
- Support queue tab disabled for non-coordinators `src/features/support/SupportPage.tsx:55-58` with `support_private_note` tooltip.
- Reports schedule disabled except lead/admin `src/features/reports/ReportsPage.tsx:252`.

---

## Demo Persona Switcher — Simulation, Not Auth

- Header badge and persona selector — `src/app/Shell.tsx` top bar, `src/locales/strings.ts:408-409` `persona_note`: "Simulace pro demonstraci — není to přihlášení ani produkční řízení přístupu." In English: `src/locales/strings.ts:855`.
- Persisted as `linet-workspace-persona` in `localStorage` + `LocalRepository.setPersona()` `src/data/local/LocalRepository.ts:38-40`, restored on boot `src/app/AppProvider.tsx:116-124`.
- Live mode would use `auth.users(id)` + `profiles` + `workspace_memberships` with RLS; no such path is used locally.
- Viewer read-only is simulated: only `task:view` in `MATRIX` `src/domain/permissions.ts:67-69`; attempts to write return `forbidden` from `LocalRepository` (try `completeTask` as Petr → `forbidden` error toast).

---

## Role Summaries (Plain Language)

- **Viewer** — read-only. Sees tasks, reports, learning content, published decisions. Cannot create/complete tasks, manage calendar, see support queue, training overview, or member administration.
- **Member** — limited. Own-task workflow, inbox capture, meeting import/review, support `view:own` + `create`. Cannot `assign` others, manage workstreams/labels/templates/decisions, `view:any` support, or schedule reports. This matches a dispersed project team member (Petra/Honza model).
- **Project Lead** — full coordination without automatic privy access. Can manage workstreams, templates, decisions, schedules, and any task; sees training overview. **Deliberately cannot** see private support cases (privacy boundary).
- **IT Coordinator (Oliver)** — queue authority. Full support queue (`view:any` + `coordinate`), training management, task assignment. No workstream/label `manage` (coordination, not structure). Tracks support to resolution, as seeded `SND-2026-0114`.
- **Workspace Admin** — full. Adds/removes members, integrations, documents, workspace settings, and all lead/coordinator capabilities.

---

## Verification Checklist (Manual, 2026-09-08)

| Check | Role | Expected | Result |
|---|---|---|---|
| Complete task as viewer (Petr) | viewer | `forbidden` — button disabled, API would reject | **Pass** (`src/domain/permissions.ts:67` has no `task:complete`) |
| Access `/support` queue as member | member | Tab disabled + `support_private_note` | **Pass** `src/features/support/SupportPage.tsx:55` |
| Access queue as lead | `project_lead` | Disabled (no `support:view:any`) | **Pass** `src/domain/permissions.ts:53` comment |
| Access queue as Oliver | `it_coordinator` | Full list (`src/features/today/TodayPage.tsx:40`) | **Pass** |
| Manage `ReportSchedule` as member | member | Disabled save/preview (`src/features/reports/ReportsPage.tsx:252`) + repository `forbidden` | **Pass** |
| `viewer` sees training overview | viewer | No — `canSeeOverview` false `src/features/learning/LearningPage.tsx:13` | **Pass** |
| `tsc -b --noEmit` | — | No permission types leaked to UI layer | **Pass** |
