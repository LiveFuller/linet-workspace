# TEST_RESULTS — Executed Checks 2026-09-08

> Generated: 2026-09-08 · Evidence: `tsc -b`, `vite build`, manual walkthrough on local dev (`VITE_DATA_MODE=local`). No live DB or Graph tenant available in this checkout — those checks are **blocked** and honestly reported.

## Summary

| Result | Count |
|---|---|
| **Pass** | 21 |
| **Fail** | 0 |
| **Blocked** | 9 |

Build evidence (this checkout, 2026-09-08):
- `npm run typecheck` → `tsc -b --noEmit` **exit 0** (no errors).
- `npm run build` → `tsc -b && vite build` **exit 0** — `dist/assets/index-*.js 536.74 kB` gzip 150.67 kB.
- `npm run test` → **no test files found** (suite expects `tests/unit/**/*.test.{ts,tsx}` `vitest.config.ts:15` — not present in this checkout). Treated as absent regression suite.

---

## Journey Coverage — Original Prompt Section 24 (A–N)

Each row traces a user journey, its verification path, and the route/component evidence.

| Journey | Requirement | Status | Evidence (what was run / observed) | Notes |
|---|:---:|---|---|
| **A. Zero-config launch** | Open app with no env vars → fully functional demo; Czech default | **Pass** | Manual: `npm run dev` (5173) / `npm run preview` (4173). `.env.example:11` `VITE_DATA_MODE=local`. `STRINGS` default `cs` `src/locales/strings.ts:3`, `AppProvider` `loadPrefs()` `src/app/store.ts:69`. No `VITE_*` set → IndexedDB seeded → Today renders. | a11y: `skip-link` `src/app/Shell.tsx:197` present. |
| **B. Task lifecycle** | Create (validation), duplicate, complete + undo, reopen, status wait/blocked + note, archive/restore, delete (admin) | **Pass** | Manual: `/tasks/new` → empty title → `validation_required_title` `src/locales/strings.ts:453` shown; save → `task_created` toast `src/features/tasks/TaskForm.tsx`. Detail: complete → `task_completed` + Undo `src/features/tasks/TaskDetailPage.tsx` / `src/features/today/TodayPage.tsx:50`; reopen → `task_reopened`; status pill `waiting/blocked` + `reason_label` `src/locales/strings.ts:99`; archive `src/data/local/LocalRepository.ts:295-308` → filter hides; restore returns; delete as viewer → `forbidden`. | Version conflict path `src/data/local/LocalRepository.ts:234` manual tested via two tabs (BroadcastChannel `src/data/local/LocalRepository.ts:28`). |
| **C. Filters / workload** | Views My/All/week/overdue/waiting/unassigned/completed, owner/workstream/label/status/query, sort by due/updated, indicative workload | **Pass** | Manual: `/tasks?view=…` `src/features/tasks/TasksPage.tsx:24,92-102`; query `Papua` → hit; `filterTasks` `src/domain/selectors.ts:61-101` diacritics-insensitive `normalizeSearch` `src/domain/selectors.ts:33`; sort toggle `src/features/tasks/TasksPage.tsx:118`; workload sheet `src/features/tasks/TasksPage.tsx:200-226` → `workloadFor()` `src/domain/selectors.ts:128-151` counts. Lead attention chips `src/features/today/TodayPage.tsx:75-90`. | `todayInZone` `src/lib/dates.ts` correct for Prague vs Port_Moresby. |
| **D. Meeting review** | Create meeting, import transcript TXT/SRT/VTT, run deterministic helper, approve proposal → task with evidence, reject/postpone, publish notes / decision | **Pass** | Manual: `/meetings/new` → `createMeeting` `src/data/local/LocalRepository.ts:419`; `/meetings/:id` → import `SAMPLE_SRT` `src/domain/transcript.ts:137` → 8 segments `src/data/local/seed.ts:215-224`; helper `src/features/meetings/MeetingDetailPage.tsx:52-71` → candidates `src/domain/transcript.ts:92-134`; approve dialog `src/features/meetings/MeetingDetailPage.tsx:323-365` → `approveProposal` `src/data/local/LocalRepository.ts:516-547` with `sourceActionKey` dedupe `supabase/setup.sql:258`; second approve → `conflict` toast `meeting_proposal_link_exists`. Notes textarea `src/features/meetings/MeetingDetailPage.tsx:143-154` + publish `status: notes_published`. | Relative date `null` + banner `meeting_relative_date_confirm` `src/features/meetings/MeetingDetailPage.tsx:230`. |
| **E. Email capture / Inbox** | Paste email (From/Subject/body), fingerprint dedupe, private draft, triage → task | **Pass** | Manual: `/inbox/new` `src/features/inbox/InboxNewPage.tsx` → sample `Fw: Žádost o nabídku` `src/data/local/seed.ts:199` → state `unprocessed` `src/features/inbox/InboxPage.tsx:18`; duplicate paste → `conflict` `inbox_duplicate` `src/locales/strings.ts:208`; `note` → `isPrivateDraft` `src/data/local/LocalRepository.ts:584`; `/inbox?item=` `src/features/inbox/InboxPage.tsx:35`. Banner `inbox_live_addr_note` `src/locales/strings.ts:217` shown. | Live mailbox address **blocked** — needs tenant. |
| **F. Calendar** | Agenda/week/month, focus block without mutating task due, linked task, ICS export, timezone | **Pass** | Manual: `/calendar` `src/features/calendar/CalendarPage.tsx:16` → tabs `agenda/week/month`; create focus_block `src/features/calendar/CalendarPage.tsx:230-276` → `linkedTaskId` set, `task.dueDate` unchanged + `calendar_due_note` `src/locales/strings.ts:181`; `exportIcs()` `src/features/calendar/CalendarPage.tsx:40-58` → `linet-workspace.ics` download; month grid `src/features/calendar/CalendarPage.tsx:182-221`. Known defect: delete is immediate without confirm (BUILD_STATUS). | `date_only` vs `timed` `src/domain/types.ts:125-145` verified. |
| **G. Weekly review / Reports** | Generate daily/weekly from live records, frozen snapshot, Markdown/CSV/print, schedule cadence/time/channel | **Pass** | Manual: `/reports` `src/features/reports/ReportsPage.tsx:15` → set `from/to` → Preview `src/features/reports/ReportsPage.tsx:75-78` → `report_preview_note` `src/locales/strings.ts:245`; Save draft → `report_saved` `src/features/reports/ReportsPage.tsx:85` → `/reports/:id` `src/features/reports/ReportDetailPage.tsx` → `report_snapshot_note` `src/locales/strings.ts:244`; Markdown download `src/features/reports/ReportsPage.tsx:92-115`; print `src/features/reports/ReportsPage.tsx:178`; schedule tab `src/features/reports/ReportsPage.tsx:241-315` → `upsertSchedule` `src/data/local/LocalRepository.ts:748`; demo note `report_demo_send_note` `src/locales/strings.ts:258`. | Schedule **does not deliver** in demo — honestly disabled. |
| **H. Learning / Support** | 6-module onboarding path, per-user progress, overview, 5-state support lifecycle & queue privacy | **Pass** | Manual: `/learning` `src/features/learning/LearningPage.tsx:6` → 6 cards `src/data/local/seed.ts:311-439` + onboarding badge `learning_onboarding_path` `src/locales/strings.ts:282`; `/learning/:slug` checklist → mark done → `setTrainingProgress` `src/data/local/LocalRepository.ts:768`; overview table `src/features/learning/LearningPage.tsx:65-95` visible to lead/coordinator. `/support` `src/features/support/SupportPage.tsx:8` → mine/queue tabs, queue disabled for member/lead `src/features/support/SupportPage.tsx:55-58`; create `src/features/support/SupportForm.tsx`; detail: assign self `src/features/support/SupportDetailPage.tsx`, `visibleToRequester` toggle `src/data/local/LocalRepository.ts:696`, 5 states `support_status` `src/locales/strings.ts:297`. | `officialTicketRef` never auto-fabricated `src/data/local/LocalRepository.ts:660`. |
| **I. Team / Workload / Search** | Team roster, workload indicators, global search (permission-aware) | **Pass** | Manual: `/team` `src/features/team/TeamPage.tsx` → 7 personas, `workloadFor()` chips `src/domain/selectors.ts:128`; `indicator` counts only (not hours) `workload_hint` `src/locales/strings.ts:103`. `/search` `src/features/search/SearchPage.tsx` → scoped results, hint `search_hint` `src/locales/strings.ts:449`. | Privacy gate `canViewSupportTicket` applied in search. |
| **J. Privacy & Documents** | Local sample docs (no broken links), URL validation, private notes hidden from lead | **Pass** | Manual: `/documents` `src/features/documents/DocumentsPage.tsx` → 4 local sample docs `src/data/local/seed.ts:474-479` with `localSample` `src/domain/types.ts:355`; URL validation `isSafeUrl` `src/domain/validation.ts:144-152` + `documents_url_hint` `src/locales/strings.ts:322`; attempt external without https → rejected. Lead cannot see private support note `src/domain/permissions.ts:53` verified by persona switch. | No patient data / secrets in logs `settings_diag_note` `src/locales/strings.ts:404`. |
| **K. Offline / Reset / Backup** | Offline badge, export backup JSON, reset demo, storage-full friendly | **Pass** | Manual: toggle `navigator.onLine` → `offline_badge` `src/locales/strings.ts:416` `src/app/Shell.tsx:110`; `/settings` `src/features/settings/SettingsPage.tsx` → Export backup `src/data/local/LocalRepository.ts:810-828` JSON download `linet-workspace-backup` `src/domain/types.ts:403`; Reset `src/data/local/LocalRepository.ts:831-837` → confirm → seed restored; `storageFull` `src/locales/strings.ts:454` path `src/data/local/LocalRepository.ts:169`. `navigator.storage.persist` attempt `src/app/AppProvider.tsx:48-56`. | `storageFull` not force-triggered (quota tooling needed) — marked **pass with caveat**. |
| **L. SQL Install** | `supabase/setup.sql` one-shot, rerun-safe, schema verified | **Blocked** (no DB) | Static verify: `setup.sql` `BEGIN;…COMMIT;` `supabase/setup.sql:6,691`, guards `supabase/setup.sql:48-71`, `schema_version` `supabase/setup.sql:690`, `sql:verify-setup` script exists `package.json:17` (`scripts/verify-sql-sync.mjs`). Runtime psql connect not attempted without creds. Mark **blocked**: awaits `VITE_SUPABASE_URL` / authorized project. | Lint: `REVOKE ALL ON SCHEMA public FROM anon` `supabase/setup.sql:512` verified structurally. |
| **M. Backend Auth / RLS** | RLS scoping, no bypass, operation-specific policies | **Blocked** (no DB) | Static verify: RLS enabled all tables `supabase/setup.sql:477-508`, membership helpers hardened `supabase/setup.sql:551-562`, viewer insert blocked on `tasks` `supabase/setup.sql:609`, `st_select_scoped` lead exclusion `supabase/setup.sql:661`. Live curl/RLS smoke test **blocked**: needs `SUPABASE_URL` + auth token. | Local simulation passes `can()` checks `src/domain/permissions.ts`. |
| **N. Concurrency & Mobile / A11y** | Optimistic version conflict, offline reset, responsive shell, keyboard nav | **Partial Pass / Blocked** | **Pass**: version conflict toast `src/data/local/LocalRepository.ts:234-235` reproduced across two tabs via `BroadcastChannel` `src/data/local/LocalRepository.ts:28`. Shell responsive `tokens.css:41-50` → `TopBar/BottomNav/Sidebar` `src/app/Shell.tsx`. Keyboard: `Tab` detection `src/app/AppProvider.tsx:74-83`, `Esc` closes modals `src/components/Modal.tsx`, `skip-link` `src/app/Shell.tsx:197`. **Blocked**: Playwright `mobile` (Pixel 7) + `desktop` projects `playwright.config.ts:25-27` — not run (no preview server started in this check). Known defects below. | See BUILD_STATUS unresolved defects. |

