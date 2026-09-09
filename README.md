# LINET Workspace

> Mobile-first internal digital-working and project-coordination app — pilot for the Papua New Guinea hospital project. Czech default language, English complete. Runs fully offline in demo mode with no cloud credentials.

Stack: **React 19 + TypeScript 5.9 + Vite 7 + React Router 7 + IndexedDB (`idb`) + Supabase (live stub) + Zod + Vitest + Playwright.**

---

## Commands

All scripts are defined in `package.json:7-18`. Run from the project root.

| Command | What it does |
|---|---|
| `npm install` | Install dependencies. |
| `npm run dev` | Start Vite dev server on `http://localhost:5173` (host enabled, `vite.config.ts:24-26`). |
| `npm run build` | Type-check (`tsc -b`) then production build (`vite build`). Output in `dist/`. |
| `npm run preview` | Preview the production build on `http://localhost:4173` (`vite.config.ts:28-31`). |
| `npm run typecheck` | Type-check only (`tsc -b --noEmit`), no emit. |
| `npm run lint` | Lint `src` and `scripts` with ESLint (`eslint.config.js`). |
| `npm run test` | Run unit/domain tests once with Vitest (`vitest run`, `vitest.config.ts:12-17`). |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run e2e` | Playwright end-to-end tests (`playwright.config.ts`). First run `npm run e2e:install` to install Chromium. |
| `npm run e2e:install` | Install Playwright Chromium browser. |
| `npm run sql:verify-setup` | Verify `supabase/setup.sql` matches `supabase/migrations/0001_init.sql` and contains no destructive unguarded DDL (`scripts/verify-sql-sync.mjs`). |
| `npm run backup:export-demo` | Export local demo fixture (IndexedDB snapshot helper, `scripts/export-demo-fixture.mjs`). |

Additional verification:

```bash
npm run typecheck   # fast type gate
npm run build       # full gate used in CI
npm run sql:verify-setup  # SQL sync gate
```

---

## Architecture Overview

### Stack

- **React 19 + TypeScript 5.9 + Vite 7** — SPA with `base: "/"` (`vite.config.ts:7`), alias `@` → `src/` (`vite.config.ts:8-11`). Manual chunks `vendor` + `supabase` (`vite.config.ts:15-19`).
- **React Router 7** — route table in `src/app/routes.tsx:55-81`.
- **IndexedDB via `idb`** — local persistence `src/data/local/db.ts` (`openWorkspaceDB`), requested `navigator.storage.persist()` (`src/app/AppProvider.tsx:48-56`).
- **Supabase JS 2.45** — live repository stub `src/data/supabase/SupabaseRepository.ts:8-76` (honest `not_configured` until credentials).
- **Zod 4** — validation schemas `src/domain/validation.ts`.
- **Vitest 3 + jsdom + Testing Library** — unit/domain config `vitest.config.ts:12-17`, setup `tests/setup.ts`.
- **Playwright 1.63** — e2e config `playwright.config.ts`.

### Folder Structure

```
src/
  app/
    main.tsx            # entry, mounts <AppProvider> + <RouterProvider>
    routes.tsx          # route table (M01–M12), /liveconfig guard
    store.ts            # persona simulation, locale/timezone/theme
    AppProvider.tsx     # repository selection (local vs supabase), persist hint
  features/
    today/              # Today / focus + undo (M02, M05, M11)
    tasks/              # Tasks CRUD, Kanban/list, templates (M02)
    project/            # Project overview, workstreams/labels (M03)
    calendar/           # Agenda/week/month, focus blocks, ICS export (M05)
    meetings/           # Meetings, transcript import, action proposals (M06)
    inbox/              # Inbox triage, paste intake, fingerprint (M08)
    reports/            # Reports, snapshots, schedule (M09)
    learning/           # 6-module onboarding, progress (M01, M10)
    support/            # IT tickets 5-state lifecycle (M11)
    documents/          # Documents library (M12)
    search/             # Global search, permission-aware (M12)
    integrations/       # Capability status pills (M12)
    settings/           # Locale/timezone/theme, backup/reset (M12)
    liveconfig/         # Missing-config screen for supabase mode (honesty)
  domain/
    types.ts            # Project, Task, CalendarEvent, InboxItem, Meeting,
                        # Decision, Report, TrainingModule, SupportTicket,
                        # DocumentRecord, CapabilityState, IntegrationStatus, …
    validation.ts       # Zod schemas (taskDraftSchema, calendarEventSchema, …)
    permissions.ts      # canViewSupportTicket, RLS-aligned helpers
    selectors.ts        # projectCompletionRatio (task ratio, NOT hospital)
    transcript.ts       # parseTxt/Srt/Vtt, extractActionCandidates (deterministic)
  data/
    contracts/
      repository.ts     # WorkspaceRepository interface (single contract)
    local/
      db.ts             # IndexedDB schema + openWorkspaceDB
      seed.ts           # deterministic demo dataset (32 tasks, 6 workstreams, …)
      LocalRepository.ts # full WorkspaceRepository impl (IndexedDB)
    supabase/
      SupabaseRepository.ts # honest stub — every op returns not_configured
  lib/
    dates.ts            # localInputToInstant, formatInstant, todayInZone
    utils.ts            # downloadFile, sha256Hex, …
  locales/
    strings.ts          # cs (default) + en strings, typed
  components/           # shared UI (layout, cards, pills, …)
