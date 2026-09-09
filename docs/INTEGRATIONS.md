# INTEGRATIONS — Real Capabilities, Permissions, Setup, and Status

> Generated: 2026-09-08 · Frontend bundle is public; secrets never ship to it. See `.env.example:1-43` and `src/data/supabase/SupabaseRepository.ts`.

## Status Enum — `CapabilityState` (`src/domain/types.ts:373-380`)

Single source of truth for every capability. Values:

| State | Meaning |
|---|---|
| `configured` | Credentials present, not yet consented/verified. |
| `consent_required` | App registered (e.g. Entra) but admin/user consent or redirect URI missing. |
| `connected` | Live call succeeded; normal operation. |
| `degraded` | Intermittent failure / provider throttling; local workflow remains. |
| `error` | Hard failure; user-visible message. |
| `demo_simulation` | Local demo — IndexedDB, deterministic helpers. Fully functional without cloud. |
| `not_configured` | No credentials / not set up — fallback to local/manual path. |

Rendered on `/integrations` `src/features/integrations/IntegrationsPage.tsx:13-18` with pills: `connected/demo_simulation→done`, `error/degraded→blocked`, `consent_required→waiting`, `not_configured→todo`.

Shape: `IntegrationStatus` `src/domain/types.ts:382-388` `{ id, state, operations[], lastCheck, message }`.

---

## 1. Supabase (Data & Auth)

### What Exists

