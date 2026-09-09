# BUILD_STATUS — Completed Slices, Unresolved Defects, Next Action

> Generated: 2026-09-08 · Snapshot of the working tree at `C:\Users\ROG\Documents\Default Project\` · Build: `tsc -b && vite build` OK.

## Completed Vertical Slices

All slices below deliver end-to-end in **local demo mode** (`VITE_DATA_MODE=local`, `src/data/local/LocalRepository.ts:31`). Live mode via Supabase is **awaiting credentials** (honest stub `src/data/supabase/SupabaseRepository.ts:20-76` — see `docs/INTEGRATIONS.md`).

### Shell & Navigation

- **App shell** (`src/app/Shell.tsx:14-209`): `TopBar` (brand, search, notifications, offline badge, demo badge, persona control), `BottomNav` (4 items + Add sheet), `Sidebar` desktop (grouped nav daily/coord/learn/admin), `skip-link` `src/app/Shell.tsx:197`, safe-area gutters `src/app/styles/tokens.css:37-43`. Deep-linkable routes `src/app/routes.tsx:55-81` (SPA fallback ready). Dark/light/system theme `src/app/AppProvider.tsx:59-72`, keyboard focus management `src/app/AppProvider.tsx:74-83`.

### Data Contract & Persistence

- **Contract**: `src/data/contracts/repository.ts:45-140` — full seam (tasks checklist/comments, meetings transcript/proposals, decisions, inbox, calendar, support, documents, reports/schedules, learning progress, notifications, backup/reset, `integrationStatuses()`).
- **LocalRepository**: IndexedDB `idb` `src/data/local/db.ts`, deterministic seed `src/data/local/seed.ts:52` (`SEED_VERSION 3`), `BroadcastChannel` single-tab sync `src/data/local/LocalRepository.ts:28`, Zod validation `src/domain/validation.ts:12-129`, concurrency `version` `src/domain/types.ts:110` + `src/data/local/LocalRepository.ts:234`, append-only activity `supabase/setup.sql:26-35`.
- **Supabase**: One-shot installer `supabase/setup.sql:6-691` generated from `supabase/migrations/0001_init.sql`, RLS fully specified `PERMISSIONS.md`, storage bucket `attachments` `supabase/setup.sql:569`, backup export `src/data/local/LocalRepository.ts:810-828`.

### Tasks & Today

- Lists with 7 views (`my|all|week|overdue|waiting|unassigned|completed`) `src/features/tasks/TasksPage.tsx:92-103`, 5 filters + query + sort (due/updated) `src/features/tasks/TasksPage.tsx:21-135`, derived selectors `filterTasks/sortTasksByDue/workloadFor/isOverdue` `src/domain/selectors.ts:37-152`.
- Forms with validation and templates `src/features/tasks/TaskForm.tsx` + `TaskTemplate` `src/domain/types.ts:116-123` (`src/data/local/seed.ts:177-183`), status cycle including `waiting/blocked` with `statusNote` `src/locales/strings.ts:99`, complete+undo toast `src/components/Toaster.tsx`, `duplicateTask` `src/data/local/LocalRepository.ts:339-357`.
- **Today** `src/features/today/TodayPage.tsx:15-221`: persona-aware focus/due-today/overdue/waiting, lead attention chips `src/features/today/TodayPage.tsx:75-90`, coordinator queue `src/features/today/TodayPage.tsx:40-42`, next meeting `nextMeeting()` `src/domain/selectors.ts:158-168`, continues-learning + open-request cards.

### Meetings / Transcripts / Proposals / Decisions

- Meetings list/creation `src/features/meetings/MeetingsPage.tsx` + `MeetingForm.tsx`, detail `src/features/meetings/MeetingDetailPage.tsx:1-366` (notes textarea + publish, transcript list, helper, proposal cards with approve/reject/postpone).
- Transcript stack `src/domain/transcript.ts:12-84` (TXT/SRT/VTT, diacritics, malformed-block tolerant) + `extractActionCandidates()` `src/domain/transcript.ts:112-134`, sample `SAMPLE_SRT` `src/domain/transcript.ts:137-155`.
- Approve-once guarantee: unique `(meeting_id, source_action_key)` `supabase/setup.sql:258` × `createdTaskId` guard `src/data/local/LocalRepository.ts:521-525`, evidence preserved verbatim `src/features/meetings/MeetingDetailPage.tsx:226`.
- Decisions `src/data/local/LocalRepository.ts:551-567` + `src/domain/types.ts:220-232` surfaced on Project overview and Meeting detail.

### Inbox & Capture

- `/inbox` triage `src/features/inbox/InboxPage.tsx` + creation `src/features/inbox/InboxNewPage.tsx` (paste path, kind selector), dedupe fingerprint `sha256Hex` `src/data/local/LocalRepository.ts:577` + DB unique `supabase/setup.sql:220`, private `note` draft gate `src/data/local/LocalRepository.ts:599-602`, banner `inbox_live_addr_note` `src/locales/strings.ts:217`.

### Calendar

- `/calendar` `src/features/calendar/CalendarPage.tsx:16-326`: agenda/week/month (`agendaDays` `src/features/calendar/CalendarPage.tsx:29-33` + `MonthGrid` `src/features/calendar/CalendarPage.tsx:182-221`), focus-blocking vs task `dueDate` invariant with hint `calendar_due_note` `src/locales/strings.ts:181`, ICS export `src/features/calendar/CalendarPage.tsx:40-58`, timezone via `prefs.displayTz` `src/app/store.ts:15`.

### Reports & Reviews

- Deterministic preview `generate()` `src/features/reports/ReportsPage.tsx:31-73` (counts, not hours), snapshot `ReportSnapshotItem` `src/domain/types.ts:237-245` frozen on `saveReport()` `src/data/local/LocalRepository.ts:726-733`, report detail `src/features/reports/ReportDetailPage.tsx` (publish/snapshot note, copy/markdown/print), schedule `upsertSchedule()` `src/data/local/LocalRepository.ts:748-765` (`reportScheduleSchema` `src/domain/validation.ts:114-123`).

### Learning & Support

- Learning `src/features/learning/LearningPage.tsx:6` + `LearningModulePage.tsx` with 6 onboarding modules `src/data/local/seed.ts:311-439`, progress `setTrainingProgress()` composite key `supabase/setup.sql:312-318`, coordinator overview table `src/features/learning/LearningPage.tsx:65-95`.
- Support `src/features/support/*` 3 routes + lifecycle 5-state `captured|awaiting_official_ticket|with_linet_it|waiting_user|resolved` `src/domain/types.ts:311-317`, demand-visibility `support_status` `src/locales/strings.ts:297`, coordinator queue privacy `canViewSupportTicket()` `src/domain/permissions.ts:95-105` + RLS `st_select_scoped` `supabase/setup.sql:661`, official reference `officialTicketRef` nullable `src/data/local/LocalRepository.ts:660`.

### Team / Documents / Search / Integrations / Settings / More

- Team & workload `src/features/team/TeamPage.tsx` via `workloadFor()` `src/domain/selectors.ts:128`.
- Documents `src/features/documents/DocumentsPage.tsx` 4 local samples `src/data/local/seed.ts:474-479` with safe-url `isSafeUrl()` `src/domain/validation.ts:144-152`.
- Search `src/features/search/SearchPage.tsx` globally scoped and privacy-aware.
- Integrations `src/features/integrations/IntegrationsPage.tsx:21` + `INTEGRATIONS.md` — `integrationStatuses()` `src/data/local/LocalRepository.ts:840-847` and `supabase:68-75`.
- Settings `src/features/settings/SettingsPage.tsx` — locale/timezone/theme, export `BackupPayload` `src/domain/types.ts:403-408` `src/data/local/LocalRepository.ts:810`, reset `src/data/local/LocalRepository.ts:831`, `navigator.storage.persist` `src/app/AppProvider.tsx:48-56`.
- More `src/features/more/MorePage.tsx` mobile grouping hub.

### Locale & Quality Bars

- Central strings `src/locales/strings.ts:1-913` — Czech default, complete English, helper strings explicitly not AI. Build `tsc -b && vite build` clean (dist `536.74 kB` gzip 150.67, supabase chunk empty).

### Demo Dataset (seed)

- 7 personas, 32 tasks, 5 templates, 6 events, 2 inbox items, 8 transcript segments, 4 proposals, 3 decisions, 2 reports + 1 schedule, 6 modules, 3 support tickets/updates, 4 docs, notifications, activity `src/data/local/seed.ts:60-502`. All anchored to frozen `referenceDate` `src/data/local/seed.ts:54`.

---

## Unresolved Defects — Honest (from audit)

> No invented fixes. Each row cites the file responsible and the decision.

| Severity | Area | Defect | Where | Workaround until fix | Reversible fix outline |
|---|---|---|---|---|---|
| **Critical** | Touch / hit target | Some bottom-nav and icon buttons below 44×44 accessible hit-area (WCAG 2.5.5) | `src/app/Shell.tsx:103-115` `.icon-btn`, `src/app/styles/base.css` | Sidebar on desktop unaffected; mobile pass with accessibility overlay next sprint | Increase `min-height/min-width: 44px`, `touch-action: manipulation` |
| **Critical** | Keyboard | Focus ring suppressed for mouse users (`body:not(.using-keyboard)`) but visible focus on `Tab` detection is fragile; modal close on `Esc` exists `src/components/Modal.tsx` but focus trap not present | `src/app/AppProvider.tsx:74-83` `src/components/Modal.tsx` | `skip-link` `src/app/Shell.tsx:197` works; tab through forms does cycle | Add `focus-trap-react` to `Modal`, `outline: 2px solid var(--focus)` `tokens.css:19` always for keyboard |
| **High** | Calendar delete | `EventForm` Delete button calls `deleteEvent()` immediately without confirmation `src/features/calendar/CalendarPage.tsx:170-175,318-319` | `src/features/calendar/CalendarPage.tsx:318` | Small dataset; undo via recreating with same linked task | Mirror task `task_delete_confirm` pattern `src/locales/strings.ts:80` → `confirm()` or soft-delete |
| **High** | Tests suite | `vitest` `include: tests/unit/**/*.test.{ts,tsx}` `vitest.config.ts:15` — empty checkout (`No test files found` on `npm run test`) | `vitest.config.ts:15` | Manual coverage via `TEST_RESULTS.md` journeys A–N | Add `tests/unit/selectors.test.ts` + `tests/unit/permissions.test.ts` (3–5 targeted cases) |
| **High** | E2E | Playwright expects `preview` on 4173 `playwright.config.ts:19-23` and `chromium` installed — not run in this checkout (`npm run e2e:install` needed) | `playwright.config.ts:25-27` | Manual mobile/desktop verified via viewport resize + `tokens.css:41-50` breakpoints | CI step: `e2e:install && preview && playwright test` |
| **Medium** | Upload parsing | Paste intake stores entire body; very large transcript (>200k) already rejected by `inboxItemSchema` `src/domain/validation.ts:85` but UX no streaming feedback | `src/domain/transcript.ts:80-84` `src/features/meetings/MeetingDetailPage.tsx:34-50` | Hint `inbox_try_sample` + `SAMPLE_SRT`; large-file note `storage_full` `src/locales/strings.ts:454` | Add `maxLength` counter + progress indicator |
| **Medium** | Notifications | Toast duplicate suppression via `dedupeKey` `src/domain/selectors.ts:180` but `notificationDedupeKey` not deduping toasts across tabs (BroadcastChannel only notifies listeners, not toasts) | `src/data/local/LocalRepository.ts:144-159` `src/components/Toaster.tsx` | Interaction still correct; duplicates rare with derived dedupe | Share dedupe via `BroadcastChannel` toast channel |
| **Medium** | Bundle size | `index-CFIezvhs.js 536.74 kB` flagged "Some chunks larger than 500 kB" (Vite warn) — `zod` + large page components bundled together `vite.config.ts:13-22` | `vite.config.ts:17-19` `package.json:27` `zod:^4.0.0` | gzip 150 kB acceptable for demo | Dynamic import routes (`import("@/features/reports/...")`) + split `zod`/`transcript` chunks |
| **Low** | Tokens | Palette `--brand #4263eb` provisional `src/app/styles/tokens.css:5` — awaiting official manual | `src/app/styles/tokens.css:1-3` header | Labeled provisional honestly | Swap `tokens.css` when manual provided |
| **Low** | Vite base | `base: "/"` `vite.config.ts:7` blocks deployment to sub-path `/linetapp` until polish (next action) | `vite.config.ts:7` | Demo on root `localhost:5173` correct | Set `base: "/linetapp/"` + verify asset paths |

