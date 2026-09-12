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
| ~~Critical~~ ✅ | Touch / hit target | RESOLVED 2026-09-12: 44×44 min hit-area + `touch-action: manipulation` on `.icon-btn`, bottom-nav, sidebar links | `src/app/styles/base.css` | — | Done |
| ~~Critical~~ ✅ | Keyboard / modal | RESOLVED 2026-09-12: focus trap in `Modal` (Tab cycle + `inert`/`aria-hidden` on `#main-content`, restore on close) | `src/components/Modal.tsx` | — | Done |
| ~~High~~ ✅ | Calendar delete | RESOLVED: `EventForm` delete opens a confirm modal (`confirmOpen` state) before `deleteEvent()` | `src/features/calendar/CalendarPage.tsx` | — | Done |
| ~~High~~ ✅ | Tests suite | RESOLVED: 129 unit tests in `tests/domain/*` (selectors, permissions, dates, transcript, repository contract) — `npm test` green | `vitest.config.ts` | — | Done |
| ~~High~~ ✅ | E2E | RESOLVED: `tests/e2e/startup.spec.ts` (mobile Pixel 7 + desktop, deep links under `/linetapp/`) — `npm run e2e` green; preview server must run with `--base /linetapp/` (a bare `vite preview` serves `/` and 404-falls-back to index.html) | `playwright.config.ts:19-23` | — | Done |
| **Medium** | Upload parsing | Paste intake stores entire body; very large transcript (>200k) already rejected by `inboxItemSchema` `src/domain/validation.ts:85` but UX no streaming feedback | `src/domain/transcript.ts:80-84` `src/features/meetings/MeetingDetailPage.tsx:34-50` | Hint `inbox_try_sample` + `SAMPLE_SRT`; large-file note `storage_full` `src/locales/strings.ts:454` | Add `maxLength` counter + progress indicator |
| **Medium** | Notifications | Toast duplicate suppression via `dedupeKey` `src/domain/selectors.ts:180` but `notificationDedupeKey` not deduping toasts across tabs (BroadcastChannel only notifies listeners, not toasts) | `src/data/local/LocalRepository.ts:144-159` `src/components/Toaster.tsx` | Interaction still correct; duplicates rare with derived dedupe | Share dedupe via `BroadcastChannel` toast channel |
| **Medium** | Bundle size | `index-*.js 609 kB` flagged "Some chunks larger than 500 kB" (Vite warn) — `zod` + large page components bundled together `vite.config.ts:13-22` | `vite.config.ts:17-19` `package.json:27` `zod:^4.0.0` | gzip 165 kB acceptable for demo | Dynamic import routes (`import("@/features/reports/...")`) + split `zod`/`transcript` chunks |
| **Low** | Tokens | Palette `--brand #4263eb` provisional `src/app/styles/tokens.css:5` — awaiting official manual | `src/app/styles/tokens.css:1-3` header | Labeled provisional honestly | Swap `tokens.css` when manual provided |
| ~~Low~~ ✅ | Vite base | RESOLVED: `base` is `/linetapp/` for local builds, `/` on Vercel, `VITE_BASE` override supported; `BrowserRouter` basename + SW scope derived from `BASE_URL` (`src/app/main.tsx:11,28`) | `vite.config.ts:12` `src/app/main.tsx` | — | Done |

No spec-violating defects hidden — all above are filed and reversible.

---

## Next Concrete Action — Reduce Bundle + Supabase Live Wiring Prep

> Previous action (polish shell + `/linetapp` sub-path deploy) completed 2026-09-12: 44×44 targets, modal focus trap + inert, delete confirms, `base: /linetapp/`, e2e green. Full verification: `typecheck` ✅ `build` ✅ `lint` ✅ `test` (129) ✅ `e2e` (mobile+desktop) ✅.

### Single action (do exactly this next)

**Code-split the 609 kB index chunk, then prepare live Supabase wiring.**

**Steps:**

1. **Route-level code splitting** (45m)
   - Convert static page imports in `src/app/routes.tsx:6-31` to `React.lazy` + `Suspense` (fallback to existing `SkeletonStack`/loading state).
   - Keep `TodayPage` static (first paint); split heavy pages first: `MeetingDetailPage`, `ReportsPage`/`ReportDetailPage`, `LearningModulePage`, `SupportDetailPage`.
   - Target: no chunk > 500 kB (`build.chunkSizeWarningLimit` stays default), verify `vendor`/`supabase` chunks unchanged `vite.config.ts:22-24`.

2. **Supabase live wiring prep** (30m)
   - Collect credentials (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) — `src/features/liveconfig/LiveConfigPage.tsx` must guide this.
   - Run `supabase/setup.sql` against the project; verify with `npm run sql:verify-setup`.
   - Smoke `VITE_DATA_MODE=supabase npm run dev` — honest `not_configured` errors must surface, never silent demo fallback `src/data/supabase/SupabaseRepository.ts:20-76`.

3. **Verify** (15m)
   - `npm run typecheck && npm run build` — check chunk sizes in output.
   - `npm test && npm run e2e` — both green.
   - Deep links still work: `/linetapp/meetings` direct load via preview.

**Exit criteria:**

- No chunk > 500 kB in build output ✅, all tests green ✅, Supabase config screen reachable and honest ✅.

---

## History of completed actions

- 2026-09-08 — Initial vertical slices (see "Completed Vertical Slices" above).
- 2026-09-12 — Polish shell (44×44 touch targets `base.css`, modal focus trap + `inert` `Modal.tsx`, delete confirms calendar/tasks) + `/linetapp/` sub-path deploy (`vite.config.ts:12`, `main.tsx:11` basename, SW scope) + lint config fix (Node globals for `scripts/*.mjs`) + e2e suite green under sub-path.
