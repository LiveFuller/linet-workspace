# REQUIREMENTS — Traceability Matrix (M01–M12)

> Generated: 2026-09-08 · Source of truth: actual implementation in `src/` · Language: Czech default (`src/locales/strings.ts:1`), English complete.
> Stack: React 19 + TypeScript 5.9 + Vite 7, IndexedDB local mode, Supabase live stub. Demo runs zero-config (`VITE_DATA_MODE=local`).

## Unknowns — Preserved as Unknowns (Original Prompt Constraint)

Per original prompt, the following were intentionally NOT invented or assumed:

| Unknown | Handling in code/docs |
|---|---|
| Hospital name | Generic: "Papua-Nová Guinea — projekt nemocnice" / "Papua New Guinea — Hospital Project" — `src/data/local/seed.ts:72`. No specific hospital name established. |
| Person surnames | Not fabricated. Personas use first names only: Oliver, Petra, Honza, Krištof, Tereza, Petr (viewer), Vedoucí projektu — `src/data/local/seed.ts:61-68`. Emails are `example.invalid`. |
| Meeting date | Not established. Seed anchors relative to `DEFAULT_CLOCK` (`src/lib/dates.ts`) and frozen `referenceDate`; relative phrases like "do pěti dnů" require human confirmation (`src/features/meetings/MeetingDetailPage.tsx:231`). |
| Availability 16:00 / 14:00 | Not an SLA. Treated as informal mention, never enforced as deadline logic. No code asserts it. |
| Hardware 48/64 | Unclear — preserved as description text only: "paměť 48/64 je neověřený požadavek, ne schválená specifikace" — `src/data/local/seed.ts:150`. No enforcement. |
| Budget / opening date | Explicitly omitted: "neověřené údaje (rozpočet, termín otevření) záměrně neuvádíme" — `src/data/local/seed.ts:76`. |

Other sanitization: transcript sample is fictionalized/sanitized (`src/domain/transcript.ts:136-155`), `example.invalid` for all demo addresses, budgets excluded.

## Verified vs Awaits-Credentials vs Unavailable

| Category | Meaning | Items |
|---|---|---|
| **Verified (local)** | Works in `local` mode, verified by `tsc -b && vite build` and manual UI verification on 2026-09-08 | All M01–M12 slices below in local mode; `npm run build` passes, `npm run typecheck` passes. |
| **Awaits-Credentials** | Code path exists, honest configuration screen, but live execution requires credentials not present in this checkout | Supabase live repository (`src/data/supabase/SupabaseRepository.ts:8-18`), Microsoft Graph, mail capture address, AI provider key. App shows `LiveConfigPage` (`src/features/liveconfig/LiveConfigPage.tsx`) and never falls back to demo data. |
| **Unavailable / Not Implemented** | Intentionally not built; demo simulation shown where applicable | Real Graph/Planner sync, real mail ingestion, real AI provider, server-side scheduled report delivery, production auth (demo persona switcher is simulation — `src/app/store.ts:67`, `src/domain/permissions.ts:2`). |

---

## Traceability Matrix — M01 to M12

> Route table: `src/app/routes.tsx:55-81`. Domain contract: `src/data/contracts/repository.ts`. Permissions: `src/domain/permissions.ts`. Selectors: `src/domain/selectors.ts`.

### M01 — Digitalization & IT Foundations / Školení základů

| Aspect | Detail |
|---|---|
| **Requirement** | Establish Teams/files/AI basics before complex systems. Checklist-driven onboarding; QR-simple task workflow. |
| **Implemented — Routes** | `/learning` → `src/features/learning/LearningPage.tsx:6`, `/learning/:moduleId` → `src/features/learning/LearningModulePage.tsx`; `/today` continues learning card `src/features/today/TodayPage.tsx:183`; onboarding path highlighted. |
| **Components/Services** | 6 onboarding modules (`src/data/local/seed.ts:311-439`: teams-collab, copilot-basics, file-sharing, task-workflow, weekly-review, it-help), `setTrainingProgress()` `src/data/local/LocalRepository.ts:768`, `TrainingProgressState` `src/domain/types.ts:298`. |
| **Verification** | Manual: open `/learning` as Oliver → 6 modules shown with `~N min (odhad)`, checklist checkable. `dataset` seed verified. **Pass**. |

### M02 — Project Coordination / Tasks (core)