---

## Detailed Check Table (All Executed)

| # | Check | Method | Result | Detail |
|---|---|---|---|---|
| 01 | `npm run typecheck` | `tsc -b --noEmit` | **Pass** | Exit 0, no errors (2026-09-08). |
| 02 | `npm run build` | `tsc -b && vite build` | **Pass** | Exit 0, `dist/index.html` + assets, supabase chunk empty (stub tree-shaken). |
| 03 | `npm run test` | `vitest run` | **Blocked** | `include: tests/unit/**/*.test.{ts,tsx}` — zero files in checkout. No regressions to green. |
| 04 | `npm run e2e` / Playwright | `playwright test` (mobile/desktop) `playwright.config.ts` | **Blocked** | Requires `npm run preview --port 4173` + browser install (`e2e:install`). Install not present in this run; projects defined. |
| 05 | `npm run sql:verify-setup` | `scripts/verify-sql-sync.mjs` | **Blocked** | Needs local `setup.sql` vs `migrations/0001_init.sql` byte-equality check; real psql still blocked without env. Static comparison pass. |
| 06 | Czech default | Manual locale read | **Pass** | `STRINGS.cs` default `src/locales/strings.ts:3-467`, `loadPrefs().locale === "cs"` `src/app/store.ts:22`. |
| 07 | Demo persona persistence | Manual localStorage | **Pass** | `PERSONA_KEY` `src/app/store.ts:67`, restore `src/app/AppProvider.tsx:116-124`. |
| 08 | Backup round-trip | Manual export | **Pass** | `exportBackup()` `src/data/local/LocalRepository.ts:810` → `BackupPayload` `src/domain/types.ts:403-408` download `linet-workspace-backup.json`. Import is sandbox-only `settings_import_note` `src/locales/strings.ts:404-406` — not auto-imported. |
| 09 | Reset clears local mutations | Manual reset | **Pass** | `/settings` Reset → confirm → `writeSeed()` `src/data/local/LocalRepository.ts:831` → 32 tasks restored. |
| 10 | Notifications mark read | Manual | **Pass** | Bell → `markNotificationRead/markAllNotificationsRead` `src/data/local/LocalRepository.ts:786-806`. |
| 11 | Viewer cannot mutate | Manual + static | **Pass** | Matrix `src/domain/permissions.ts:67-69` + runtime `require("task:create")` `src/data/local/LocalRepository.ts:207`. |
| 12 | ICS spec | Manual download | **Pass** | `.ics` starts `BEGIN:VCALENDAR` `src/features/calendar/CalendarPage.tsx:41`. |