supabase/
  setup.sql             # one-shot installer (BEGIN;…COMMIT;, rerun-safe)
  migrations/
    0001_init.sql       # canonical migration — setup.sql is generated from it
  functions/            # Edge Functions placeholder (AI/mail — server-only)
  tests/                # RLS smoke-test SQL
public/
  manifest.webmanifest  # PWA manifest (name LINET Workspace, /linetapp/)
  sw.js                 # minimal service worker (cache linet-ws-v1)
  icons/
    favicon.svg         # 32×32 SVG favicon (blue #4263eb)
    icon-192.png        # PWA icon 192
    icon-512.png        # PWA icon 512
tests/
  setup.ts              # Vitest/jsdom setup (matchMedia, IO, RO, randomUUID)
  unit/                 # unit tests (vitest include: tests/unit/**/*.test.*)
  domain/               # domain tests (tests/domain/**/*.test.ts)
scripts/
  verify-sql-sync.mjs   # sql:verify-setup
  export-demo-fixture.mjs # backup:export-demo
docs/
  REQUIREMENTS.md       # M01–M12 traceability matrix
  INTEGRATIONS.md       # capability states, setup paths, honest inventory
  PERMISSIONS.md        # roles, RLS, visibility gates
  DECISIONS.md          # ADRs
  DEMO_WALKTHROUGH.md   # click-through demo script
  TEST_RESULTS.md       # manual verification log
```

Domain contract: `src/data/contracts/repository.ts`. Permissions: `src/domain/permissions.ts`. Selectors: `src/domain/selectors.ts`. Locale: `src/locales/strings.ts:1`.

---

## Modes

The app has exactly two data modes, selected by `VITE_DATA_MODE` (`.env.example:11`).

| Mode | Env | Storage | When to use |
|---|---|---|---|
| **local (demo)** — **default** | `VITE_DATA_MODE=local` or unset | IndexedDB (`idb`) on this device, `navigator.storage.persist()` best-effort (`src/data/local/db.ts`, `src/app/AppProvider.tsx:48-56`) | Zero-config demo, offline, CI, e2e, no credentials needed. Deterministic seed `src/data/local/seed.ts`. |
| **supabase (live)** | `VITE_DATA_MODE=supabase` + `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | Authorized Supabase project (Postgres + RLS + Storage `attachments`) | Live deployment with authorized project. Shows `LiveConfigPage` (`src/features/liveconfig/LiveConfigPage.tsx`) when vars missing/invalid and **never falls back to demo data** (`src/app/AppProvider.tsx:42`, `src/app/routes.tsx:41-44`). |

### Honest mode table

Every external capability reports a `CapabilityState` (`src/domain/types.ts:373-380`) via `integrationStatuses()` (`src/data/local/LocalRepository.ts:840-847`, `src/data/supabase/SupabaseRepository.ts:68-75`) and is rendered on `/integrations` (`src/features/integrations/IntegrationsPage.tsx:6-33`).

| Capability | `local` (default) | `supabase` missing vars | `supabase` stub configured | Future `connected` |
|---|---|---|---|---|
| **Supabase** | `demo_simulation` — local IndexedDB | `not_configured` — config screen | `not_configured` — stub (no network yet) | `connected` after `ready()` + RLS OK |
| **Microsoft 365** | `not_configured` — manual paste | `not_configured` | `not_configured` | `consent_required` → `connected` (Entra) |
| **AI provider** | `not_configured` — helper only | `not_configured` | `not_configured` | `connected` (server Edge Function) |
| **Mail capture** | `not_configured` — paste only | `not_configured` | `not_configured` | `connected` (mailbox rule/Graph) |