| Aspect | Detail |
|---|---|
| **Live stub** | `src/data/supabase/SupabaseRepository.ts:8-76` implements full `WorkspaceRepository` contract `src/data/contracts/repository.ts`. When `VITE_DATA_MODE=supabase` with missing/invalid `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, returns `{ ok:false, error:{code:"not_configured", capability:"supabase"} }` for `ready()` and every operation. UI shows `LiveConfigPage` `src/features/liveconfig/LiveConfigPage.tsx` and **never falls back to demo data** (`src/app/AppProvider.tsx:42`). |
| **One-shot installer** | `supabase/setup.sql` (`BEGIN;…COMMIT;` `supabase/setup.sql:6,691`) generated from `supabase/migrations/0001_init.sql`. `supabase/migrations/` is canonical. Includes schema, triggers, indexes, RLS, storage policies. |
| **RLS** | Enabled on all tables `supabase/setup.sql:477-508`, membership helpers `is_workspace_member/workspace_role/is_workspace_admin` `supabase/setup.sql:551-556`, grants only to `authenticated` `supabase/setup.sql:513-547`. See `PERMISSIONS.md`. |
| **Storage** | Private bucket `attachments` `supabase/setup.sql:569`, four policies `attachments_*_member` `supabase/setup.sql:570-573`. Helper `can_access_storage_path()` `supabase/setup.sql:561`. |
| **Schema notes** | `tasks.due_date` is `date` (not `timestamptz`) `supabase/setup.sql:61-64`; `activity_events` append-only trigger `supabase/setup.sql:473`; `inbox_items` fingerprint unique `(project_id, fingerprint)` `supabase/setup.sql:220`; `meeting_action_proposals` unique `(meeting_id, source_action_key)` `supabase/setup.sql:258`. |

### Status Values

| Mode | Reported `IntegrationStatus` |
|---|---|
| `local` (default, no env vars) | `supabase: demo_simulation` — "Databáze: lokální demo (IndexedDB na tomto zařízení)." `src/data/local/LocalRepository.ts:842` |
| `supabase` missing vars | `supabase: not_configured` — "Live režim vyžaduje VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY" `src/data/supabase/SupabaseRepository.ts:13` |
| `supabase` configured (stub) | `supabase: not_configured` — stub message about awaiting deployment `src/data/supabase/SupabaseRepository.ts:15` |

Future live mode will report `configured → connected` after `ready()` succeeds; not implemented in this checkout.

### Supported Operations (Live — Future)

When `connected`: all `WorkspaceRepository` operations (`loadSnapshot`, task/meeting/inbox/support/document/report/learning ops, `subscribe`, `integrationStatuses`). In this checkout: **none succeed** — every call returns `not_configured` `src/data/supabase/SupabaseRepository.ts:31-67` (honest stub).

### Setup Path

```dotenv
# .env (never commit) — copy from .env.example
VITE_DATA_MODE=supabase
VITE_SUPABASE_URL=https://your-authorized-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
# Service role key is SERVER-ONLY — belongs in Supabase Edge Functions env, never in VITE_*
```

Install SQL: `psql "$SUPABASE_URL" -f supabase/setup.sql` (one-shot, rerun-safe — guards via catalog checks `supabase/setup.sql:48-71`). Verify: `npm run sql:verify-setup` (`scripts/verify-sql-sync.mjs`, defined in `package.json:17`). `supabase/setup.sql:691` `COMMIT`.

### Honest Statement — Not Implemented Yet

- Real Supabase network client wiring. The stub intentionally prevents silent demo fallback; wiring requires authorized project + auth session + RLS smoke tests per `supabase/tests/`.
- Live auth (Supabase Auth) — demo uses `localStorage` persona simulation `src/app/store.ts:67`.

---

## 2. Microsoft 365 — Planner, Graph, Outlook, SharePoint

### What Exists

| Aspect | Detail |
|---|---|
| **Status indicator** | `/integrations` card + top banner `integrations_ms_note` `src/locales/strings.ts:368-372` / `src/features/integrations/IntegrationsPage.tsx:43-48`. |
| **Source-of-truth flag** | `Project.sourceOfTruth: "standalone" | "microsoft_backed"` `src/domain/types.ts:20-21` and `projects.source_of_truth` `supabase/setup.sql:111`. Seed default `standalone` `src/data/local/seed.ts:78`. Shown on `/integrations` `src/features/integrations/IntegrationsPage.tsx:53`. |
| **Planner constraints documented** | `integrations_ms_note` warns: "Microsoft Graph Planner API podporuje základní plány (basic plans). Prémiové plány podporované nejsou" `src/locales/strings.ts:371` / `supabase/setup.sql` no Planner sync claims. |
| **External linking model** | `ExternalLink` `src/domain/types.ts:390-400` + table `external_links` `supabase/setup.sql:399-409` with `provider: planner|outlook`, `resourceId` (never title-based dedupe), `etag`, `syncState: pending|synced|conflict|error|source_unavailable`, unique `(provider, container_id, resource_id)` `supabase/setup.sql:448`. Integration job queue `integration_jobs` `supabase/setup.sql:411-422`. |
| **Setup vars** | `.env.example:27-29` commented `VITE_MS_CLIENT_ID`, `VITE_MS_TENANT_ID`, `VITE_MS_REDIRECT_PATH`. |

### Status Values

| Situation | State | Message |
|---|---|---|
| No env vars (current checkout) | `not_configured` | "Microsoft 365: nenakonfigurováno. Ruční import přepisů a e-mailů zůstává plně funkční." `src/data/local/LocalRepository.ts:843` |
| Entra app registered, no consent | `consent_required` | Expected (not reachable in this checkout; future live mode). |
| Token valid, Graph OK | `connected` | Future — explains `operations` |
| Graph error / premium-plan unsupported | `degraded` / `error` | Message explains premium-plan limitation per `integrations_ms_note` |

### Supported Operations — Honest Inventory

**Supported (fully working locally — no Graph needed):**

- Inventory of existing Planner plans (manual task `src/data/local/seed.ts:121-122` — "Inventory existujících Planner plánů" as human process).
- Transcript import via file/paste (TXT/SRT/VTT) `src/domain/transcript.ts:12-84` (independent of Graph).
- Email capture via paste (Inbox) `src/features/inbox/InboxNewPage.tsx`.
- Task/calendar creation, preview, and snapshot (no sync).

**Not Implemented / Demo Simulation:**

- `Planner`: `GET /planner/plans`, `GET /planner/buckets`, `POST /planner/tasks` via `ExternalLink` + `integration_jobs` sync — **not wired** to Graph in this checkout. Schema ready (`external_links`, `integration_jobs`), wiring awaits Entra credentials. The app explicitly states: "„Databáze připojena“ neznamená „Planner synchronizován“." `src/locales/strings.ts:372`.
- `Outlook`: calendar bidirectional sync, delta queries — **not implemented**; local `CalendarEvent` + `.ics` export only `src/features/calendar/CalendarPage.tsx:40-58`.
- `SharePoint`: file linking is validated URL storage only `src/domain/validation.ts:144-152`, no drive provisioning.
- All secret storage: Graph client secret is **SERVER-ONLY**, never in `VITE_*` `src/data/supabase/SupabaseRepository.ts` / `.env.example:39-42`.

### Setup Path (When Ready)

1. **Entra app registration** (admin):
   - App type: Single-page app (SPA) for frontend PKCE (`VITE_MS_CLIENT_ID`).
   - API permissions: `Tasks.ReadWrite` or `Group.ReadWrite.All` (Planner basic plans), `Calendars.ReadWrite`, `Mail.Read`, `Files.ReadWrite.All` (least-privilege pending tenant review). Requires admin consent in tenant.
   - Redirect URI: `https://<app-host>/integrations` matching `VITE_MS_REDIRECT_PATH`.
