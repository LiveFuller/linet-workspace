-- LINET Workspace — Canonical migration 0001_init.sql
-- Canonical migration — do not edit independently; setup.sql is generated from this file.
-- Functional SQL below matches setup.sql exactly (byte-identical after this header).
-- Rerun-safe: guards via catalog checks / DO blocks; fails loudly on incompatible pre-existing schema.
-- Version: 1 — initial schema for LINET Workspace.
BEGIN;
-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger (hardened search_path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
-- Activity append-only guard
CREATE OR REPLACE FUNCTION public.prevent_activity_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'activity_events is append-only: % not allowed', TG_OP;
  RETURN NULL;
END;
$$;
-- ---------------------------------------------------------------------------
-- Schema version
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schema_version (
  version int PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL
);
-- ---------------------------------------------------------------------------
-- Incompatible schema guard
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='id') THEN
      RAISE EXCEPTION 'Incompatible schema: public.profiles missing id';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='email') THEN
      RAISE EXCEPTION 'Incompatible schema: public.profiles missing email';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tasks') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='due_date') THEN
      RAISE EXCEPTION 'Incompatible schema: public.tasks missing due_date';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='due_date' AND data_type <> 'date') THEN
      RAISE EXCEPTION 'tasks.due_date must be date not timestamptz';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='workspaces') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='workspaces' AND column_name='id') THEN
      RAISE EXCEPTION 'Incompatible schema: public.workspaces missing id';
    END IF;
  END IF;