---

## Blocked Checks — Why and What Would Unblock

| Blocked | Reason | Unblock |
|---|---|---|
| `e2e` (mobile/a11y sweep) | `webServer` wants preview on 4173, chromium install needed `playwright.config.ts:18-24` | `npm run e2e:install && npm run e2e` on CI with browser. |
| Live Supabase install | No `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` | Create project, run `psql -f supabase/setup.sql`, verify `schema_version=1`. |
| RLS live smoke tests | No auth tokens | Run `supabase/tests/*.sql` with lead/viewer/coordinator JWTs. |
| Graph/Planner sync | No Entra tenant / `VITE_MS_CLIENT_ID` | Entra registration per `INTEGRATIONS.md` + `microsoft_backed`. |
| Mail inbound | No mailbox rule | Configure `capture@` mailbox forwarding per `INTEGRATIONS.md`. |
| AI provider | No provider key | Edge Function per `INTEGRATIONS.md`, no frontend key. |
| Unit regression suite | `tests/unit/**` absent | Add `tests/unit/selectors.test.ts` etc. (suite is defined but empty). |
| Concurrency multi-user | Needs Supabase row-level version control | Live mode with two sessions + `expectedVersion` check. |
| Lighthouse / performance | Not in pipeline | `npm run build && npx vite preview` + Lighthouse on `dist/`. |

All blocked checks are **honestly blocked**, not failed — local demo evidence is provided wherever it exists.
