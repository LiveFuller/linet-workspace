# DEMO WALKTHROUGH — 5-Minute Stakeholder Script (Real Working Flows Only)

> Generated: 2026-09-08 · App: LINET Workspace · Mode: local demo (no credentials, no network required) · Start: `npm run dev` → http://localhost:5173 or `npm run preview` → 4173 · Language: Czech default. All steps below were verified on this checkout.

## Before You Start

- Browser: Chrome/Edge, narrow viewport (≈ Pixel 7) to show bottom nav `src/app/Shell.tsx:130` — desktop sidebar `src/app/Shell.tsx:165` appears on wide viewport.
- Persona: start as **Oliver** (`it_coordinator`, `src/data/local/seed.ts:61`), switch via header persona control (`src/app/store.ts:67` persisting `linet-workspace-persona`).
- Reset opportunity: `/settings` → Reset demo data — restores `SEED_VERSION 3` `src/data/local/seed.ts:16`. Keep a backup if you plan to mutate heavily: `/settings` → Export zálohy `src/data/local/LocalRepository.ts:810`.

---

## Script — 10 Steps, ~5 minutes

### 1 — Open Today as Oliver (30s)

**Do:** Open `/` (`src/features/today/TodayPage.tsx:15`, route `src/app/routes.tsx:56`).

**Expect:**
- Greeting `Dobrý den, Oliver` `src/locales/strings.ts:29` + subtitle "Papua-Nová Guinea — projekt nemocnice · dnes" `src/features/today/TodayPage.tsx:63-65`.
- Button `Přidat úkol` `src/locales/strings.ts:37` (visible).
- Section `Můj fokus` `src/features/today/TodayPage.tsx:112` shows 5 tasks (`TaskRow` `src/components/TaskRow.tsx`), two tiles `Termín dnes` / `Zpožděné` `src/features/today/TodayPage.tsx:131-148`.
- Coordinator queue visible: Oliver is `it_coordinator` → `myCoordQueue` `src/features/today/TodayPage.tsx:40-42` shows e.g. "Copilot licence pro projektový tým — U LINET IT".
- Bottom nav: `Dnes · Úkoly · + · Schůzky · Více` `src/app/Shell.tsx:135-159`.

**Say:** "Toto je domovská obrazovka koordinátora. Lokální demo, offline badge `offline_badge` `src/locales/strings.ts:416` by se objevil, když by byl offline `src/app/Shell.tsx:110`."

### 2 — Capture a Task in ~10 Seconds (30s)

**Do:** Tap `+` → `Úkol` or `Přidat úkol` `src/app/Shell.tsx:62-83` → `src/features/tasks/TaskForm.tsx`. Title: **"Ověřit varianty přepravy — letecká vs námořní (dotaz logistiky)"**. Leave owner empty or pick yourself. Due: pick tomorrow (date picker). Save.

**Expect:**
- If title empty → banner `Název úkolu je povinný.` `src/locales/strings.ts:453`.
- On save → toast `Úkol vytvořen` `src/locales/strings.ts:91` (`src/features/tasks/TaskForm.tsx`), task appears in `/tasks?view=my` or `/tasks?view=all` depending on ownership (`filterTasks` `src/domain/selectors.ts:61`). Count increases by 1 (derived, not hardcoded).

**Say:** "Zápis za 10 sekund — detaily doplní logistika později. Termín je `YYYY-MM-DD`, ne timestamp (`dueDate` `src/domain/types.ts:103`)."

### 3 — Complete + Undo (30s)

**Do:** On Today or `/tasks`, tap the circle on the task you just created → toast `Úkol dokončen` + `Zpět` (Undo) `src/features/today/TodayPage.tsx:50-55` / `src/features/tasks/TasksPage.tsx:72-80`. Tap `Zpět`.