END $$;
-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$'),
  display_name text NOT NULL DEFAULT '', avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  slug text UNIQUE, description text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.workspace_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('workspace_admin','project_lead','it_coordinator','member','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$'),
  role text NOT NULL CHECK (role IN ('workspace_admin','project_lead','it_coordinator','member','viewer')),
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  name_en text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '',
  source_of_truth text NOT NULL DEFAULT 'standalone' CHECK (source_of_truth IN ('standalone','microsoft_backed')),
  timezone text NOT NULL DEFAULT 'Pacific/Port_Moresby' CHECK (timezone ~ '/'),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, workspace_id)
);
CREATE TABLE IF NOT EXISTS public.project_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('workspace_admin','project_lead','it_coordinator','member','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.workstreams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  name_en text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE,
  UNIQUE (project_id, name)
);
CREATE TABLE IF NOT EXISTS public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  color text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE,
  UNIQUE (project_id, name)
);
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  workstream_id uuid REFERENCES public.workstreams(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','waiting','blocked','done')),
  status_note text, owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date date,
  lifecycle text NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active','archived')),
  completed_at timestamptz, completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','meeting_action','email_capture','inbox_triage','quick_capture','template','external_sync')),
  source_ref text, source_url text CHECK (source_url IS NULL OR source_url ~ '^https?://'),
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  position int NOT NULL CHECK (position >= 0), done boolean NOT NULL DEFAULT false,
  done_at timestamptz, done_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, position)
);
CREATE TABLE IF NOT EXISTS public.task_labels (
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, label_id)
);
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '', checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'meeting' CHECK (kind IN ('meeting','focus_block','deadline_marker')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  date_mode text NOT NULL DEFAULT 'timed' CHECK (date_mode IN ('date_only','timed')),
  start_at timestamptz, start_date date, end_at timestamptz,
  duration_min int CHECK (duration_min IS NULL OR duration_min > 0),
  all_day boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'Pacific/Port_Moresby' CHECK (timezone ~ '/'),
  linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  location text, meeting_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE,
  CHECK ((start_at IS NOT NULL) OR (start_date IS NOT NULL)),
  CHECK ((date_mode='timed' AND start_at IS NOT NULL) OR (date_mode='date_only' AND start_date IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS public.inbox_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('note','email','transcript','link','file','voice')),
  captured_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_private_draft boolean NOT NULL DEFAULT false,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  body text NOT NULL DEFAULT '', source_message_id text, fingerprint text NOT NULL,
  state text NOT NULL DEFAULT 'unprocessed' CHECK (state IN ('unprocessed','in_review','processed','ignored')),
  created_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE,
  UNIQUE (project_id, fingerprint)
);
CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  workstream_id uuid REFERENCES public.workstreams(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  starts_at timestamptz NOT NULL, duration_min int NOT NULL CHECK (duration_min>0 AND duration_min<=10080),
  participants uuid[] NOT NULL DEFAULT '{}', agenda text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_review','notes_published','archived')),
  notes_summary text NOT NULL DEFAULT '', published_notes text,
  has_transcript boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.transcript_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  position int NOT NULL CHECK (position>=0), speaker text,
  start_ms int CHECK (start_ms IS NULL OR start_ms>=0), end_ms int CHECK (end_ms IS NULL OR end_ms>=0),
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 20000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, position),
  CHECK (end_ms IS NULL OR start_ms IS NULL OR end_ms>=start_ms)
);
CREATE TABLE IF NOT EXISTS public.meeting_action_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  source_action_key text NOT NULL, evidence_text text NOT NULL,
  evidence_segment_id uuid REFERENCES public.transcript_segments(id) ON DELETE SET NULL,
  start_ms int CHECK (start_ms IS NULL OR start_ms>=0), end_ms int CHECK (end_ms IS NULL OR end_ms>=0),
  proposed_title text NOT NULL CHECK (char_length(proposed_title) BETWEEN 1 AND 300),
  proposed_owner uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  proposed_due_date date,
  extraction_method text NOT NULL CHECK (extraction_method IN ('deterministic_helper','ai_provider','manual')),
  state text NOT NULL DEFAULT 'needs_review' CHECK (state IN ('needs_review','accepted','edited','rejected','postponed')),
  created_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL, accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, source_action_key)
);
CREATE TABLE IF NOT EXISTS public.decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  text text NOT NULL DEFAULT '', decided_on date NOT NULL,
  decision_maker uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source_meeting uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  related_task_ids uuid[] NOT NULL DEFAULT '{}',
  superseded_by uuid REFERENCES public.decisions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('daily','weekly')),
  period_start date NOT NULL, period_end date NOT NULL CHECK (period_end>=period_start),
  timezone text NOT NULL DEFAULT 'Pacific/Port_Moresby' CHECK (timezone ~ '/'),
  generated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  filters_summary text NOT NULL DEFAULT '', commentary text NOT NULL DEFAULT '',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.report_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('daily','weekly')),
  cadence text NOT NULL CHECK (cadence IN ('daily','weekly')),
  timezone text NOT NULL DEFAULT 'Pacific/Port_Moresby' CHECK (timezone ~ '/'),
  send_at_local text NOT NULL CHECK (send_at_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  channel text NOT NULL CHECK (channel IN ('in_app','email')),
  recipients text[] NOT NULL DEFAULT '{}', enabled boolean NOT NULL DEFAULT true, last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE,
  UNIQUE (project_id, kind, timezone, send_at_local, channel)
);
CREATE TABLE IF NOT EXISTS public.training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  title text NOT NULL, title_en text NOT NULL,
  objective text NOT NULL, objective_en text NOT NULL,
  content jsonb NOT NULL DEFAULT '[]'::jsonb, content_en jsonb NOT NULL DEFAULT '[]'::jsonb,
  example text NOT NULL DEFAULT '', example_en text NOT NULL DEFAULT '',
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimated_minutes int NOT NULL CHECK (estimated_minutes>0 AND estimated_minutes<=600),
  content_owner text NOT NULL DEFAULT '', review_status text NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft','in_review','approved')),
  version int NOT NULL DEFAULT 1 CHECK (version>=1),
  is_onboarding_path boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.training_progress (
  person_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'not_started' CHECK (state IN ('not_started','in_progress','completed')),
  checklist_done text[] NOT NULL DEFAULT '{}', completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (person_id, module_id)
);
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  category text NOT NULL CHECK (category IN ('access','copilot','teams','vpn','hardware','training','other')),
  description text NOT NULL DEFAULT '', requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coordinator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'captured' CHECK (status IN ('captured','awaiting_official_ticket','with_linet_it','waiting_user','resolved')),
  impact text NOT NULL DEFAULT 'medium' CHECK (impact IN ('low','medium','high')),
  official_ticket_ref text, follow_up_date date, attachment_names text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.support_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  visible_to_requester boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  category text NOT NULL CHECK (category IN ('reference','procedure','training','meeting_notes','attachment','link')),
  description text NOT NULL DEFAULT '', owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workstream_id uuid REFERENCES public.workstreams(id) ON DELETE SET NULL,
  url text CHECK (url IS NULL OR url ~ '^https?://'), local_sample boolean NOT NULL DEFAULT false, content text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  file_size int NOT NULL CHECK (file_size>=0 AND file_size<=104857600),
  mime_type text NOT NULL CHECK (mime_type ~ '/'), storage_path text NOT NULL UNIQUE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
  support_ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE,
  CHECK (num_nonnulls(task_id,document_id,support_ticket_id,calendar_event_id,meeting_id)=1)
);
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('assigned','mention','deadline','action_approved','support','system')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  body text NOT NULL DEFAULT '', destination text NOT NULL, read_at timestamptz,
  dedupe_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, dedupe_key)
);
CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE CASCADE,
  support_ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  project_id uuid NOT NULL, workspace_id uuid NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 80),
  summary text NOT NULL CHECK (char_length(summary) BETWEEN 1 AND 500),
  detail text, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE,
  CHECK (num_nonnulls(task_id,meeting_id,support_ticket_id)<=1)
);
CREATE TABLE IF NOT EXISTS public.integrations (
  id text PRIMARY KEY CHECK (id IN ('microsoft','ai','mail','supabase')),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  state text NOT NULL CHECK (state IN ('configured','consent_required','connected','degraded','error','demo_simulation','not_configured')),
  operations text[] NOT NULL DEFAULT '{}', last_check timestamptz,
  message text NOT NULL DEFAULT '', config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);
