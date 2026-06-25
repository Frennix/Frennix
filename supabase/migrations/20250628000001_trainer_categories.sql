-- Phase 14A: Trainer categories (coach type labels for discovery + profile)

ALTER TABLE public.trainer_profiles
  ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_trainer_profiles_categories
  ON public.trainer_profiles USING GIN (categories);

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
    COALESCE(p_specialties, '{}'), p_other_specialty, COALESCE(p_categories, '{}'),
    p_availability_status, COALESCE(p_coaching_formats, '{}'),
    p_budget_min_monthly, p_budget_max_monthly, COALESCE(p_discovery_enabled, false),
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