**Expect:**
- Task animates to done (`completedAt` set `src/data/local/LocalRepository.ts:277`), then restored with `reopenTask` `src/data/local/LocalRepository.ts:293`. View `/tasks?view=completed` would show done items `src/domain/selectors.ts:87-88`; restored task returns to `my`.

**Say:** "Jedno klepnutí → dokončeno, akce lze vrátit. Completed tasks are never overdue (`isOverdue` `src/domain/selectors.ts:37-42`)."

### 4 — Weekly Review Over the Real List (30s)

**Do:** Open `/tasks` → switch views: `Moje → Vše → Zpožděné → Čeká/blok.` `src/features/tasks/TasksPage.tsx:92-103`. Toggle `Hledat…` with "copilot", sort `Podle termínu / Podle aktualizace` `src/features/tasks/TasksPage.tsx:118-124`. Open the lead attention chips on `/` when switched to Vedoucí projektu.

**Expect:**
- Seed shows: overdue `src/data/local/seed.ts` (tasks with `at(-4)` etc.), `waiting/blocked` with `statusNote`, `unassigned` `src/features/today/TodayPage.tsx:30-31`. Lead persona (`Vedoucí projektu`) sees `Vyžaduje pozornost` chips `src/features/today/TodayPage.tsx:75-90` — overdue All, blocked All, unassigned. Workload sheet on assignment screen `src/features/tasks/TasksPage.tsx:200-226`.

**Tip:** Switch persona to **Vedoucí projektu** (project_lead `src/data/local/seed.ts:62`) to show that the lead view surfaces delivery risks without fabricated data.

### 5 — Import a Transcript (Paste or File) (30s)

**Do:** Go `/meetings` `src/features/meetings/MeetingsPage.tsx` → open **"Pracovní porada — digitální základy"** (the `in_review` one, `src/data/local/seed.ts:227`). In the transcript section, tap `Importovat přepis` `src/features/meetings/MeetingDetailPage.tsx:167` → either Upload `sample.srt` (`SAMPLE_SRT` `src/domain/transcript.ts:137`) or paste into textarea and submit `src/features/meetings/MeetingDetailPage.tsx:278-308`.

**Expect:**
- If transcript already seeded (8 segments `src/data/local/seed.ts:215-224`) — imports are additive (`hasTranscript:true` `src/data/local/LocalRepository.ts:474`). New segments get positions `existing.length + i` `src/data/local/LocalRepository.ts:466`.
- List shows speaker labels and timestamps: `Vedoucí [0:00]`, `Oliver [0:14]` `src/features/meetings/MeetingDetailPage.tsx:179-192`. Banner `Originální přepis (neměnný)` `src/locales/strings.ts:156` visible. Empty import → validation `error_generic`.

**Say:** "TXT/SRT/VTT — tolerant parser `parseTxt/parseSrt/parseVtt` `src/domain/transcript.ts:12-77`. Missing speakers stay `null` — never fabricated."

### 6 — Run the Deterministic Helper and Approve an Action (60s)

**Do:** With transcript visible, tap `Navrhnout akce (deterministický helper)` `src/features/meetings/MeetingDetailPage.tsx:196-198` (`meeting_extract_helper` `src/locales/strings.ts:153`). Hint beneath: "Helper hledá akční řádky … Není to AI" `src/locales/strings.ts:154`.

**Expect:**
- Toast `Nalezeno N kandidátů akcí` `src/locales/strings.ts:155` (`meeting_extract_generated`). Cards appear under `Návrhy akcí` with `proposedTitle`, `evidenceText` (quoted `„…"` `src/features/meetings/MeetingDetailPage.tsx:226-228`), method pill `deterministický helper` `src/locales/strings.ts:157`. One card may show `Relativní termín … vyžaduje potvrzení` `src/locales/strings.ts:161` when evidence contains "pěti dnů" `src/features/meetings/MeetingDetailPage.tsx:231-233` — **due date stays empty** until human fills it.
- Tap `Schválit → úkol` `src/features/meetings/MeetingDetailPage.tsx:238-239` → dialog `src/features/meetings/MeetingDetailPage.tsx:323-365` (title/owner/due). Approve → toast `Schváleno` `src/locales/strings.ts:146` (`meeting_proposal_accepted`), card now shows `→ Úkoly: <id>…` `src/features/meetings/MeetingDetailPage.tsx:234`. Second approval on same proposal → `Úkol už existuje (ochrana proti duplicitě)` `src/locales/strings.ts:152` via `createdTaskId` guard `src/data/local/LocalRepository.ts:521-525` + unique `(meeting_id, sourceActionKey)` `supabase/setup.sql:258`. Approve-once guarantee honored.