CREATE TABLE IF NOT EXISTS public.external_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('planner','outlook')),
  container_id text, resource_id text NOT NULL, etag text,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  last_synced_at timestamptz,
  sync_state text NOT NULL DEFAULT 'pending' CHECK (sync_state IN ('pending','synced','conflict','error','source_unavailable')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(task_id,calendar_event_id)=1)
);
CREATE TABLE IF NOT EXISTS public.integration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_id text NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (char_length(job_type) BETWEEN 1 AND 80),
  execution_key text NOT NULL, payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','running','succeeded','failed')),
  attempts int NOT NULL DEFAULT 0 CHECK (attempts>=0),
  max_attempts int NOT NULL DEFAULT 5 CHECK (max_attempts>0 AND max_attempts<=10),
  scheduled_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, completed_at timestamptz,
  last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, execution_key)
);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='calendar_events_meeting_id_fkey' AND table_name='calendar_events') THEN ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL; END IF; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user ON public.workspace_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_memberships_workspace ON public.workspace_memberships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_project_memberships_user ON public.project_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON public.tasks(project_id,status);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON public.tasks(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_lifecycle ON public.tasks(lifecycle);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON public.task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_project ON public.calendar_events(project_id,start_at);
CREATE INDEX IF NOT EXISTS idx_inbox_items_project_state ON public.inbox_items(project_id,state);
CREATE INDEX IF NOT EXISTS idx_meetings_project_starts ON public.meetings(project_id,starts_at);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_meeting_pos ON public.transcript_segments(meeting_id,position);
CREATE INDEX IF NOT EXISTS idx_support_tickets_workspace_status ON public.support_tickets(workspace_id,status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_requester ON public.support_tickets(requester_id);
CREATE INDEX IF NOT EXISTS idx_notifications_person_read ON public.notifications(person_id,read_at);
CREATE INDEX IF NOT EXISTS idx_activity_events_project_created ON public.activity_events(project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_external_links_task ON public.external_links(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_integration_jobs_workspace_state ON public.integration_jobs(workspace_id,state);
CREATE UNIQUE INDEX IF NOT EXISTS uq_external_links_scoped ON public.external_links(provider,COALESCE(container_id,''),resource_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_schedule_period ON public.report_schedules(project_id,kind,timezone,send_at_local) WHERE enabled;
-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_profiles_updated_at') THEN CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at(); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_workspaces_updated_at') THEN CREATE TRIGGER trg_workspaces_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at(); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_tasks_updated_at') THEN CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at(); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_projects_updated_at') THEN CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at(); END IF; END $$;
CREATE OR REPLACE FUNCTION public.enforce_task_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v_ws uuid; v_proj uuid;
BEGIN
  IF TG_OP='INSERT' OR TG_OP='UPDATE' THEN
    SELECT workspace_id INTO v_ws FROM public.projects WHERE id=NEW.project_id;
    IF v_ws IS NULL OR v_ws<>NEW.workspace_id THEN RAISE EXCEPTION 'tasks: workspace_id must match project workspace_id'; END IF;
    IF NEW.workstream_id IS NOT NULL THEN
      SELECT project_id INTO v_proj FROM public.workstreams WHERE id=NEW.workstream_id;
      IF v_proj IS NULL OR v_proj<>NEW.project_id THEN RAISE EXCEPTION 'tasks: workstream must belong to same project'; END IF;
    END IF;
  END IF; RETURN NEW;
END;
$$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_tasks_enforce_scope') THEN CREATE TRIGGER trg_tasks_enforce_scope BEFORE INSERT OR UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.enforce_task_scope(); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_activity_no_update') THEN CREATE TRIGGER trg_activity_no_update BEFORE UPDATE OR DELETE ON public.activity_events FOR EACH ROW EXECUTE FUNCTION public.prevent_activity_mutation(); END IF; END $$;
-- ---------------------------------------------------------------------------
-- RLS enable
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workstreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_jobs ENABLE ROW LEVEL SECURITY;
-- ---------------------------------------------------------------------------
-- GRANTs (anon denied)
-- ---------------------------------------------------------------------------
REVOKE ALL ON SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated, anon;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('profiles','workspaces','workspace_memberships','workspace_invitations','projects','project_memberships','workstreams','labels','tasks','task_checklist_items','task_labels','task_comments','task_templates','calendar_events','inbox_items','meetings','transcript_segments','meeting_action_proposals','decisions','reports','report_schedules','training_modules','training_progress','support_tickets','support_updates','documents','attachments','notifications','activity_events','integrations','external_links','integration_jobs','schema_version') LOOP EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon',r.tablename); END LOOP; END $$;
GRANT SELECT,INSERT,UPDATE ON public.profiles TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.workspaces TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.workspace_memberships TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.workspace_invitations TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.projects TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.project_memberships TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.workstreams TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.labels TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.tasks TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.task_checklist_items TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.task_labels TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.task_comments TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.task_templates TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.calendar_events TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.inbox_items TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.meetings TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.transcript_segments TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.meeting_action_proposals TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.decisions TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.reports TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.report_schedules TO authenticated;
GRANT SELECT ON public.training_modules TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.training_progress TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.support_tickets TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.support_updates TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.documents TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.attachments TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notifications TO authenticated;
GRANT SELECT,INSERT ON public.activity_events TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.integrations TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.external_links TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.integration_jobs TO authenticated;
GRANT SELECT ON public.schema_version TO authenticated;
-- ---------------------------------------------------------------------------
-- Security definer helpers (documented hardened search_path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT EXISTS (SELECT 1 FROM public.workspace_memberships WHERE workspace_id=p_workspace_id AND user_id=auth.uid()); $$;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid) FROM public; GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.workspace_role(p_workspace_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT role FROM public.workspace_memberships WHERE workspace_id=p_workspace_id AND user_id=auth.uid() LIMIT 1; $$;
REVOKE ALL ON FUNCTION public.workspace_role(uuid) FROM public; GRANT EXECUTE ON FUNCTION public.workspace_role(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT EXISTS (SELECT 1 FROM public.workspace_memberships WHERE workspace_id=p_workspace_id AND user_id=auth.uid() AND role='workspace_admin'); $$;
REVOKE ALL ON FUNCTION public.is_workspace_admin(uuid) FROM public; GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id=p_project_id AND public.is_workspace_member(p.workspace_id)); $$;
REVOKE ALL ON FUNCTION public.is_project_member(uuid) FROM public; GRANT EXECUTE ON FUNCTION public.is_project_member(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.can_manage_project(p_project_id uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT EXISTS (SELECT 1 FROM public.projects p JOIN public.workspace_memberships wm ON wm.workspace_id=p.workspace_id AND wm.user_id=auth.uid() WHERE p.id=p_project_id AND wm.role IN ('workspace_admin','project_lead')); $$;
REVOKE ALL ON FUNCTION public.can_manage_project(uuid) FROM public; GRANT EXECUTE ON FUNCTION public.can_manage_project(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.can_access_storage_path(p_path text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE v_ws uuid; BEGIN BEGIN v_ws:=(regexp_split_to_array(p_path,'/'))[1]::uuid; EXCEPTION WHEN others THEN RETURN false; END; RETURN public.is_workspace_member(v_ws); END; $$;
REVOKE ALL ON FUNCTION public.can_access_storage_path(text) FROM public; GRANT EXECUTE ON FUNCTION public.can_access_storage_path(text) TO authenticated;
-- Secure view (security_invoker true, membership-gated)
CREATE OR REPLACE VIEW public.v_tasks_detail WITH (security_invoker=true) AS SELECT t.id,t.project_id,t.workspace_id,t.title,t.status,t.due_date,t.owner_id,t.lifecycle FROM public.tasks t WHERE public.is_workspace_member(t.workspace_id);
REVOKE ALL ON TABLE public.v_tasks_detail FROM anon; GRANT SELECT ON TABLE public.v_tasks_detail TO authenticated;
-- ---------------------------------------------------------------------------
-- Private storage bucket + policies
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id,name,public) VALUES ('attachments','attachments',false) ON CONFLICT (id) DO NOTHING;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='attachments_select_member') THEN CREATE POLICY attachments_select_member ON storage.objects FOR SELECT TO authenticated USING (bucket_id='attachments' AND public.can_access_storage_path(name)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='attachments_insert_member') THEN CREATE POLICY attachments_insert_member ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='attachments' AND public.can_access_storage_path(name)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='attachments_update_member') THEN CREATE POLICY attachments_update_member ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='attachments' AND public.can_access_storage_path(name)) WITH CHECK (bucket_id='attachments' AND public.can_access_storage_path(name)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='attachments_delete_member') THEN CREATE POLICY attachments_delete_member ON storage.objects FOR DELETE TO authenticated USING (bucket_id='attachments' AND public.can_access_storage_path(name)); END IF; END $$;
-- ---------------------------------------------------------------------------
-- RLS policies (operation-specific, membership authoritative, no generic bypass)
-- ---------------------------------------------------------------------------
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_own_or_member') THEN CREATE POLICY profiles_select_own_or_member ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid() OR EXISTS (SELECT 1 FROM public.workspace_memberships wm WHERE wm.user_id=auth.uid() AND EXISTS (SELECT 1 FROM public.workspace_memberships wm2 WHERE wm2.workspace_id=wm.workspace_id AND wm2.user_id=profiles.id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_own') THEN CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid()) WITH CHECK (id=auth.uid()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_insert_own') THEN CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (id=auth.uid()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspaces' AND policyname='workspaces_select_member') THEN CREATE POLICY workspaces_select_member ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspaces' AND policyname='workspaces_insert_auth') THEN CREATE POLICY workspaces_insert_auth ON public.workspaces FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspaces' AND policyname='workspaces_update_admin') THEN CREATE POLICY workspaces_update_admin ON public.workspaces FOR UPDATE TO authenticated USING (public.is_workspace_admin(id)) WITH CHECK (public.is_workspace_admin(id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspaces' AND policyname='workspaces_delete_admin') THEN CREATE POLICY workspaces_delete_admin ON public.workspaces FOR DELETE TO authenticated USING (public.is_workspace_admin(id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspace_memberships' AND policyname='wsm_select_member') THEN CREATE POLICY wsm_select_member ON public.workspace_memberships FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspace_memberships' AND policyname='wsm_insert_admin') THEN CREATE POLICY wsm_insert_admin ON public.workspace_memberships FOR INSERT TO authenticated WITH CHECK (public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspace_memberships' AND policyname='wsm_update_admin') THEN CREATE POLICY wsm_update_admin ON public.workspace_memberships FOR UPDATE TO authenticated USING (public.is_workspace_admin(workspace_id)) WITH CHECK (public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspace_memberships' AND policyname='wsm_delete_admin') THEN CREATE POLICY wsm_delete_admin ON public.workspace_memberships FOR DELETE TO authenticated USING (public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspace_invitations' AND policyname='wsi_select_member') THEN CREATE POLICY wsi_select_member ON public.workspace_invitations FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspace_invitations' AND policyname='wsi_insert_admin') THEN CREATE POLICY wsi_insert_admin ON public.workspace_invitations FOR INSERT TO authenticated WITH CHECK (public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspace_invitations' AND policyname='wsi_update_admin') THEN CREATE POLICY wsi_update_admin ON public.workspace_invitations FOR UPDATE TO authenticated USING (public.is_workspace_admin(workspace_id)) WITH CHECK (public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workspace_invitations' AND policyname='wsi_delete_admin') THEN CREATE POLICY wsi_delete_admin ON public.workspace_invitations FOR DELETE TO authenticated USING (public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='projects' AND policyname='projects_select_member') THEN CREATE POLICY projects_select_member ON public.projects FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='projects' AND policyname='projects_insert_admin_lead') THEN CREATE POLICY projects_insert_admin_lead ON public.projects FOR INSERT TO authenticated WITH CHECK (public.is_workspace_admin(workspace_id) OR public.workspace_role(workspace_id)='project_lead'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='projects' AND policyname='projects_update_admin_lead') THEN CREATE POLICY projects_update_admin_lead ON public.projects FOR UPDATE TO authenticated USING (public.is_workspace_admin(workspace_id) OR public.workspace_role(workspace_id)='project_lead') WITH CHECK (public.is_workspace_admin(workspace_id) OR public.workspace_role(workspace_id)='project_lead'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='projects' AND policyname='projects_delete_admin') THEN CREATE POLICY projects_delete_admin ON public.projects FOR DELETE TO authenticated USING (public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_memberships' AND policyname='pm_select_member') THEN CREATE POLICY pm_select_member ON public.project_memberships FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_memberships' AND policyname='pm_insert_admin_lead') THEN CREATE POLICY pm_insert_admin_lead ON public.project_memberships FOR INSERT TO authenticated WITH CHECK (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_memberships' AND policyname='pm_update_admin_lead') THEN CREATE POLICY pm_update_admin_lead ON public.project_memberships FOR UPDATE TO authenticated USING (public.can_manage_project(project_id)) WITH CHECK (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='project_memberships' AND policyname='pm_delete_admin_lead') THEN CREATE POLICY pm_delete_admin_lead ON public.project_memberships FOR DELETE TO authenticated USING (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workstreams' AND policyname='workstreams_select_member') THEN CREATE POLICY workstreams_select_member ON public.workstreams FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workstreams' AND policyname='workstreams_modify_lead') THEN CREATE POLICY workstreams_modify_lead ON public.workstreams FOR INSERT TO authenticated WITH CHECK (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workstreams' AND policyname='workstreams_update_lead') THEN CREATE POLICY workstreams_update_lead ON public.workstreams FOR UPDATE TO authenticated USING (public.can_manage_project(project_id)) WITH CHECK (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='workstreams' AND policyname='workstreams_delete_lead') THEN CREATE POLICY workstreams_delete_lead ON public.workstreams FOR DELETE TO authenticated USING (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='labels' AND policyname='labels_select_member') THEN CREATE POLICY labels_select_member ON public.labels FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='labels' AND policyname='labels_modify_lead') THEN CREATE POLICY labels_modify_lead ON public.labels FOR INSERT TO authenticated WITH CHECK (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='labels' AND policyname='labels_update_lead') THEN CREATE POLICY labels_update_lead ON public.labels FOR UPDATE TO authenticated USING (public.can_manage_project(project_id)) WITH CHECK (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='labels' AND policyname='labels_delete_lead') THEN CREATE POLICY labels_delete_lead ON public.labels FOR DELETE TO authenticated USING (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tasks' AND policyname='tasks_select_member') THEN CREATE POLICY tasks_select_member ON public.tasks FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tasks' AND policyname='tasks_insert_member') THEN CREATE POLICY tasks_insert_member ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id) AND public.workspace_role(workspace_id) IN ('workspace_admin','project_lead','it_coordinator','member')); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tasks' AND policyname='tasks_update_own_or_lead') THEN CREATE POLICY tasks_update_own_or_lead ON public.tasks FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id) AND (owner_id=auth.uid() OR created_by=auth.uid() OR public.can_manage_project(project_id))) WITH CHECK (public.is_workspace_member(workspace_id) AND (owner_id=auth.uid() OR created_by=auth.uid() OR public.can_manage_project(project_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tasks' AND policyname='tasks_delete_lead') THEN CREATE POLICY tasks_delete_lead ON public.tasks FOR DELETE TO authenticated USING (public.can_manage_project(project_id) OR public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_checklist_items' AND policyname='tci_select_member') THEN CREATE POLICY tci_select_member ON public.task_checklist_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.is_workspace_member(t.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_checklist_items' AND policyname='tci_insert_member') THEN CREATE POLICY tci_insert_member ON public.task_checklist_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.is_workspace_member(t.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_checklist_items' AND policyname='tci_update_member') THEN CREATE POLICY tci_update_member ON public.task_checklist_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.is_workspace_member(t.workspace_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.is_workspace_member(t.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_checklist_items' AND policyname='tci_delete_member') THEN CREATE POLICY tci_delete_member ON public.task_checklist_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.is_workspace_member(t.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_labels' AND policyname='tl_select_member') THEN CREATE POLICY tl_select_member ON public.task_labels FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.is_workspace_member(t.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_labels' AND policyname='tl_modify_member') THEN CREATE POLICY tl_modify_member ON public.task_labels FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.is_workspace_member(t.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_labels' AND policyname='tl_delete_member') THEN CREATE POLICY tl_delete_member ON public.task_labels FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.is_workspace_member(t.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_comments' AND policyname='tc_select_member') THEN CREATE POLICY tc_select_member ON public.task_comments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.is_workspace_member(t.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_comments' AND policyname='tc_insert_member') THEN CREATE POLICY tc_insert_member ON public.task_comments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.is_workspace_member(t.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_comments' AND policyname='tc_delete_own') THEN CREATE POLICY tc_delete_own ON public.task_comments FOR DELETE TO authenticated USING (author_id=auth.uid() OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.id=task_id AND public.can_manage_project(t.project_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_templates' AND policyname='tt_select_member') THEN CREATE POLICY tt_select_member ON public.task_templates FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_templates' AND policyname='tt_modify_lead') THEN CREATE POLICY tt_modify_lead ON public.task_templates FOR INSERT TO authenticated WITH CHECK (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_templates' AND policyname='tt_update_lead') THEN CREATE POLICY tt_update_lead ON public.task_templates FOR UPDATE TO authenticated USING (public.can_manage_project(project_id)) WITH CHECK (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='task_templates' AND policyname='tt_delete_lead') THEN CREATE POLICY tt_delete_lead ON public.task_templates FOR DELETE TO authenticated USING (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='calendar_events' AND policyname='ce_select_member') THEN CREATE POLICY ce_select_member ON public.calendar_events FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='calendar_events' AND policyname='ce_insert_member') THEN CREATE POLICY ce_insert_member ON public.calendar_events FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='calendar_events' AND policyname='ce_update_member') THEN CREATE POLICY ce_update_member ON public.calendar_events FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='calendar_events' AND policyname='ce_delete_member') THEN CREATE POLICY ce_delete_member ON public.calendar_events FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inbox_items' AND policyname='inbox_select_member') THEN CREATE POLICY inbox_select_member ON public.inbox_items FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inbox_items' AND policyname='inbox_insert_member') THEN CREATE POLICY inbox_insert_member ON public.inbox_items FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inbox_items' AND policyname='inbox_update_member') THEN CREATE POLICY inbox_update_member ON public.inbox_items FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inbox_items' AND policyname='inbox_delete_member') THEN CREATE POLICY inbox_delete_member ON public.inbox_items FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meetings' AND policyname='meetings_select_member') THEN CREATE POLICY meetings_select_member ON public.meetings FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meetings' AND policyname='meetings_insert_member') THEN CREATE POLICY meetings_insert_member ON public.meetings FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meetings' AND policyname='meetings_update_member') THEN CREATE POLICY meetings_update_member ON public.meetings FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meetings' AND policyname='meetings_delete_lead') THEN CREATE POLICY meetings_delete_lead ON public.meetings FOR DELETE TO authenticated USING (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transcript_segments' AND policyname='ts_select_member') THEN CREATE POLICY ts_select_member ON public.transcript_segments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id=meeting_id AND public.is_workspace_member(m.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transcript_segments' AND policyname='ts_insert_member') THEN CREATE POLICY ts_insert_member ON public.transcript_segments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id=meeting_id AND public.is_workspace_member(m.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transcript_segments' AND policyname='ts_delete_member') THEN CREATE POLICY ts_delete_member ON public.transcript_segments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id=meeting_id AND public.is_workspace_member(m.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meeting_action_proposals' AND policyname='map_select_member') THEN CREATE POLICY map_select_member ON public.meeting_action_proposals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id=meeting_id AND public.is_workspace_member(m.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meeting_action_proposals' AND policyname='map_insert_member') THEN CREATE POLICY map_insert_member ON public.meeting_action_proposals FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id=meeting_id AND public.is_workspace_member(m.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='meeting_action_proposals' AND policyname='map_update_member') THEN CREATE POLICY map_update_member ON public.meeting_action_proposals FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id=meeting_id AND public.is_workspace_member(m.workspace_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id=meeting_id AND public.is_workspace_member(m.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='decisions' AND policyname='decisions_select_member') THEN CREATE POLICY decisions_select_member ON public.decisions FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='decisions' AND policyname='decisions_modify_member') THEN CREATE POLICY decisions_modify_member ON public.decisions FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='decisions' AND policyname='decisions_update_member') THEN CREATE POLICY decisions_update_member ON public.decisions FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='decisions' AND policyname='decisions_delete_admin') THEN CREATE POLICY decisions_delete_admin ON public.decisions FOR DELETE TO authenticated USING (public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reports' AND policyname='reports_select_member') THEN CREATE POLICY reports_select_member ON public.reports FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reports' AND policyname='reports_insert_member') THEN CREATE POLICY reports_insert_member ON public.reports FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reports' AND policyname='reports_update_member') THEN CREATE POLICY reports_update_member ON public.reports FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reports' AND policyname='reports_delete_admin') THEN CREATE POLICY reports_delete_admin ON public.reports FOR DELETE TO authenticated USING (public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='report_schedules' AND policyname='rs_select_member') THEN CREATE POLICY rs_select_member ON public.report_schedules FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='report_schedules' AND policyname='rs_modify_admin_lead') THEN CREATE POLICY rs_modify_admin_lead ON public.report_schedules FOR INSERT TO authenticated WITH CHECK (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='report_schedules' AND policyname='rs_update_admin_lead') THEN CREATE POLICY rs_update_admin_lead ON public.report_schedules FOR UPDATE TO authenticated USING (public.can_manage_project(project_id)) WITH CHECK (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='report_schedules' AND policyname='rs_delete_admin_lead') THEN CREATE POLICY rs_delete_admin_lead ON public.report_schedules FOR DELETE TO authenticated USING (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='training_modules' AND policyname='tm_select_member') THEN CREATE POLICY tm_select_member ON public.training_modules FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='training_modules' AND policyname='tm_modify_admin') THEN CREATE POLICY tm_modify_admin ON public.training_modules FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.workspace_memberships wm WHERE wm.user_id=auth.uid() AND wm.role IN ('workspace_admin','project_lead','it_coordinator'))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='training_progress' AND policyname='tp_select_own_or_lead') THEN CREATE POLICY tp_select_own_or_lead ON public.training_progress FOR SELECT TO authenticated USING (person_id=auth.uid() OR EXISTS (SELECT 1 FROM public.workspace_memberships wm WHERE wm.user_id=auth.uid() AND wm.role IN ('workspace_admin','project_lead','it_coordinator'))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='training_progress' AND policyname='tp_insert_own') THEN CREATE POLICY tp_insert_own ON public.training_progress FOR INSERT TO authenticated WITH CHECK (person_id=auth.uid()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='training_progress' AND policyname='tp_update_own') THEN CREATE POLICY tp_update_own ON public.training_progress FOR UPDATE TO authenticated USING (person_id=auth.uid()) WITH CHECK (person_id=auth.uid()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='st_select_scoped') THEN CREATE POLICY st_select_scoped ON public.support_tickets FOR SELECT TO authenticated USING (requester_id=auth.uid() OR coordinator_id=auth.uid() OR public.is_workspace_admin(workspace_id) OR public.workspace_role(workspace_id)='it_coordinator'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='st_insert_member') THEN CREATE POLICY st_insert_member ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id) AND requester_id=auth.uid()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_tickets' AND policyname='st_update_scoped') THEN CREATE POLICY st_update_scoped ON public.support_tickets FOR UPDATE TO authenticated USING (requester_id=auth.uid() OR coordinator_id=auth.uid() OR public.is_workspace_admin(workspace_id) OR public.workspace_role(workspace_id)='it_coordinator') WITH CHECK (requester_id=auth.uid() OR coordinator_id=auth.uid() OR public.is_workspace_admin(workspace_id) OR public.workspace_role(workspace_id)='it_coordinator'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_updates' AND policyname='su_select_scoped') THEN CREATE POLICY su_select_scoped ON public.support_updates FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id=ticket_id AND (st.requester_id=auth.uid() OR st.coordinator_id=auth.uid() OR public.is_workspace_admin(st.workspace_id) OR public.workspace_role(st.workspace_id)='it_coordinator'))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='support_updates' AND policyname='su_insert_scoped') THEN CREATE POLICY su_insert_scoped ON public.support_updates FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.support_tickets st WHERE st.id=ticket_id AND (st.requester_id=auth.uid() OR st.coordinator_id=auth.uid() OR public.is_workspace_admin(st.workspace_id) OR public.workspace_role(st.workspace_id)='it_coordinator'))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='docs_select_member') THEN CREATE POLICY docs_select_member ON public.documents FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='docs_insert_member') THEN CREATE POLICY docs_insert_member ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='docs_update_member') THEN CREATE POLICY docs_update_member ON public.documents FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='documents' AND policyname='docs_delete_lead') THEN CREATE POLICY docs_delete_lead ON public.documents FOR DELETE TO authenticated USING (public.can_manage_project(project_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='attachments' AND policyname='att_select_member') THEN CREATE POLICY att_select_member ON public.attachments FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='attachments' AND policyname='att_insert_member') THEN CREATE POLICY att_insert_member ON public.attachments FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id) AND uploaded_by=auth.uid()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='attachments' AND policyname='att_delete_member') THEN CREATE POLICY att_delete_member ON public.attachments FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notif_select_own') THEN CREATE POLICY notif_select_own ON public.notifications FOR SELECT TO authenticated USING (person_id=auth.uid()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notif_update_own') THEN CREATE POLICY notif_update_own ON public.notifications FOR UPDATE TO authenticated USING (person_id=auth.uid()) WITH CHECK (person_id=auth.uid()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notif_insert_member') THEN CREATE POLICY notif_insert_member ON public.notifications FOR INSERT TO authenticated WITH CHECK (person_id=auth.uid() OR public.is_workspace_member((SELECT workspace_id FROM public.workspaces LIMIT 1))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activity_events' AND policyname='ae_select_member') THEN CREATE POLICY ae_select_member ON public.activity_events FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='activity_events' AND policyname='ae_insert_member') THEN CREATE POLICY ae_insert_member ON public.activity_events FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='integrations' AND policyname='integ_select_member') THEN CREATE POLICY integ_select_member ON public.integrations FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='integrations' AND policyname='integ_modify_admin') THEN CREATE POLICY integ_modify_admin ON public.integrations FOR INSERT TO authenticated WITH CHECK (public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='integrations' AND policyname='integ_update_admin') THEN CREATE POLICY integ_update_admin ON public.integrations FOR UPDATE TO authenticated USING (public.is_workspace_admin(workspace_id)) WITH CHECK (public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='integrations' AND policyname='integ_delete_admin') THEN CREATE POLICY integ_delete_admin ON public.integrations FOR DELETE TO authenticated USING (public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='external_links' AND policyname='el_select_member') THEN CREATE POLICY el_select_member ON public.external_links FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='external_links' AND policyname='el_insert_member') THEN CREATE POLICY el_insert_member ON public.external_links FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='external_links' AND policyname='el_update_member') THEN CREATE POLICY el_update_member ON public.external_links FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='external_links' AND policyname='el_delete_member') THEN CREATE POLICY el_delete_member ON public.external_links FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='integration_jobs' AND policyname='ij_select_member') THEN CREATE POLICY ij_select_member ON public.integration_jobs FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='integration_jobs' AND policyname='ij_insert_admin') THEN CREATE POLICY ij_insert_admin ON public.integration_jobs FOR INSERT TO authenticated WITH CHECK (public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='integration_jobs' AND policyname='ij_update_admin') THEN CREATE POLICY ij_update_admin ON public.integration_jobs FOR UPDATE TO authenticated USING (public.is_workspace_admin(workspace_id)) WITH CHECK (public.is_workspace_admin(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='schema_version' AND policyname='sv_select_auth') THEN CREATE POLICY sv_select_auth ON public.schema_version FOR SELECT TO authenticated USING (true); END IF; END $$;
INSERT INTO public.schema_version (version,description) VALUES (1,'LINET Workspace initial schema') ON CONFLICT (version) DO NOTHING;
COMMIT;
