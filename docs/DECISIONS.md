# DECISIONS — Reversible Choices Made Without Product Clarification

> Generated: 2026-09-08 · All choices reversible and documented. Tone: factual. Paths are actual file locations.

## D1 — Stack: Vite + React + TypeScript (strict) + React Router

| Field | Content |
|---|---|
| **Context** | Need a single-page, mobile-first workspace that runs entirely in the browser with no mandatory server, but can swap to Supabase live mode via a seam. Must support deep links, offline demo, and Czech/English. |
| **Decision** | `vite: ^7.0.0`, `react: ^19.0.0`, `react-router-dom: ^7.0.0`, `typescript: ~5.9.0` strict, `zod: ^4.0.0` for validation — `package.json:20-42`, `vite.config.ts:1-32`. Build `tsc -b && vite build`. |
| **Alternatives considered** | Next.js (SSR overkill for demo-local), CRA (deprecated), SvelteKit (team React familiarity), Nextra/Remix (heavier server dependency). |
| **Reversibility** | **Reversible**. Vite `base: "/"` `vite.config.ts:7`, SPA fallback relied on. Swapping renderer would touch `src/app/` + `src/features/*` but `src/domain/` and `src/data/contracts/` are framework-agnostic. |

## D2 — State & Persistence: IndexedDB (via `idb`) + LocalRepository, Supabase as Stub

| Field | Content |
|---|---|
| **Context** | Original prompt asked for "Verified vs awaits-credentials": demo must work with no credentials, live must require them and never silently degrade to demo. |
| **Decision** | Single `WorkspaceRepository` contract `src/data/contracts/repository.ts:45-140` with `LocalRepository` over IndexedDB (`idb` `src/data/local/db.ts`) as default, `SupabaseRepository` as honest stub `src/data/supabase/SupabaseRepository.ts:20-76` (returns `not_configured`). Boot path `src/app/AppProvider.tsx:21-32` lazy-loads Supabase only when `VITE_DATA_MODE=supabase`. |
| **Alternatives** | `localStorage` only (quota, no indexing), `op-sqlite`, direct Supabase client everywhere (demo would need network). |
| **Reversibility** | **Reversible**. Seam is the import boundary `createSupabaseRepository()`. Upgrading Supabase from stub to real client is additive; `LocalRepository` stays for demo/offline and backup fixtures. |

## D3 — Persona Simulation Instead of Real Auth

| Field | Content |
|---|---|
| **Context** | Prompt requires realistic permission demo but prod auth was not scoped (no tenant, no user provisioning). Must make privacy boundaries visible without inventing surnames/accounts. |
| **Decision** | Demo persona switcher stored as `linet-workspace-persona` `src/app/store.ts:67` + `LocalRepository.setPersona()` `src/data/local/LocalRepository.ts:38-40`, restored on boot `src/app/AppProvider.tsx:116-124`. Explicitly labeled simulation `persona_note` `src/locales/strings.ts:409` "Simulace pro demonstraci — není to přihlášení…". Emails `example.invalid`. |
| **Alternatives** | Real Supabase Auth email/password (requires project), mock JWT. |
| **Reversibility** | **Reversible**. Replace `setPersona/localStorage` with real auth session and `profiles/auth.users` — `supabase/setup.sql:75-80` schema already awaits it. UI already consumes `persona?.role` via `can()` so migration is localized. |

## D4 — CSS Tokens Are Provisional, Not Claimed Brand Truth

| Field | Content |
|---|---|
| **Context** | No verified LINET brand manual was supplied. Prompt warns against fabricating. Must be visually usable but honestly provisional. |
| **Decision** | `src/app/styles/tokens.css:1-80` header states: "provisional design tokens … accent values are provisional until verified brand assets are supplied." Token set: `--brand #4263eb`, radius, shadow, gutters 16→24→28 `tokens.css:5-38`, light+dark theme `tokens.css:54-72`, `prefers-reduced-motion` kill `tokens.css:74-79`. Base reset `src/app/styles/base.css`. |
| **Alternatives** | Hard-coding official-looking LINET palette, inlining brand claim, adopting Tailwind config. |
| **Reversibility** | **Trivially reversible**. Swap `tokens.css` and keep class names; no JS dependency on token values. |

## D5 — Seed Demo Dataset (Deterministic, Frozen Reference Date)

