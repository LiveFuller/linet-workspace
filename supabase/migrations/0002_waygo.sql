-- Waygo engine — hotel QR slugs, outreach, scans, bookings
BEGIN;

CREATE TABLE IF NOT EXISTS public.waygo_hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+){1,5}$'),
  address text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT 'Praha 1' CHECK (area IN ('Praha 1','Praha 2','Praha 3','Praha 4','Praha 5','Praha 6','Praha 7','Praha 8','Celá Praha')),
  stars int CHECK (stars IS NULL OR (stars BETWEEN 1 AND 5)),
  rooms int CHECK (rooms IS NULL OR (rooms BETWEEN 1 AND 5000)),
  contact_name text,
  contact_email text CHECK (contact_email IS NULL OR contact_email ~ '^[^@]+@[^@]+\.[^@]+$'),
  contact_phone text,
  status text NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect','contacted','meeting','loi','installed','live','churned')),
  commission_hotel_pct numeric NOT NULL DEFAULT 10 CHECK (commission_hotel_pct BETWEEN 0 AND 30),
  commission_reception_pct numeric NOT NULL DEFAULT 3 CHECK (commission_reception_pct BETWEEN 0 AND 20),
  slug_qr text NOT NULL,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  scans_total int NOT NULL DEFAULT 0 CHECK (scans_total >= 0),
  bookings_total int NOT NULL DEFAULT 0 CHECK (bookings_total >= 0),
  revenue_czk_total int NOT NULL DEFAULT 0 CHECK (revenue_czk_total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  installed_at timestamptz,
  live_at timestamptz,
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE,
  UNIQUE (workspace_id, slug),
  UNIQUE (workspace_id, slug_qr)
);

CREATE TABLE IF NOT EXISTS public.waygo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.waygo_hotels(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^[A-Z][0-9]{2,3}$'),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 80),
  slug text NOT NULL,
  type text NOT NULL DEFAULT 'hotel_shared' CHECK (type IN ('hotel_shared','personal')),
  person_name text,
  scans_total int NOT NULL DEFAULT 0 CHECK (scans_total >=0),
  bookings_total int NOT NULL DEFAULT 0 CHECK (bookings_total >=0),
  revenue_czk_total int NOT NULL DEFAULT 0 CHECK (revenue_czk_total >=0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, code),
  UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.waygo_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.waygo_hotels(id) ON DELETE CASCADE,
  code_id uuid REFERENCES public.waygo_codes(id) ON DELETE SET NULL,
  slug text NOT NULL,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent text,
  referrer text,
  converted_to_booking boolean NOT NULL DEFAULT false,
  country text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waygo_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.waygo_hotels(id) ON DELETE CASCADE,
  code_id uuid REFERENCES public.waygo_codes(id) ON DELETE SET NULL,
  slug text NOT NULL,
  experience_slug text,
  experience_title text NOT NULL CHECK (char_length(experience_title) BETWEEN 1 AND 200),
  amount_czk int NOT NULL CHECK (amount_czk >=0),
  commission_czk int NOT NULL CHECK (commission_czk >=0),
  guest_country text,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  booked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.waygo_outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.waygo_hotels(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'email' CHECK (kind IN ('email','call','visit','follow_up','note')),
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 6000),
  ai_draft text,
  outcome text,
  next_follow_up_at date,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.waygo_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  business_name text NOT NULL CHECK (char_length(business_name) BETWEEN 2 AND 120),
  ico text,
  category text NOT NULL DEFAULT 'Guided Tour / River',
  address text NOT NULL DEFAULT '',
  area text NOT NULL DEFAULT 'Praha 1',
  price_czk int CHECK (price_czk IS NULL OR price_czk >=0),
  commission_pct numeric CHECK (commission_pct IS NULL OR (commission_pct BETWEEN 0 AND 40)),
  email text NOT NULL CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$'),
  phone text,
  status text NOT NULL DEFAULT 'applied' CHECK (status IN ('applied','vetting','approved','rejected','paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id, workspace_id) REFERENCES public.projects(id, workspace_id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_waygo_hotels_workspace ON public.waygo_hotels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_waygo_hotels_project_status ON public.waygo_hotels(project_id, status);
CREATE INDEX IF NOT EXISTS idx_waygo_codes_hotel ON public.waygo_codes(hotel_id);
CREATE INDEX IF NOT EXISTS idx_waygo_scans_hotel_scanned ON public.waygo_scans(hotel_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_waygo_scans_slug ON public.waygo_scans(slug);
CREATE INDEX IF NOT EXISTS idx_waygo_bookings_hotel_booked ON public.waygo_bookings(hotel_id, booked_at DESC);
CREATE INDEX IF NOT EXISTS idx_waygo_outreach_hotel ON public.waygo_outreach(hotel_id);
CREATE INDEX IF NOT EXISTS idx_waygo_outreach_next ON public.waygo_outreach(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;

-- updated_at triggers
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_waygo_hotels_updated_at') THEN CREATE TRIGGER trg_waygo_hotels_updated_at BEFORE UPDATE ON public.waygo_hotels FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at(); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_waygo_codes_updated_at') THEN CREATE TRIGGER trg_waygo_codes_updated_at BEFORE UPDATE ON public.waygo_codes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at(); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_waygo_outreach_updated_at') THEN CREATE TRIGGER trg_waygo_outreach_updated_at BEFORE UPDATE ON public.waygo_outreach FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at(); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_waygo_providers_updated_at') THEN CREATE TRIGGER trg_waygo_providers_updated_at BEFORE UPDATE ON public.waygo_providers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at(); END IF; END $$;

-- RLS
ALTER TABLE public.waygo_hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waygo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waygo_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waygo_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waygo_outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waygo_providers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_hotels' AND policyname='waygo_hotels_select_member') THEN CREATE POLICY waygo_hotels_select_member ON public.waygo_hotels FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_hotels' AND policyname='waygo_hotels_modify_member') THEN CREATE POLICY waygo_hotels_modify_member ON public.waygo_hotels FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_hotels' AND policyname='waygo_hotels_update_member') THEN CREATE POLICY waygo_hotels_update_member ON public.waygo_hotels FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_hotels' AND policyname='waygo_hotels_delete_member') THEN CREATE POLICY waygo_hotels_delete_member ON public.waygo_hotels FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_codes' AND policyname='waygo_codes_select_member') THEN CREATE POLICY waygo_codes_select_member ON public.waygo_codes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.waygo_hotels h WHERE h.id=hotel_id AND public.is_workspace_member(h.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_codes' AND policyname='waygo_codes_modify_member') THEN CREATE POLICY waygo_codes_modify_member ON public.waygo_codes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.waygo_hotels h WHERE h.id=hotel_id AND public.is_workspace_member(h.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_codes' AND policyname='waygo_codes_update_member') THEN CREATE POLICY waygo_codes_update_member ON public.waygo_codes FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.waygo_hotels h WHERE h.id=hotel_id AND public.is_workspace_member(h.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_codes' AND policyname='waygo_codes_delete_member') THEN CREATE POLICY waygo_codes_delete_member ON public.waygo_codes FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.waygo_hotels h WHERE h.id=hotel_id AND public.is_workspace_member(h.workspace_id))); END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_scans' AND policyname='waygo_scans_select_member') THEN CREATE POLICY waygo_scans_select_member ON public.waygo_scans FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.waygo_hotels h WHERE h.id=hotel_id AND public.is_workspace_member(h.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_scans' AND policyname='waygo_scans_insert_member') THEN CREATE POLICY waygo_scans_insert_member ON public.waygo_scans FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.waygo_hotels h WHERE h.id=hotel_id AND public.is_workspace_member(h.workspace_id))); END IF; END $$;