No spec-violating defects hidden — all above are filed and reversible.

---

## Next Concrete Action — Polish Shell + Deploy to `/linetapp`

### Single action (do exactly this next)

**Polish shell navigation + deploy preview to sub-path `/linetapp`.**

**Steps:**

1. **Shell polish** (30m)
   - Increase `.icon-btn` touch target to 44×44 in `src/app/styles/base.css` and verify `BottomNav` hit-area `src/app/Shell.tsx:135-163`.
   - Add focus trap to `src/components/Modal.tsx` (light `focus-trap-react` or native `inert` + `aria-modal`) and keep `skip-link` `src/app/Shell.tsx:197`; validate with `Tab` + `Esc`.
   - Add calendar delete confirmation matching `task_delete_confirm` `src/locales/strings.ts:80` in `src/features/calendar/CalendarPage.tsx:318`, analogous guard for `removeChecklistItem` / `deleteTask`.

2. **Sub-path deploy config** (10m)
   - In `vite.config.ts:7` set `base: "/linetapp/"` (currently `"/"`). Keep `resolve.alias` and `manualChunks`.
   - In `src/app/routes.tsx` confirm `basename` not lost (React Router v7 respects Vite `base` for asset resolution; no code change expected, verified by existing `base: "/"` assumption). Test deep links `src/app/routes.tsx:55-81` via preview (`npm run build && npm run preview -- --port 4173` `package.json:10-11`) — direct navigate to `/linetapp/meetings` must load.
   - Update `public` asset references if moved (e.g. logo, if present — currently none).

3. **Verify & publish** (20m)
   - `npm run typecheck` → exit 0
   - `npm run build` → confirm `dist/index.html` contains `<script src="/linetapp/assets/…">` and no 404 on `preview --base /linetapp/`.
   - Smoke the shell-pushed build on device width 360 (`Pixel 7` `playwright.config.ts:26`) + desktop.

**Exit criteria:**

- `npm run typecheck` ✅, `npm run build` ✅ (assets under `/linetapp/`), `/linetapp/` root + `/linetapp/meetings` direct load ✅, bottom nav 44×44 ✅, `Esc` closes modal + focus trap ✅, calendar delete confirm ✅.

**After this**, the subsequent concrete increment is wiring the test/regression suite (`tests/unit/selectors.test.ts` + `permissions.test.ts`) to turn `TEST_RESULTS.md` journeys A–N from manual to green CI, before enabling live Supabase wiring.