| Field | Content |
|---|---|
| **Context** | Need a narratively coherent demo (PNG hospital project) that survives reloads and shows all states without shifting deadlines. |
| **Decision** | `SEED_VERSION = 3` `src/data/local/seed.ts:16`, `buildSeed(now)` `src/data/local/seed.ts:52` with deterministic IDs `src/data/local/seed.ts:19-48`, deadlines anchored `addDaysDateOnly(T, days)` off frozen `referenceDate` `src/data/local/seed.ts:56-58`, 32 tasks `/177-183` templates / 6 events / 8 transcript segments / 4 proposals / 3 decisions / 3 tickets `src/data/local/seed.ts:117-502`. Seeded once, never silently re-seeded over user data `src/data/local/LocalRepository.ts:63-71`. Backup fixture export `scripts/export-demo-fixture.mjs` `package.json:18`. |
| **Alternatives** | Remote fixture fetch, randomized seed, no seed (empty demo). |
| **Reversibility** | **Reversible**. Bump `SEED_VERSION` triggers `writeSeed()`; `resetDemoData()` `src/data/local/LocalRepository.ts:831` restores seed. Moving to live, seed is irrelevant — RLS governs real data. |

## D6 — Deterministic Transcript Helper (Not AI)

| Field | Content |
|---|---|
| **Context** | Prompt demands AI honesty — helper must not hallucinate titles/owners/dates and must require human review. |
| **Decision** | `parseTxt/parseSrt/parseVtt/detectFormat` `src/domain/transcript.ts:12-84` (tolerates missing speaker/timestamps, skips malformed blocks), `extractActionCandidates()` `src/domain/transcript.ts:112-134` via Czech/English hints `ACTION_HINTS_CS/EN` `src/domain/transcript.ts:92-102`, evidence preserved verbatim, `proposedOwnerId: null` and `proposedDueDate: null` for relative phrases with confirmation banner `meeting_relative_date_confirm` `src/locales/strings.ts:161`, unique `sourceActionKey` dedupe `src/data/local/LocalRepository.ts:487-488` + DB unique `supabase/setup.sql:258`. |
| **Alternatives** | Client-side AI call, regex over entire document, server LLM. |
| **Reversibility** | **Reversible / augmentable.** `ExtractionMethod` union `src/domain/types.ts:198` already has `ai_provider` slot; provider can be added as server Edge Function without changing helper. |

## D7 — Reporting: Deterministic Snapshots, Not Background Jobs

| Field | Content |
|---|---|
| **Context** | Reports must be derived from actual authorized records, frozen on save, reproducible. Background delivery/mail out was not ready in demo but schedule UX was expected. |
| **Decision** | `Report`/`ReportSchedule` `src/domain/types.ts:234-276` — local deterministic builder `src/features/reports/ReportsPage.tsx:31-73` groups `completed|upcoming|overdue|blocker|decision`, `saveReport()` freezes snapshot `ReportSnapshotItem[]` `src/domain/types.ts:237-245`, `upsertSchedule()` `src/data/local/LocalRepository.ts:748-765` validates `reportScheduleSchema` `src/domain/validation.ts:114-123`. No scheduler runs; banner `report_demo_send_note` `src/locales/strings.ts:258`. |
| **Alternatives** | Cron-backed `integration_jobs` scheduler (schema ready `supabase/setup.sql:411`), fully AI-written commentary. |
| **Reversibility** | **Reversible**. `integration_jobs` + `report_schedules` tables `supabase/setup.sql:285-297` are schedule-ready; swapping preview-only to real dispatch is server work. |

## D8 — Onboarding Path of Exactly 6 Modules

| Field | Content |
|---|---|
| **Context** | Prompt names ~6 onboarding topics (Teams, Copilot safety, folder rules, task workflow, weekly review, IT help request). Content ownership/review status required. |
| **Decision** | 6 `TrainingModule` with `isOnboardingPath: true` `src/data/local/seed.ts:311-439`: teams-collab, copilot-basics, file-sharing, task-workflow, weekly-review, it-help — each with `content/contentEn`, `checklist`, `estimatedMinutes` (5-10, clearly labelled estimate `learning_minutes` `src/locales/strings.ts:270`), `contentOwner: "Oliver"`, `reviewStatus: "in_review"` `src/domain/types.ts:294`, progress `src/data/local/LocalRepository.ts:768-784`, overview `src/features/learning/LearningPage.tsx:15-95`. |
| **Alternatives** | 3 super-modules, 10 micro-lessons, external LMS embed. |
| **Reversibility** | **Reversible**. Add/remove modules by inserting rows — `slug` is key `supabase/setup.sql:300` `CHECK slug ~ '^[a-z0-9-]+$'`; progression keyed by `(moduleId, personId)` `supabase/setup.sql:312-318`. |