2. **Frontend env** (`.env`):
   ```dotenv
   VITE_MS_CLIENT_ID=00000000-0000-0000-0000-000000000000
   VITE_MS_TENANT_ID=common   # or tenant GUID
   VITE_MS_REDIRECT_PATH=/integrations
   ```
3. **Server env** (Supabase Edge Function / host env, never bundle):
   ```
   GRAPH_CLIENT_SECRET=…        # confidential
   SUPABASE_SERVICE_ROLE_KEY=…  # server only
   ```
4. **Toggle**: set `projects.source_of_truth = 'microsoft_backed'` once Graph sync verified; otherwise keep `standalone`.

### What Is Explicitly NOT Claimed

- That "database connected" implies Planner synchronized — banner explicitly denies it (`src/features/integrations/IntegrationsPage.tsx:46-47`).
- That premium Planner plans are supported — `integrations_ms_note` says they are **not**.

---

## 3. AI — Deterministic Helper vs AI Provider

### What Exists

| Aspect | Detail |
|---|---|
| **Deterministic helper** | `src/domain/transcript.ts:86-134` `extractActionCandidates()` — Czech/English verb hints (`udelam/pripravim/schval…` + `i will/please/need to`), owner hints (`petru/oliver…`). Labelled `deterministic_helper` `src/domain/types.ts:198`, never "AI". UI label: `meeting_extract_helper` `src/locales/strings.ts:153` with hint "Helper hledá akční řádky… Není to AI" `src/locales/strings.ts:154`. |
| **Provider slot** | `src/domain/types.ts:198` `ExtractionMethod = "deterministic_helper" | "ai_provider" | "manual"` — provider-ready but not wired. |
| **Status card** | `/integrations` AI entry. In local mode: `not_configured — Deterministický helper s povinným ručním přehledem.` `src/data/local/LocalRepository.ts:844`. |

### Status Values

| Situation | State | Operations |
|---|---|---|
| Demo (current) | `not_configured` | `[]` — helper available, provider absent |
| Provider configured server-side, not consented | `consent_required` | (future) |
| Provider reachable | `connected` with `operations: ["summarize","suggest_actions"]` | (future) |
| Provider error / quota | `error` / `degraded` | msg surfaces; helper fallback always available |

### Supported Operations (Today)

- `suggest_actions` via `extractActionCandidates()` `src/domain/transcript.ts:112` — returns `ActionCandidate[]` with `evidenceText` + `proposedTitle` + `proposedOwnerHint` (nullable). Conservative: ambiguous lines yield zero candidates; human must confirm.
- Relative dates are never auto-filled — `proposedDueDate: null` with confirmation prompt `meeting_relative_date_confirm` `src/locales/strings.ts:161` `src/features/meetings/MeetingDetailPage.tsx:230-232`.

### Setup Path (Future Provider)

- **No frontend key**. Provider key belongs in **Supabase Edge Function** env (server boundary) — `.env.example:34-35` documents this. Client calls `functions/invoke('ai-assist')`.
- Edge Function: `supabase/functions/ai-assist/` (not yet present in this checkout). Must enforce: facts unchanged, evidence preserved, human review required, rate-limited, sanitized logging.
- Approval required before wiring to prevent sensitive-data leakage (see `PERMISSIONS.md` — no patient/access data in prompts).

### Honest Statement

- **No AI calls leave the browser in this checkout.** AI provider is **not configured** (`not_configured`). The helper is not AI and is labelled as such everywhere (`src/locales/strings.ts:154`, `src/features/meetings/MeetingDetailPage.tsx:53`). When a provider is added, it will be server-mediated and explicitly marked `ai_provider` in proposals.

---

## 4. Mail / Inbox Capture

### What Exists