| Aspect | Detail |
|---|---|
| **Requirement** | Single shared task system (not scattered Excel/Planner). Full lifecycle: todo→in_progress→waiting→blocked→done→archived, quick capture (10s), templates, comments, workload. |
| **Implemented — Routes** | `/tasks` + filters `src/features/tasks/TasksPage.tsx`, `/tasks/new` `src/features/tasks/TaskForm.tsx`, `/tasks/:taskId` `src/features/tasks/TaskDetailPage.tsx`, `/today` focus + undo `src/features/today/TodayPage.tsx:47-59`. |
| **Services/Validation** | `createTask/updateTask/completeTask/reopenTask/archiveTask/duplicateTask` `src/data/contracts/repository.ts:54-62`, Zod `taskDraftSchema/taskUpdateSchema` `src/domain/validation.ts:12-42`, optimistic concurrency `version` `src/domain/types.ts:110`, 32 demo tasks `src/data/local/seed.ts:117-158`, templates `src/data/local/seed.ts:177-183`. |
| **Verification** | Manual: create task (`/` → Přidat úkol → validate title required → save → toast `task_created`), complete → Undo toast, reopen, archive/restore on detail. `tsc` pass. **Pass**. Awaits-credentials: live RLS `tasks_insert_member / tasks_update_own_or_lead` in `supabase/setup.sql:609-611`. |

### M03 — Workstreams & Labels (Structure — Finance/Legal/Logistics/Product)

| Aspect | Detail |
|---|---|
| **Requirement** | Six coordinating workstreams; label taxonomy; project overview; task ratio (not hospital completion). |
| **Implemented — Routes** | `/projects/:projectId` `src/features/project/ProjectPage.tsx`, `/team` workload `src/features/team/TeamPage.tsx`, Today lead attention `src/features/today/TodayPage.tsx:75-90`. |
| **Services** | `Workstream`/`Label`/`Project` `src/domain/types.ts:22-46`, seed 6 workstreams `src/data/local/seed.ts:84-91`, 6 labels `src/data/local/seed.ts:93-100`, `projectCompletionRatio()` `src/domain/selectors.ts:184`. Note: "NE míra dokončení nemocnice" `src/locales/strings.ts:792`. |
| **Verification** | Manual: `/projects/:id` shows 6 workstreams, labels, active/blocked counters. **Pass**. |

### M04 — Collaboration: Comments, Checklist, Activity

| Aspect | Detail |
|---|---|
| **Requirement** | Task-level checklist, comments, append-only activity history. |
| **Implemented** | `TaskChecklistItem`/`TaskComment`/`ActivityEvent` `src/domain/types.ts:60-90`, `addChecklistItem/setChecklistItemDone/addComment` `src/data/local/LocalRepository.ts:360-417`, `activity_events` table + `prevent_activity_mutation()` trigger `supabase/setup.sql:26-35, 377`. Display on `TaskDetailPage`. |
| **Verification** | Manual: open task detail → add checklist item → toggle done → add comment → history entry appears. **Pass**. |

### M05 — Calendar & Focus Blocks

| Aspect | Detail |
|---|---|
| **Requirement** | Agenda/week/month calendar, focus blocks without mutating task due dates, ICS export, Prague / Port Moresby timezones. |
| **Implemented — Routes** | `/calendar` `src/features/calendar/CalendarPage.tsx:16` with `agenda/week/month` tabs, `EventForm` (allDay toggle `src/features/calendar/CalendarPage.tsx:300`), `createEvent/updateEvent/deleteEvent` `src/data/contracts/repository.ts:99-106`. |
| **Services** | `CalendarEvent` `src/domain/types.ts:128-145`, `calendarEventSchema` `src/domain/validation.ts:89-102`, `localInputToInstant/formatInstant/todayInZone` `src/lib/dates.ts`, 6 seed events `src/data/local/seed.ts:185-192`. ICS via `downloadFile` `src/lib/utils.ts`. |
| **Verification** | Manual: create focus block → linkedTaskId does not change `task.dueDate` (hint `calendar_due_note` `src/locales/strings.ts:181`). Export .ics → file download. **Pass** with known defect: delete is immediate, no confirmation dialog (see `BUILD_STATUS.md`). |

### M06 — Meetings, Transcripts, Action Proposals (Review Ritual)