## D9 — Support Lifecycle 5-State (Requester vs Coordinator Visibility)

| Field | Content |
|---|---|
| **Context** | Prompt says support is coordination overlay, not official service desk — app ≠ ticket creation, official reference must never be fabricated. |
| **Decision** | `SupportStatus: captured | awaiting_official_ticket | with_linet_it | waiting_user | resolved` `src/domain/types.ts:311-317` + `category/supportCategories` `src/domain/types.ts:310` + `impact` `src/locales/strings.ts:294-297`. Visibility `canViewSupportTicket()` `src/domain/permissions.ts:95-105` (coordinator/admin/requester), RLS clone `st_select_scoped` `supabase/setup.sql:661`, `officialTicketRef` nullable with helper `support_official_ref_hint` `src/locales/strings.ts:298`. Lifecycle transitions are manual; no auto-escalation. |
| **Alternatives** | 3-state (open/pending/closed), automatic ticket creation via Graph. |
| **Reversibility** | **Reversible**. Adding states is an `enum` extension `supabase/setup.sql:327` + `support_status` locale entry; removing states requires migration. |

## D10 — Calendar / Focus-Block Design (Task Due Date Never Mutated)

| Field | Content |
|---|---|
| **Context** | Calendar is for time-blocking and visibility; the authoritative commitment is still `task.dueDate: YYYY-MM-DD` (`TaskSource` `src/domain/types.ts:53`). Prompt warns against ambiguous deadline handling. |
| **Decision** | `CalendarEvent` `src/domain/types.ts:128-145` with `dateMode: date_only|timed`, `linkedTaskId` (nullable), `durationMin`, `timezone`, hint `calendar_due_note` `src/locales/strings.ts:181-182` — focus-block creation path `src/features/calendar/CalendarPage.tsx:230-276` never writes `task.dueDate`. ICS export is local file, not invitation `calendar_ics_note` `src/locales/strings.ts:183` `src/features/calendar/CalendarPage.tsx:40-58`. |
| **Alternatives** | Bidirectional sync of calendar event → task due date (risky), Outlook Graph sync. |
| **Reversibility** | **Reversible**. Adding sync is additive via `external_links.syncState` `src/domain/types.ts:399`; opting out stays valid. |

## D11 — Optimistic Concurrency via `Task.version`

| Field | Content |
|---|---|
| **Context** | Multi-tab `BroadcastChannel` (`linet-workspace-sync` `src/data/local/LocalRepository.ts:28`) + future multi-user live mode require conflict detection without heavy locking. |
| **Decision** | `Task.version: number` `src/domain/types.ts:110`, `taskUpdateSchema.expectedVersion` `src/domain/validation.ts:38`, checked in `updateTask()` `src/data/local/LocalRepository.ts:234-235` with error `{code:"conflict", message:"…změněn někým jiným…"}`. Auto-increment on every mutation `src/data/local/LocalRepository.ts:247`. |
| **Alternatives** | Last-write-wins, ETag on row, CRDT. |
| **Reversibility** | **Reversible**. Replace with server `updated_at` comparison; version kept compatible with `tasks.version` `supabase/setup.sql:157`. |

## D12 — Mobile-First Shell: Bottom Nav + Top Bar + Sidebar (Progressive)

| Field | Content |
|---|---|
| **Context** | Prompt: "mobile-first". Must accommodate thumbs, bottom nav, safe areas, desktop sidebar, keyboard access. |
| **Decision** | `src/app/Shell.tsx:14-209` — `TopBar` (brand + search/bell/+ + offline badge `offline_badge` `src/locales/strings.ts:416`), `BottomNav` (4 items + central Add `nav-add`), `Sidebar` desktop (grouped daily/coord/learn/admin), `skip-link` `src/app/Shell.tsx:197`, tokens gutters `tokens.css:37-43`. |
| **Alternatives** | Pure bottom nav, hamburger-only, desktop-first. |
| **Reversibility** | **Reversible**. CSS-only; changing nav costs no data migration. See `BUILD_STATUS.md` for outstanding a11y defects (focus ring, touch target). |

---

## Cross-Cutting Honesty Notes

- **No Surnames / No Budget Fabrications** — enforced by seed (`src/data/local/seed.ts:60-78` comment) and locales (weekly review, reports).
- **No Silent Fallback** — `AppProvider` `src/app/AppProvider.tsx:102-108` surfaces `not_configured` as error with `LiveConfigPage`; `SupabaseRepository` docs `src/data/supabase/SupabaseRepository.ts:2-17`.
- **Token Provisionality** — `tokens.css:1-3` header is load-bearing documentation.