**Say:** "Deterministic, Czech+English hints `ACTION_HINTS_CS/EN` `src/domain/transcript.ts:92-102`. Owner guess suppressed (`proposedOwnerId:null` `src/features/meetings/MeetingDetailPage.tsx:62`) — human decides. Relative dates require confirmation."

### 7 — Generate a Report Snapshot (30s)

**Do:** Go `/reports` `src/features/reports/ReportsPage.tsx:15`. Pick `Týdenní` (or `Denní`), keep default period (`weekBounds` `src/lib/dates.ts`), tap `Náhled ze skutečných záznamů` `src/locales/strings.ts:242` (`report_preview` `src/features/reports/ReportsPage.tsx:156`). Review the preview groups `Dokončená práce / Nadcházející … / Blokace / Rozhodnutí` `src/locales/strings.ts:234-237` (`ReportItems` `src/features/reports/ReportsPage.tsx:212-237`). Add a one-line commentary. Tap `Uložit koncept` then open the saved report from the list below `src/features/reports/ReportsPage.tsx:192-205`.

**Expect:**
- Preview banner `Aktuální náhled … uložení vytvoří neměnný snímek.` `src/locales/strings.ts:245`; after save → `Report uložen` `src/locales/strings.ts:251` + navigation to `/reports/:id` `src/features/reports/ReportDetailPage.tsx` with `Uložený snímek — pozdější úpravy úkolů jej nemění.` `src/locales/strings.ts:244`. Actions: `Kopírovat text`, `Export Markdown`, `Tisk / uložit PDF` `src/features/reports/ReportsPage.tsx:175-180`.

**Say:** "Reports are deterministic templates over live records `src/features/reports/ReportsPage.tsx:31-72` — `ReportSchedule` (cadence/time/channel) `src/features/reports/ReportsPage.tsx:241-315` in demo shows `Demo režim: nic se neodesílá` `src/locales/strings.ts:258`."

### 8 — Training Baseline + Follow-Through (30s)

**Do:** `Přepnout na Petra` (member `src/data/local/seed.ts:63`) → `/learning` `src/features/learning/LearningPage.tsx:6` → open **"Spolupráce v Teams"** `src/features/learning/LearningModulePage.tsx` (onboarding path badge `learning_onboarding_path` `src/locales/strings.ts:282`). Check one checklist item → `setTrainingProgress` `src/data/local/LocalRepository.ts:768` (per-user key `(moduleId, personId)` `src/data/local/db.ts`). Switch back to Oliver / Vedoucí → overview table `src/features/learning/LearningPage.tsx:65-95` shows Petra's ✓.

**Expect:**
- `~N min (odhad)` `src/locales/strings.ts:270` always labelled estimate. Content shows `Správce obsahu: Oliver` `src/locales/strings.ts:271`, `Stav revize: v revizi` `src/locales/strings.ts:286-287` `src/data/local/seed.ts:331` — never claimed "approved" until reviewed.

**Say:** "Six-module baseline path `src/data/local/seed.ts:311-439` — teams-collab, copilot-basics, file-sharing, task-workflow, weekly-review, it-help."

### 9 — IT Support Follow-Through (30s)