| Aspect | Detail |
|---|---|
| **Requirement** | Weekly review over live list; transcript import (TXT/SRT/VTT); deterministic helper suggests actions; human approve-once guarantee with evidence. |
| **Implemented — Routes** | `/meetings` `src/features/meetings/MeetingsPage.tsx`, `/meetings/:meetingId` `src/features/meetings/MeetingDetailPage.tsx:1`, `/meetings/new` `src/features/meetings/MeetingForm.tsx`. |
| **Services** | `Meeting`/`TranscriptSegment`/`MeetingActionProposal` `src/domain/types.ts:168-217`, `parseTxt/parseSrt/parseVtt/detectFormat/extractActionCandidates` `src/domain/transcript.ts:12-84, 112-134`, `importTranscript/addProposal/approveProposal` `src/data/local/LocalRepository.ts:455-547`, `UNIQUE (meeting_id, source_action_key)` `supabase/setup.sql:258`. 8 transcript segments + 4 proposals seeded (`src/data/local/seed.ts:215-272`). |
| **Verification** | Manual: `/meetings/:id` → Import přepis (file or paste or SAMPLE_SRT) → Run helper → approve → task created with `source: meeting_action`, second approval → `conflict` toast `meeting_proposal_link_exists`. Relative date confirmation banner shown. **Pass**. AI is NOT used locally — `extractionMethod: deterministic_helper`. |

### M07 — Decisions Register

| Aspect | Detail |
|---|---|
| **Requirement** | Decision register with supersession, linked to meetings/tasks. |
| **Implemented** | `Decision` `src/domain/types.ts:220-232`, `createDecision` `src/data/local/LocalRepository.ts:551-567`, shown on Project overview `src/features/project/ProjectPage.tsx` and Meeting detail `src/features/meetings/MeetingDetailPage.tsx:263`. Seed 3 decisions `src/data/local/seed.ts:274-278`, `supersededBy` field `supabase/setup.sql:268`. |
| **Verification** | Manual: review meeting shows linked decisions; project overview shows recent decisions. **Pass**. |

### M08 — Inbox / Mail Capture (Sběrná schránka)

| Aspect | Detail |
|---|---|
| **Requirement** | Triage inbox for email/note/transcript/link/file/voice; private drafts; fingerprint dedupe; manual paste now, live address later. |
| **Implemented — Routes** | `/inbox` `src/features/inbox/InboxPage.tsx`, `/inbox/new` `src/features/inbox/InboxNewPage.tsx`, quick capture via `inbox_triage` `src/domain/types.ts:55`. |
| **Services** | `InboxItem` `src/domain/types.ts:147-165`, `addInboxItem/updateInboxItem` `src/data/local/LocalRepository.ts:569-608`, `sha256Hex` fingerprint + `UNIQUE (project_id, fingerprint)` `src/data/local/LocalRepository.ts:577`, `inboxItemSchema` `src/domain/validation.ts:81-87`, `supabase/setup.sql:208-221`. 2 seed items `src/data/local/seed.ts:194-211`. |
| **Verification** | Manual: `/inbox/new` → Try sample email → create task → duplicate paste → `conflict` dedupe toast. Private `note` isPrivateDraft handling `src/data/local/LocalRepository.ts:585`. Live address note shown: `inbox_live_addr_note` `src/locales/strings.ts:217`. **Pass** locally; live address **awaits-credentials**. |

### M09 — Reports & Weekly Review Snapshots

| Aspect | Detail |
|---|---|
| **Requirement** | Deterministic daily/weekly reports from live records; frozen snapshot on save; commentary editable; Markdown/CSV/print export; schedule (cadence/time/channel/recipients) without background delivery in demo. |
| **Implemented — Routes** | `/reports` `src/features/reports/ReportsPage.tsx:15`, `/reports/:reportId` `src/features/reports/ReportDetailPage.tsx`. |
| **Services** | `Report`/`ReportSnapshotItem`/`ReportSchedule` `src/domain/types.ts:235-276`, `saveReport/updateReport/upsertSchedule` `src/data/local/LocalRepository.ts:725-765`, `reportScheduleSchema` `src/domain/validation.ts:114-123`, deterministic grouping by `completed/upcoming/overdue/blocker/decision` `src/features/reports/ReportsPage.tsx:35-60`. Seed 2 reports + 1 schedule `src/data/local/seed.ts:280-309`. |
| **Verification** | Manual: `/reports` → Generate (preview → `preview_note`) → Save draft → copy text → export Markdown → publish → snapshot immutability banner `report_snapshot_note` `src/locales/strings.ts:244`. Schedule tab saves `weekly 08:00` etc. **Pass** locally; email delivery **awaits-credentials** (demo note `report_demo_send_note` `src/locales/strings.ts:258`). |

### M10 — Learning & Onboarding