| Aspect | Detail |
|---|---|
| **Inbox** | `/inbox` triage `src/features/inbox/InboxPage.tsx`, `/inbox/new` `src/features/inbox/InboxNewPage.tsx` with `InboxKind: note|email|transcript|link|file|voice` `src/domain/types.ts:148`. |
| **Paste intake** | Manual paste fully functional: title/body, `sourceMessageId` (Message-ID), `fingerprint` dedupe `src/data/local/LocalRepository.ts:577-581`. |
| **Parse hint** | `InboxNewPage` shows `inbox_email_parse_title/from/subject/attachments` hints; low-confidence note `inbox_parse_uncertain` `src/locales/strings.ts:218-219`. |
| **Validation / Dedupe** | `inboxItemSchema` `src/domain/validation.ts:81-87`, `sha256Hex(project|title|bodyNorm)` fingerprint + `UNIQUE (project_id, fingerprint)` `supabase/setup.sql:220` + local conflict check `src/data/local/LocalRepository.ts:579-582`. |
| **State machine** | `InboxState: unprocessed|in_review|processed|ignored` `src/domain/types.ts:149`. |
| **Privacy** | `note` → `isPrivateDraft` `src/data/local/LocalRepository.ts:584-585`, visibility gate `src/data/local/LocalRepository.ts:599-602`. |

### Status Values

| Mode | `mail` State | Message |
|---|---|---|
| Demo (current) | `not_configured` | "E-mailová sběrná adresa: nenakonfigurována. K dispozici ruční vložení e-mailu." `src/data/local/LocalRepository.ts:845` + banner `inbox_live_addr_note` `src/locales/strings.ts:217` `src/features/inbox/InboxPage.tsx:28` |
| Mailbox configured | `configured` → `connected` after inbox rule verified | (future) |
| Rule broken / auth expired | `degraded` / `error` | msg with remediation |

### Supported Operations (Today)

- `paste_email`, `create_task_from_inbox`, `ignore`, `dedupe`. Demo: `src/features/inbox/InboxPage.tsx` → create task → `inbox:processed` + `linkedTaskId`.
- Sample email helper `Fw: Žádost o nabídku` uses `sample-1@example.invalid` `src/data/local/seed.ts:199`.

### Setup Path (Future Live Mailbox)

- **Not a VITE var.** Mailbox ingestion belongs to a server function / Power Automate inbound rule. Required:
  1. Dedicated mailbox (e.g. `capture@<tenant>`), forwarding rule or Graph `subscriptions` on `message` resource.
  2. Server stores raw body as `InboxItem.body` (immutable) + `sourceMessageId`, `fingerprint`, `kind=email`.
  3. RLS: `inbox_items` insert gated to `is_workspace_member` `supabase/setup.sql:631`.
- Live path shows `inbox_live_addr_note` until verified: "Živá sběrná adresa vyžaduje schválenou konfiguraci schránky. Dokud není nastavena, používejte vložení e-mailu ručně." `src/locales/strings.ts:217`.

### Honest Statement

- **No mail is received automatically in this checkout.** E-mail ingestion is **simulated via paste**; live address requires approved mailbox configuration and is honestly reported as `not_configured`. No attachment binaries stored yet (names only in `attachmentNames`); future uses `storage.buckets: attachments` `supabase/setup.sql:569`.

---

## Summary Table — Capabilities vs Reality

| Capability | Enum States Used | Today | When `not_configured`, fallback | Misuse to avoid |
|---|---|---|---|---|
| **Supabase** | demo_simulation / not_configured | demo_simulation (IndexedDB) | Honest config screen (no fallback) | Treating demo data as production |
| **Microsoft 365** | not_configured / consent_required / connected / degraded / error | not_configured | Manual paste + human inventory | Claiming Planner synced when only DB connected |
| **AI** | not_configured / connected | not_configured (helper only) | Deterministic helper with human review | Calling helper "AI" — it is not |
| **Mail** | not_configured / connected | not_configured (paste only) | Paste `From/Subject/Body` | Assuming forwarded mail auto-arrives |

All four report via `integrationStatuses()` (`src/data/local/LocalRepository.ts:840-847`, `src/data/supabase/SupabaseRepository.ts:68-75`), consumed on `/integrations` `src/features/integrations/IntegrationsPage.tsx:25-33` with fallback `DEMO_FALLBACK` `src/features/integrations/IntegrationsPage.tsx:6-11`.
