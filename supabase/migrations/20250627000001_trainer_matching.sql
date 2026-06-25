-- Phase 14A: Trainer Matching (separate from Training Partners)

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.trainer_verification_level AS ENUM ('trainer', 'verified', 'featured');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.trainer_availability AS ENUM ('available', 'limited', 'not_accepting');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.trainer_coaching_format AS ENUM ('online', 'in_person', 'hybrid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.trainer_certification_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.trainer_connection_status AS ENUM ('pending', 'connected', 'declined', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.trainer_portfolio_category AS ENUM ('transformation', 'client_result', 'coaching');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Profile flag
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_trainer BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Trainer profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.trainer_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  bio TEXT,
  experience TEXT,
  training_philosophy TEXT,
  years_experience INT CHECK (years_experience IS NULL OR years_experience >= 0),
  specialties TEXT[] NOT NULL DEFAULT '{}',
  other_specialty TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}',
  availability_status public.trainer_availability NOT NULL DEFAULT 'available',
  coaching_formats public.trainer_coaching_format[] NOT NULL DEFAULT '{}',
  verification_level public.trainer_verification_level NOT NULL DEFAULT 'trainer',
  budget_min_monthly INT CHECK (budget_min_monthly IS NULL OR budget_min_monthly >= 0),
  budget_max_monthly INT CHECK (budget_max_monthly IS NULL OR budget_max_monthly >= 0),
  discovery_enabled BOOLEAN NOT NULL DEFAULT false,
  instagram_url TEXT,
  tiktok_url TEXT,
  youtube_url TEXT,
  website_url TEXT,
  linkedin_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainer_profiles_specialties
  ON public.trainer_profiles USING GIN (specialties);

CREATE INDEX IF NOT EXISTS idx_trainer_profiles_categories
  ON public.trainer_profiles USING GIN (categories);

CREATE INDEX IF NOT EXISTS idx_trainer_profiles_discovery
  ON public.trainer_profiles (verification_level)
  WHERE discovery_enabled = true;

-- ---------------------------------------------------------------------------
-- Certifications
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.trainer_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES public.trainer_profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT,
  issued_year INT CHECK (issued_year IS NULL OR issued_year >= 1900),
  document_url TEXT,
  document_path TEXT,
  review_status public.trainer_certification_status NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainer_certifications_trainer
  ON public.trainer_certifications (trainer_id);