Rules:

- Missing live config **never** silently falls back to demo — `SupabaseRepository.ready()` returns `{ ok:false, error:{code:"not_configured"} }` (`src/data/supabase/SupabaseRepository.ts:11-18`).
- Persona switcher is simulation, not auth — labelled `persona_note` (`src/locales/strings.ts:409`, `src/app/store.ts:67`).
- Deterministic transcript helper is **not AI** — `extractionMethod: deterministic_helper` (`src/domain/types.ts:198`, `src/domain/transcript.ts:86-134`, `src/locales/strings.ts:153-154`).
- Unknowns from the original brief are preserved as unknowns — see `docs/REQUIREMENTS.md` (Unknowns table): hospital name generic, surnames not fabricated, meeting date not established, `16:00/14:00` not an SLA, `48/64` unverified, budget/opening date omitted.

---

## Setup

### Zero-config local (default) — 2 commands

No `.env` needed. Demo is fully functional offline.

```bash
npm install
npm run dev
# open http://localhost:5173
```

The app seeds IndexedDB on first run (`src/data/local/seed.ts`), requests persistent storage (`src/app/AppProvider.tsx:48-56`), and shows 32 tasks / 6 workstreams / 6 labels / 6 events / 2 inbox items / 3 decisions / 2 reports / 6 training modules / 3 support tickets.

Reset demo data at any time: `/settings` → Reset, or `LocalRepository.resetDemoData()` (`src/data/local/LocalRepository.ts:810-838`).

### Live (Supabase) — authorized project

1. **Apply SQL** — one-shot, rerun-safe installer:

   ```bash
   psql "$SUPABASE_URL" -f supabase/setup.sql
   # or via Supabase SQL Editor: paste supabase/setup.sql and run
   ```

   `supabase/setup.sql:6` `BEGIN;` … `supabase/setup.sql:691` `COMMIT;` with catalog guards (`supabase/setup.sql:48-71`). Canonical source is `supabase/migrations/0001_init.sql`; verify sync with:

   ```bash
   npm run sql:verify-setup
   ```

2. **Environment** — copy `.env.example` → `.env` (never commit `.env`):

   ```dotenv
   VITE_DATA_MODE=supabase
   VITE_SUPABASE_URL=https://your-authorized-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
   # Optional (frontend-public, SPA PKCE):
   # VITE_MS_CLIENT_ID=00000000-0000-0000-0000-000000000000
   # VITE_MS_TENANT_ID=common
   # VITE_MS_REDIRECT_PATH=/integrations
   ```

   Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, Graph/AI/mail keys) belong in the deployment environment of server functions, **never** in `VITE_*` (`.env.example:39-42`, `docs/INTEGRATIONS.md`).

3. **Bootstrap** — `npm run dev` (or `npm run build && npm run preview`). If vars are missing/invalid, the app shows `/liveconfig` with remediation steps and does not render demo data. See `docs/INTEGRATIONS.md` for Entra, Graph, and AI Edge Function setup paths and `docs/PERMISSIONS.md` for RLS.

---

## Limitations

Per original prompt **Section 26 — What is verified vs awaits credentials vs unavailable** (source: `docs/REQUIREMENTS.md:21-27`, `docs/INTEGRATIONS.md:209-216`).

### Verified (local — works now, no credentials)

All M01–M12 slices in `local` mode, verified by `npm run build` / `npm run typecheck` and manual UI verification on 2026-09-08:

- M01 learning (6 modules, checklist, progress), M02 tasks (lifecycle + quick capture + templates + comments), M03 workstreams/labels + `projectCompletionRatio` (task ratio, **not** hospital completion), M04 checklist/comments/activity append-only, M05 calendar (agenda/week/month) + focus blocks (no due-date mutation) + ICS export, M06 meetings + TXT/SRT/VTT import + deterministic `extractActionCandidates` + approve-once guarantee, M07 decisions + supersession, M08 inbox paste + fingerprint dedupe + private drafts, M09 deterministic reports + frozen snapshot + Markdown/CSV/print + schedule (no background delivery in demo), M10 onboarding overview, M11 support 5-state lifecycle + requester/coordinator queue + private notes, M12 documents (local sample, no broken links) + permission-aware search + settings (locale/timezone/theme, backup export, reset) + offline badge + SQL one-shot installer.