**Do:** As Petra, open `/support` `src/features/support/SupportPage.tsx:8` → `Nový požadavek` `src/features/support/SupportForm.tsx` → category `VPN`, description "Potřebuji VPN na vzdálenou práci". Save → `Požadavek zaevidován` `src/locales/strings.ts:312`. Petra sees `Moje požadavky` only; `Koordinační fronta` disabled with `Soukromé: vidí žadatel, koordinátoři … Vedoucí projektu je automaticky nevidí.` `src/locales/strings.ts:310` `src/features/support/SupportPage.tsx:55`. Switch to **Oliver** → queue enabled → open the new ticket → tap `Přiřadit mně (koordinátor)` `src/features/support/SupportDetailPage.tsx` → add update, toggle `Viditelné pro žadatele` `src/domain/types.ts:340`. Switch to **Vedoucí projektu** → ticket hidden (privacy boundary `canViewSupportTicket` `src/domain/permissions.ts:95-105`).

**Say:** "Five-state lifecycle `captured → awaiting_official_ticket → with_linet_it → waiting_user → resolved` `src/domain/types.ts:311-317`. App ≠ official ticket — `Oficiální ticket (reference)` `src/locales/strings.ts:298` is manually recorded, never fabricated."

### 10 — Honest Microsoft Integration Status (15s)

**Do:** Open `/integrations` `src/features/integrations/IntegrationsPage.tsx:21`.

**Expect:**
- Four cards `DEMO_FALLBACK` `src/features/integrations/IntegrationsPage.tsx:6-11` / `LocalRepository.integrationStatuses()` `src/data/local/LocalRepository.ts:840-847`: `supabase demo_simulation`, `microsoft not_configured`, `ai not_configured (deterministický helper)`, `mail not_configured`. Two banners: `Microsoft Graph Planner API podporuje základní plány… Prémiové plány podporované nejsou` `src/locales/strings.ts:371` + `„Databáze připojena“ neznamená „Planner synchronizován“.` `src/locales/strings.ts:372` `src/features/integrations/IntegrationsPage.tsx:43-48`. `Zdroj pravdy projektu` `src/locales/strings.ts:375` shows `standalone` `src/data/local/seed.ts:78`.

**Say (honest):** "No Graph token in this demo — all mail/meeting ingestion is manual paste. Entra registration `VITE_MS_CLIENT_ID/TENANT_ID` (`docs/INTEGRATIONS.md` §2) + server-only Graph secret remain awaits-credentials. Live Supabase shows config screen (`LiveConfigPage` `src/features/liveconfig/LiveConfigPage.tsx`) and never falls back to demo."

---

## What Data Is on Screen During This Walk

- If reset: 32 tasks (22 active mix, 2 done, 1 archived `src/data/local/seed.ts:117-158`), 6 workstreams `src/data/local/seed.ts:84-91`, 6 labels, 3 meetings (1 `in_review` with transcript, 1 `notes_published`, 1 `planned` `src/data/local/seed.ts:226-230`), 8 transcript segments, 4 proposals (3 needs_review + 1 accepted `src/data/local/seed.ts:232-272`), 3 decisions, 2 reports (1 weekly published, 1 daily draft `src/data/local/seed.ts:280-305`), 6 calendar events `src/data/local/seed.ts:185-192`, 2 inbox items, 3 support tickets (`with_linet_it`, `awaiting_official_ticket`, `captured` `src/data/local/seed.ts:448-467`), 4 documents (local samples), 6 learning modules.

## Timing Summary

| Step | Time |
|---|---|
| 1 Today | 0:30 |
| 2 Capture | 0:30 |
| 3 Undo | 0:30 |
| 4 Weekly review | 0:30 |
| 5 Import | 0:30 |
| 6 Helper + approve | 1:00 |
| 7 Report snapshot | 0:30 |
| 8 Training | 0:30 |
| 9 Support | 0:30 |
| 10 Integrations status | 0:15 |
| **Total** | **~5:15** |

No invented data is shown; every screen identifies whether it is demo simulation or connected state.