-- ---------------------------------------------------------------------------
-- Portfolio photos
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.trainer_portfolio_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES public.trainer_profiles(user_id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  caption TEXT,
  category public.trainer_portfolio_category NOT NULL DEFAULT 'coaching',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trainer_portfolio_trainer
  ON public.trainer_portfolio_photos (trainer_id, sort_order);

-- ---------------------------------------------------------------------------
-- Connections (request-to-connect)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.trainer_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES public.trainer_profiles(user_id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.trainer_connection_status NOT NULL DEFAULT 'pending',
  initiated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  intro_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trainer_connections_distinct CHECK (trainer_id <> client_id),
  UNIQUE (trainer_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_connections_trainer
  ON public.trainer_connections (trainer_id, status);

CREATE INDEX IF NOT EXISTS idx_trainer_connections_client
  ON public.trainer_connections (client_id, status);

-- ---------------------------------------------------------------------------
-- Future ratings/reviews (schema only — no client UI in 14A)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.trainer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES public.trainer_profiles(user_id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES public.trainer_connections(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trainer_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_trainer_reviews_trainer_published
  ON public.trainer_reviews (trainer_id)
  WHERE is_published = true;

-- ---------------------------------------------------------------------------
-- Updated_at triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER trainer_profiles_updated_at
  BEFORE UPDATE ON public.trainer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trainer_connections_updated_at
  BEFORE UPDATE ON public.trainer_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trainer_reviews_updated_at
  BEFORE UPDATE ON public.trainer_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('trainer-certifications', 'trainer-certifications', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('trainer-portfolio', 'trainer-portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.trainer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_portfolio_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View discoverable trainer profiles"
  ON public.trainer_profiles FOR SELECT
  USING (
    discovery_enabled = true
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "Trainers manage own profile"
  ON public.trainer_profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage trainer profiles"
  ON public.trainer_profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

CREATE POLICY "View approved certifications or own"
  ON public.trainer_certifications FOR SELECT
  USING (
    review_status = 'approved'
    OR trainer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "Trainers manage own certifications"
  ON public.trainer_certifications FOR INSERT
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "Trainers update own pending certifications"
  ON public.trainer_certifications FOR UPDATE
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "Trainers delete own certifications"
  ON public.trainer_certifications FOR DELETE
  USING (trainer_id = auth.uid());

CREATE POLICY "Admins review certifications"
  ON public.trainer_certifications FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

CREATE POLICY "View portfolio for discoverable trainers or own"
  ON public.trainer_portfolio_photos FOR SELECT
  USING (
    trainer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.trainer_profiles tp
      WHERE tp.user_id = trainer_portfolio_photos.trainer_id AND tp.discovery_enabled = true
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "Trainers manage own portfolio"
  ON public.trainer_portfolio_photos FOR ALL
  USING (trainer_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "Participants view trainer connections"
  ON public.trainer_connections FOR SELECT
  USING (trainer_id = auth.uid() OR client_id = auth.uid());

CREATE POLICY "Clients create connection requests"
  ON public.trainer_connections FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    AND initiated_by = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY "Participants update trainer connections"
  ON public.trainer_connections FOR UPDATE
  USING (trainer_id = auth.uid() OR client_id = auth.uid())
  WITH CHECK (trainer_id = auth.uid() OR client_id = auth.uid());

CREATE POLICY "View published trainer reviews"
  ON public.trainer_reviews FOR SELECT
  USING (
    is_published = true
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Storage policies
CREATE POLICY "Public read trainer certifications"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trainer-certifications');

CREATE POLICY "Trainers upload certifications"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'trainer-certifications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Trainers delete own certifications"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'trainer-certifications'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public read trainer portfolio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trainer-portfolio');

CREATE POLICY "Trainers upload portfolio"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'trainer-portfolio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Trainers delete own portfolio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'trainer-portfolio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trainer_verification_rank(level public.trainer_verification_level)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE level
    WHEN 'trainer' THEN 1
    WHEN 'verified' THEN 2
    WHEN 'featured' THEN 3
  END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_trainer_verification_level(p_trainer_id UUID)
RETURNS public.trainer_verification_level
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current public.trainer_verification_level;
  v_has_pending BOOLEAN;
  v_has_approved BOOLEAN;
BEGIN
  SELECT verification_level INTO v_current
  FROM public.trainer_profiles
  WHERE user_id = p_trainer_id;

  IF NOT FOUND THEN
    RETURN 'trainer';
  END IF;

  IF v_current = 'featured' THEN
    RETURN v_current;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.trainer_certifications
    WHERE trainer_id = p_trainer_id AND review_status = 'pending'
  ) INTO v_has_pending;

  SELECT EXISTS (
    SELECT 1 FROM public.trainer_certifications
    WHERE trainer_id = p_trainer_id AND review_status = 'approved'
  ) INTO v_has_approved;

  IF v_has_approved AND NOT v_has_pending THEN
    UPDATE public.trainer_profiles
    SET verification_level = 'verified'
    WHERE user_id = p_trainer_id AND verification_level <> 'featured';
    RETURN 'verified';
  END IF;

  UPDATE public.trainer_profiles
  SET verification_level = 'trainer'
  WHERE user_id = p_trainer_id AND verification_level <> 'featured';

  RETURN 'trainer';
END;
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_trainer_profile(
  p_bio TEXT DEFAULT NULL,
  p_experience TEXT DEFAULT NULL,
  p_training_philosophy TEXT DEFAULT NULL,
  p_years_experience INT DEFAULT NULL,
  p_specialties TEXT[] DEFAULT '{}',
  p_other_specialty TEXT DEFAULT NULL,
  p_categories TEXT[] DEFAULT '{}',
  p_availability_status public.trainer_availability DEFAULT 'available',
  p_coaching_formats public.trainer_coaching_format[] DEFAULT '{}',
  p_budget_min_monthly INT DEFAULT NULL,
  p_budget_max_monthly INT DEFAULT NULL,
  p_discovery_enabled BOOLEAN DEFAULT false,
  p_instagram_url TEXT DEFAULT NULL,
  p_tiktok_url TEXT DEFAULT NULL,
  p_youtube_url TEXT DEFAULT NULL,
  p_website_url TEXT DEFAULT NULL,
  p_linkedin_url TEXT DEFAULT NULL
)
RETURNS public.trainer_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_row public.trainer_profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.trainer_profiles (
    user_id, bio, experience, training_philosophy, years_experience,
    specialties, other_specialty, categories, availability_status, coaching_formats,
    budget_min_monthly, budget_max_monthly, discovery_enabled,
    instagram_url, tiktok_url, youtube_url, website_url, linkedin_url
  )
  VALUES (
    v_user_id, p_bio, p_experience, p_training_philosophy, p_years_experience,
    COALESCE(p_specialties, '{}'), p_other_specialty, COALESCE(p_categories, '{}'), p_availability_status,
    COALESCE(p_coaching_formats, '{}'), p_budget_min_monthly, p_budget_max_monthly,
    COALESCE(p_discovery_enabled, false),
    p_instagram_url, p_tiktok_url, p_youtube_url, p_website_url, p_linkedin_url
  )
  ON CONFLICT (user_id) DO UPDATE SET
    bio = EXCLUDED.bio,
    experience = EXCLUDED.experience,
    training_philosophy = EXCLUDED.training_philosophy,
    years_experience = EXCLUDED.years_experience,
    specialties = EXCLUDED.specialties,
    other_specialty = EXCLUDED.other_specialty,
    categories = EXCLUDED.categories,
    availability_status = EXCLUDED.availability_status,
    coaching_formats = EXCLUDED.coaching_formats,
    budget_min_monthly = EXCLUDED.budget_min_monthly,
    budget_max_monthly = EXCLUDED.budget_max_monthly,
    discovery_enabled = EXCLUDED.discovery_enabled,
    instagram_url = EXCLUDED.instagram_url,
    tiktok_url = EXCLUDED.tiktok_url,
    youtube_url = EXCLUDED.youtube_url,
    website_url = EXCLUDED.website_url,
    linkedin_url = EXCLUDED.linkedin_url,
    updated_at = now()
  RETURNING * INTO v_row;

  UPDATE public.profiles SET is_trainer = true WHERE id = v_user_id;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trainer_profile(p_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_trainer public.trainer_profiles%ROWTYPE;
  v_connection public.trainer_connections%ROWTYPE;
  v_certs JSONB;
  v_portfolio JSONB;
  v_review_stats JSONB;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE username = p_username;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_trainer FROM public.trainer_profiles WHERE user_id = v_profile.id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_trainer.discovery_enabled = false AND v_viewer IS DISTINCT FROM v_profile.id
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_viewer AND p.is_admin = true) THEN
    RETURN NULL;
  END IF;

  IF v_viewer IS NOT NULL AND public.users_are_blocked(v_viewer, v_profile.id) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_connection
  FROM public.trainer_connections tc
  WHERE tc.trainer_id = v_profile.id
    AND tc.client_id = v_viewer
    AND tc.status IN ('pending', 'connected')
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO v_certs
  FROM public.trainer_certifications c
  WHERE c.trainer_id = v_profile.id
    AND (c.review_status = 'approved' OR c.trainer_id = v_viewer
         OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_viewer AND p.is_admin = true));

  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.sort_order, p.created_at), '[]'::jsonb)
  INTO v_portfolio
  FROM public.trainer_portfolio_photos p
  WHERE p.trainer_id = v_profile.id;

  SELECT jsonb_build_object(
    'avg_rating', ROUND(AVG(r.rating)::numeric, 1),
    'review_count', COUNT(*)::int
  )
  INTO v_review_stats
  FROM public.trainer_reviews r
  WHERE r.trainer_id = v_profile.id AND r.is_published = true;

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'trainer', to_jsonb(v_trainer),
    'certifications', v_certs,
    'portfolio', v_portfolio,
    'connection', CASE WHEN v_connection.id IS NULL THEN NULL ELSE to_jsonb(v_connection) END,
    'review_stats', COALESCE(v_review_stats, jsonb_build_object('avg_rating', NULL, 'review_count', 0))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.search_trainers(
  p_query TEXT DEFAULT NULL,
  p_goal TEXT DEFAULT NULL,
  p_specialty TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_budget_max INT DEFAULT NULL,
  p_coaching_format public.trainer_coaching_format DEFAULT NULL,
  p_verification_level public.trainer_verification_level DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
  v_rows JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(row_data ORDER BY sort_verification DESC, sort_created DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      jsonb_build_object(
        'profile', to_jsonb(p),
        'trainer', to_jsonb(tp),
        'connection_status', (
          SELECT tc.status::text
          FROM public.trainer_connections tc
          WHERE tc.trainer_id = tp.user_id AND tc.client_id = v_viewer
            AND tc.status IN ('pending', 'connected')
          LIMIT 1
        ),
        'approved_cert_count', (
          SELECT COUNT(*)::int FROM public.trainer_certifications c
          WHERE c.trainer_id = tp.user_id AND c.review_status = 'approved'
        ),
        'portfolio_preview', (
          SELECT COALESCE(jsonb_agg(to_jsonb(pp) ORDER BY pp.sort_order, pp.created_at), '[]'::jsonb)
          FROM (
            SELECT * FROM public.trainer_portfolio_photos pp
            WHERE pp.trainer_id = tp.user_id
            ORDER BY pp.sort_order, pp.created_at
            LIMIT 3
          ) pp
        )
      ) AS row_data,
      public.trainer_verification_rank(tp.verification_level) AS sort_verification,
      tp.created_at AS sort_created
    FROM public.trainer_profiles tp
    JOIN public.profiles p ON p.id = tp.user_id
    WHERE tp.discovery_enabled = true
      AND tp.availability_status <> 'not_accepting'
      AND (v_viewer IS NULL OR tp.user_id <> v_viewer)
      AND (v_viewer IS NULL OR NOT public.users_are_blocked(v_viewer, tp.user_id))
      AND (p_query IS NULL OR p_query = '' OR
           p.display_name ILIKE '%' || p_query || '%' OR
           p.username ILIKE '%' || p_query || '%' OR
           COALESCE(tp.bio, '') ILIKE '%' || p_query || '%')
      AND (p_specialty IS NULL OR p_specialty = '' OR p_specialty = ANY(tp.specialties)
           OR (p_specialty = 'other' AND tp.other_specialty IS NOT NULL))
      AND (p_category IS NULL OR p_category = '' OR p_category = ANY(tp.categories))
      AND (p_goal IS NULL OR p_goal = '' OR p_goal = ANY(tp.specialties)
           OR p_goal = ANY(p.fitness_goals))
      AND (p_city IS NULL OR p_city = '' OR COALESCE(p.city, '') ILIKE '%' || p_city || '%')
      AND (p_budget_max IS NULL OR tp.budget_min_monthly IS NULL OR tp.budget_min_monthly <= p_budget_max)
      AND (p_coaching_format IS NULL OR p_coaching_format = ANY(tp.coaching_formats))
      AND (p_verification_level IS NULL OR
           public.trainer_verification_rank(tp.verification_level) >=
           public.trainer_verification_rank(p_verification_level))
    ORDER BY sort_verification DESC, sort_created DESC
    LIMIT v_limit OFFSET v_offset
  ) sub;

  RETURN jsonb_build_object('results', v_rows, 'limit', v_limit, 'offset', v_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.request_trainer_connection(
  p_trainer_id UUID,
  p_intro_message TEXT DEFAULT NULL
)
RETURNS public.trainer_connections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id UUID := auth.uid();
  v_trainer public.trainer_profiles%ROWTYPE;
  v_row public.trainer_connections%ROWTYPE;
BEGIN
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_client_id = p_trainer_id THEN
    RAISE EXCEPTION 'You cannot connect with yourself';
  END IF;

  IF public.users_are_blocked(v_client_id, p_trainer_id) THEN
    RAISE EXCEPTION 'You cannot connect with this trainer';
  END IF;

  SELECT * INTO v_trainer FROM public.trainer_profiles WHERE user_id = p_trainer_id;
  IF NOT FOUND OR v_trainer.discovery_enabled = false THEN
    RAISE EXCEPTION 'Trainer is not available';
  END IF;

  IF v_trainer.availability_status = 'not_accepting' THEN
    RAISE EXCEPTION 'This trainer is not accepting new clients';
  END IF;

  INSERT INTO public.trainer_connections (trainer_id, client_id, status, initiated_by, intro_message)
  VALUES (p_trainer_id, v_client_id, 'pending', v_client_id, p_intro_message)
  ON CONFLICT (trainer_id, client_id) DO UPDATE SET
    status = CASE
      WHEN trainer_connections.status IN ('declined', 'removed') THEN 'pending'
      ELSE trainer_connections.status
    END,
    intro_message = EXCLUDED.intro_message,
    initiated_by = EXCLUDED.initiated_by,
    updated_at = now()
  WHERE trainer_connections.status IN ('declined', 'removed')
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    SELECT * INTO v_row FROM public.trainer_connections
    WHERE trainer_id = p_trainer_id AND client_id = v_client_id;
  END IF;

  IF v_row.status = 'pending' AND v_row.initiated_by = v_client_id THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      p_trainer_id,
      'trainer_connection_request',
      jsonb_build_object(
        'connection_id', v_row.id,
        'client_id', v_client_id,
        'intro_message', p_intro_message
      )
    );
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_trainer_connection(
  p_connection_id UUID,
  p_accept BOOLEAN
)
RETURNS public.trainer_connections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trainer_id UUID := auth.uid();
  v_row public.trainer_connections%ROWTYPE;
  v_new_status public.trainer_connection_status;
BEGIN
  IF v_trainer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row FROM public.trainer_connections WHERE id = p_connection_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection request not found';
  END IF;

  IF v_row.trainer_id <> v_trainer_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'This request is no longer pending';
  END IF;

  v_new_status := CASE WHEN p_accept THEN 'connected'::public.trainer_connection_status
                       ELSE 'declined'::public.trainer_connection_status END;

  UPDATE public.trainer_connections
  SET status = v_new_status, updated_at = now()
  WHERE id = p_connection_id
  RETURNING * INTO v_row;

  IF p_accept THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      v_row.client_id,
      'trainer_connection_accepted',
      jsonb_build_object(
        'connection_id', v_row.id,
        'trainer_id', v_row.trainer_id
      )
    );
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trainer_connections(p_role TEXT DEFAULT NULL)
RETURNS SETOF public.trainer_connections
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT tc.*
  FROM public.trainer_connections tc
  WHERE tc.status IN ('pending', 'connected')
    AND (
      (COALESCE(p_role, '') = 'trainer' AND tc.trainer_id = v_user_id)
      OR (COALESCE(p_role, '') = 'client' AND tc.client_id = v_user_id)
      OR (COALESCE(p_role, '') NOT IN ('trainer', 'client') AND (tc.trainer_id = v_user_id OR tc.client_id = v_user_id))
    )
    AND NOT public.users_are_blocked(
      v_user_id,
      CASE WHEN tc.trainer_id = v_user_id THEN tc.client_id ELSE tc.trainer_id END
    )
  ORDER BY tc.updated_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_trainer_connection(p_connection_id UUID)
RETURNS public.trainer_connections
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_row public.trainer_connections%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_row FROM public.trainer_connections WHERE id = p_connection_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Connection not found';
  END IF;

  IF v_row.trainer_id <> v_user_id AND v_row.client_id <> v_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.trainer_connections
  SET status = 'removed', updated_at = now()
  WHERE id = p_connection_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_trainer_conversation(p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_trainer_id UUID;
  v_client_id UUID;
  v_connected BOOLEAN;
  v_conversation_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.users_are_blocked(v_user_id, p_other_user_id) THEN
    RAISE EXCEPTION 'You cannot message this user';
  END IF;

  IF EXISTS (SELECT 1 FROM public.trainer_profiles WHERE user_id = v_user_id) THEN
    v_trainer_id := v_user_id;
    v_client_id := p_other_user_id;
  ELSE
    v_trainer_id := p_other_user_id;
    v_client_id := v_user_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.trainer_connections tc
    WHERE tc.trainer_id = v_trainer_id
      AND tc.client_id = v_client_id
      AND tc.status = 'connected'
  ) INTO v_connected;

  IF NOT v_connected THEN
    RAISE EXCEPTION 'You must be connected before messaging';
  END IF;

  v_conversation_id := public.create_or_get_dm_conversation(v_user_id, p_other_user_id);
  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_trainer_certification(
  p_cert_id UUID,
  p_status public.trainer_certification_status
)
RETURNS public.trainer_certifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_row public.trainer_certifications%ROWTYPE;
BEGIN
  IF v_admin IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_admin AND p.is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid review status';
  END IF;

  UPDATE public.trainer_certifications
  SET review_status = p_status,
      reviewed_at = now(),
      reviewed_by = v_admin
  WHERE id = p_cert_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Certification not found';
  END IF;

  PERFORM public.refresh_trainer_verification_level(v_row.trainer_id);
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_trainer_verification_level(
  p_trainer_id UUID,
  p_level public.trainer_verification_level
)
RETURNS public.trainer_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_row public.trainer_profiles%ROWTYPE;
BEGIN
  IF v_admin IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_admin AND p.is_admin = true) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.trainer_profiles
  SET verification_level = p_level, updated_at = now()
  WHERE user_id = p_trainer_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trainer profile not found';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_trainer_profile()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_trainer public.trainer_profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_trainer FROM public.trainer_profiles WHERE user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'trainer', to_jsonb(v_trainer),
    'certifications', (
      SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC), '[]'::jsonb)
      FROM public.trainer_certifications c WHERE c.trainer_id = v_user_id
    ),
    'portfolio', (
      SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.sort_order, p.created_at), '[]'::jsonb)
      FROM public.trainer_portfolio_photos p WHERE p.trainer_id = v_user_id
    )
  );
END;
$$;

-- Block integration: remove trainer connections on block
CREATE OR REPLACE FUNCTION public.handle_block()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.follows
  WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);

  UPDATE public.matches
  SET status = 'unmatched'
  WHERE status = 'matched'
    AND user_a = LEAST(NEW.blocker_id, NEW.blocked_id)
    AND user_b = GREATEST(NEW.blocker_id, NEW.blocked_id);

  UPDATE public.trainer_connections
  SET status = 'removed', updated_at = now()
  WHERE status IN ('pending', 'connected')
    AND (
      (trainer_id = NEW.blocker_id AND client_id = NEW.blocked_id)
      OR (trainer_id = NEW.blocked_id AND client_id = NEW.blocker_id)
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Extend message notifications for trainer connections
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER AS $$
DECLARE
  member RECORD;
  v_from_training_match boolean;
  v_from_trainer_connection boolean;
  preview_text TEXT;
BEGIN
  preview_text := CASE
    WHEN NEW.post_id IS NOT NULL THEN 'Shared a post'
    ELSE left(NEW.content, 100)
  END;

  FOR member IN
    SELECT user_id FROM public.conversation_members
    WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.status = 'matched'
        AND m.user_a = LEAST(member.user_id, NEW.sender_id)
        AND m.user_b = GREATEST(member.user_id, NEW.sender_id)
    ) INTO v_from_training_match;

    SELECT EXISTS (
      SELECT 1
      FROM public.trainer_connections tc
      WHERE tc.status = 'connected'
        AND (
          (tc.trainer_id = member.user_id AND tc.client_id = NEW.sender_id)
          OR (tc.trainer_id = NEW.sender_id AND tc.client_id = member.user_id)
        )
    ) INTO v_from_trainer_connection;

    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      member.user_id,
      'message',
      jsonb_build_object(
        'conversation_id', NEW.conversation_id,
        'sender_id', NEW.sender_id,
        'preview', preview_text,
        'post_id', NEW.post_id,
        'from_training_match', v_from_training_match,
        'from_trainer_connection', v_from_trainer_connection
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Default notification preferences for trainer types
UPDATE public.profiles
SET notification_preferences = COALESCE(notification_preferences, '{}'::jsonb)
  || '{"trainer_connection_request": true, "trainer_connection_accepted": true}'::jsonb
WHERE NOT COALESCE(notification_preferences, '{}'::jsonb) ? 'trainer_connection_request';