-- scans are public readable for redirect? allow anon insert via service role only; but allow authenticated insert
-- bookings
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_bookings' AND policyname='waygo_bookings_select_member') THEN CREATE POLICY waygo_bookings_select_member ON public.waygo_bookings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.waygo_hotels h WHERE h.id=hotel_id AND public.is_workspace_member(h.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_bookings' AND policyname='waygo_bookings_modify_member') THEN CREATE POLICY waygo_bookings_modify_member ON public.waygo_bookings FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.waygo_hotels h WHERE h.id=hotel_id AND public.is_workspace_member(h.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_bookings' AND policyname='waygo_bookings_update_member') THEN CREATE POLICY waygo_bookings_update_member ON public.waygo_bookings FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.waygo_hotels h WHERE h.id=hotel_id AND public.is_workspace_member(h.workspace_id))); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_bookings' AND policyname='waygo_bookings_delete_member') THEN CREATE POLICY waygo_bookings_delete_member ON public.waygo_bookings FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.waygo_hotels h WHERE h.id=hotel_id AND public.is_workspace_member(h.workspace_id))); END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_outreach' AND policyname='waygo_outreach_select_member') THEN CREATE POLICY waygo_outreach_select_member ON public.waygo_outreach FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_outreach' AND policyname='waygo_outreach_modify_member') THEN CREATE POLICY waygo_outreach_modify_member ON public.waygo_outreach FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_outreach' AND policyname='waygo_outreach_update_member') THEN CREATE POLICY waygo_outreach_update_member ON public.waygo_outreach FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_outreach' AND policyname='waygo_outreach_delete_member') THEN CREATE POLICY waygo_outreach_delete_member ON public.waygo_outreach FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_providers' AND policyname='waygo_providers_select_member') THEN CREATE POLICY waygo_providers_select_member ON public.waygo_providers FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_providers' AND policyname='waygo_providers_modify_member') THEN CREATE POLICY waygo_providers_modify_member ON public.waygo_providers FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_providers' AND policyname='waygo_providers_update_member') THEN CREATE POLICY waygo_providers_update_member ON public.waygo_providers FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id)); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='waygo_providers' AND policyname='waygo_providers_delete_member') THEN CREATE POLICY waygo_providers_delete_member ON public.waygo_providers FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id)); END IF; END $$;

-- grants
GRANT SELECT,INSERT,UPDATE,DELETE ON public.waygo_hotels TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.waygo_codes TO authenticated;
GRANT SELECT,INSERT ON public.waygo_scans TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.waygo_bookings TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.waygo_outreach TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.waygo_providers TO authenticated;

-- public read for slug resolution (anon can resolve QR to hotel? needed for redirect) — allow anon SELECT on slug lookup via function, but not direct table anon select

COMMIT;