### Awaits credentials (code path exists, honest `not_configured` screen, no live execution without project)

- Real Supabase network wiring + Supabase Auth — stub `src/data/supabase/SupabaseRepository.ts:8-76` returns `not_configured`; UI shows `LiveConfigPage` (`src/features/liveconfig/LiveConfigPage.tsx`). RLS policies + storage bucket `attachments` already in `supabase/setup.sql:477-573` but unexercised live.
- Microsoft Graph / Planner / Outlook / SharePoint sync — schema ready (`external_links` + `integration_jobs` `supabase/setup.sql:399-448`), status `not_configured` (`src/data/local/LocalRepository.ts:843`). Planner premium plans explicitly **unsupported** (`src/locales/strings.ts:371`).
- Mail ingestion via live capture address — paste only in demo; live requires approved mailbox / Graph subscription (`docs/INTEGRATIONS.md:195-205`).
- AI provider — deterministic helper only (`src/domain/transcript.ts:86-134`). Provider requires server Edge Function (`supabase/functions/ai-assist/`, not present) holding the secret; no AI calls leave the browser in this checkout.

### Unavailable / Not implemented (intentionally not built; simulation or omitted)

- Real Planner task creation/`GET /planner/plans`, Outlook bidirectional calendar delta sync, SharePoint drive provisioning, server-side scheduled report email delivery, attachment binaries (names only; future in `storage.buckets: attachments`), production auth (demo persona switcher is simulation — `src/app/store.ts:67`, `src/domain/permissions.ts:2`).
- Live data smoke tests (`supabase/tests/`) require an authorized project and are not runnable here.

---

## SPA Routing Fallback

This is a single-page app with client-side routing (`src/app/routes.tsx:55-81`, `react-router-dom` `createBrowserRouter`). Direct navigation or refresh on deep links (e.g. `/tasks/:taskId`, `/meetings/:meetingId`, `/calendar`, `/reports/:reportId`) must serve `index.html` with a 200 fallback, otherwise the server will return 404. Configure your host to rewrite all non-file routes to `index.html`:

- **Vite preview / dev** — handled automatically by Vite.
- **Static hosts** — enable SPA fallback (e.g. Netlify `_redirects`: `/* /index.html 200`; Vercel `rewrites: [{ "source": "/(.*)", "destination": "/index.html" }]`; nginx `try_files $uri $uri/ /index.html;`; Apache `.htaccess` `FallbackResource /index.html`).
- **Sub-path deployment** — if hosting under `/linetapp/` (see PWA `start_url`), set `base: "/linetapp/"` in `vite.config.ts:7` and ensure the fallback rewrite targets `/linetapp/index.html`.

---

## PWA

- Manifest: `public/manifest.webmanifest` — `name: LINET Workspace`, `short_name: LINET`, `start_url: /linetapp/`, `display: standalone`, `theme_color: #4263eb`, `background_color: #f5f7fb`, icons `icons/icon-192.png` + `icons/icon-512.png` (`any maskable`), `lang: cs`, `description` — linked from `index.html:10`.
- Service worker: `public/sw.js` — versioned cache `linet-ws-v1`, precaches shell (`/`, `/index.html`, `/manifest.webmanifest`), `network-first` for `/api/`, `cache-first` for assets, skips cross-origin, returns cached shell for navigation when offline, `skipWaiting()` + `clients.claim()`. Persistent storage is requested separately via `navigator.storage.persist()` (`src/app/AppProvider.tsx:48-56`); offline is best-effort, not guaranteed. Registration (if any) should be done in app bootstrap; update the cache name on shell changes.
- Icons: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/favicon.svg` (32×32, `#4263eb` background, white "L").
- Theme color meta: `index.html:6` `content="#4263eb"`.

---

## License

Proprietary — LINET internal pilot for the Papua New Guinea hospital project. No public license granted. Do not redistribute, publish, or use outside the authorized LINET workspace without written approval from the project owner. Demo data uses `example.invalid` addresses and sanitized fictional transcript samples (`src/data/local/seed.ts:72`, `src/domain/transcript.ts:136-155`) and must not be treated as real hospital, patient, or personnel information.