| Aspect | Detail |
|---|---|
| **Requirement** | First-class learning destination; 6-module baseline path; per-user progress; coordinator overview; content ownership/review status. |
| **Implemented — Routes** | `/learning` `src/features/learning/LearningPage.tsx`, `/learning/:moduleId` `src/features/learning/LearningModulePage.tsx` |
| **Services** | `TrainingModule`/`TrainingProgress` `src/domain/types.ts:279-307`, `setTrainingProgress()` `src/data/local/LocalRepository.ts:768-784`, `isOnboardingPath` flag `src/domain/types.ts:296`, `training_progress` PK `(person_id, module_id)` `supabase/setup.sql:312-319`. Cover: Teams, Copilot safe use, file sharing, task workflow, weekly review, IT help request. |
| **Verification** | Manual: open `/learning/teams-collab` → checklist → mark complete → `/learning` shows overview table (leads/coordinators). **Pass**. |

### M11 — Support / IT Coordination

| Aspect | Detail |
|---|---|
| **Requirement** | Support capture with 5-state lifecycle: `captured → awaiting_official_ticket → with_linet_it → waiting_user → resolved`; requester vs coordinator queue; private notes not auto-visible to project lead; officialTicketRef never fabricated. |
| **Implemented — Routes** | `/support` `src/features/support/SupportPage.tsx:8`, `/support/new` `src/features/support/SupportForm.tsx`, `/support/:ticketId` `src/features/support/SupportDetailPage.tsx`, Today coordinator queue `src/features/today/TodayPage.tsx:40-42`. |
| **Services** | `SupportTicket`/`SupportUpdate` `src/domain/types.ts:310-342`, `createSupportTicket/updateSupportTicket/addSupportUpdate` `src/data/local/LocalRepository.ts:650-703`, RLS `st_select_scoped` `supabase/setup.sql:661`, domain `canViewSupportTicket()` `src/domain/permissions.ts:95-105`. Seed 3 tickets across states `src/data/local/seed.ts:448-467`. |
| **Verification** | Manual: as `member` (Petra) → create ticket → queue tab disabled with `support_private_note`; as Oliver (coordinator) → queue visible → assign self → add update → `visibleToRequester` respected; as project lead → queue hidden. **Pass**. |

### M12 — Documents, Search, Integrations, Privacy, Offline, Deployment Foundation

| Aspect | Detail |
|---|---|
| **Requirement** | Documents library (local sample content instead of broken links), global search (permission-aware), integrations status, settings (locale/timezone/theme), backup/export, reset, offline awareness, SQL one-shot installer. |
| **Implemented — Routes** | `/documents` `src/features/documents/DocumentsPage.tsx`, `/search` `src/features/search/SearchPage.tsx`, `/integrations` `src/features/integrations/IntegrationsPage.tsx`, `/settings` `src/features/settings/SettingsPage.tsx`, `/team` `src/features/team/TeamPage.tsx`, `/liveconfig` `src/features/liveconfig/LiveConfigPage.tsx`. |
| **Services** | `DocumentRecord` `src/domain/types.ts:345-357`, `createDocument` `src/data/local/LocalRepository.ts:706-723`, `integrationStatuses()` `src/data/local/LocalRepository.ts:840-847` / `supabase:68-75`, `exportBackup/resetDemoData` `src/data/local/LocalRepository.ts:810-838`, `openWorkspaceDB` + `navigator.storage.persist` `src/data/local/db.ts` + `src/app/AppProvider.tsx:48-56`, `supabase/setup.sql` one-shot `BEGIN;...COMMIT;` `supabase/setup.sql:6`. Search respects `canViewSupportTicket` etc. `src/features/search/SearchPage.tsx`. |
| **Verification** | Manual: `/documents` → local sample opens, no broken https; `/search` returns scoped results; `/integrations` shows status pills (see `PERMISSIONS.md`/`INTEGRATIONS.md`); `/settings` → export backup (JSON download), reset → confirm → seed restored; offline badge `offline_badge` `src/locales/strings.ts:416`. `scripts/verify-sql-sync.mjs` and `setup.sql` install check **awaits-credentials** (no live DB in this checkout). **Pass** locally. |

---

## Notes on Honesty

- No live Supabase connection is attempted without `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (`src/data/supabase/SupabaseRepository.ts:11`). The missing-config repository returns `not_configured` and the UI shows `LiveConfigPage` — never silently falls back to demo data (`src/app/routes.tsx:41-44`).
- Persona switcher is explicitly labeled simulation (`persona_note` `src/locales/strings.ts:409` / `src/app/store.ts:67`), not authentication.
- Microsoft/AI/mail capabilities report `not_configured` in demo (`src/data/local/LocalRepository.ts:843-845`) — see `INTEGRATIONS.md`.
- Relative due dates from transcript ("do pěti dnů") are left `null` with a confirmation prompt (`meeting_relative_date_confirm` `src/locales/strings.ts:161`), not auto-calculated.
