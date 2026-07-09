-- Discover search polish: enriched results, suggested sections, anonymous term analytics.

CREATE TABLE IF NOT EXISTS public.discover_search_term_stats (
  term TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('interest', 'goal', 'location', 'general')),
  search_count INT NOT NULL DEFAULT 0,
  last_searched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (term, category)
);

CREATE INDEX IF NOT EXISTS idx_discover_search_term_stats_count
  ON public.discover_search_term_stats (category, search_count DESC);

ALTER TABLE public.discover_search_term_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read discover search stats" ON public.discover_search_term_stats;
CREATE POLICY "Staff read discover search stats" ON public.discover_search_term_stats
  FOR SELECT USING (public.has_staff_role('founder'::public.staff_role));

CREATE OR REPLACE FUNCTION public.record_discover_search_terms(p_query TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query TEXT := lower(btrim(COALESCE(p_query, '')));
  v_token TEXT;
BEGIN
  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  INSERT INTO public.discover_search_term_stats (term, category, search_count, last_searched_at)
  VALUES (v_query, 'general', 1, now())
  ON CONFLICT (term, category) DO UPDATE
    SET search_count = discover_search_term_stats.search_count + 1,
        last_searched_at = now();

  FOREACH v_token IN ARRAY regexp_split_to_array(v_query, '\s+') LOOP
    IF length(v_token) < 2 THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.activities, '{}')) AS activity
        WHERE lower(activity) = v_token OR lower(replace(activity, '_', ' ')) = v_token
      )
      LIMIT 1
    ) THEN
      INSERT INTO public.discover_search_term_stats (term, category, search_count, last_searched_at)
      VALUES (v_token, 'interest', 1, now())
      ON CONFLICT (term, category) DO UPDATE
        SET search_count = discover_search_term_stats.search_count + 1,
            last_searched_at = now();
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.fitness_goals, '{}')) AS goal
        WHERE lower(goal) = v_token OR lower(replace(goal, '_', ' ')) = v_token
      )
      LIMIT 1
    ) THEN
      INSERT INTO public.discover_search_term_stats (term, category, search_count, last_searched_at)
      VALUES (v_token, 'goal', 1, now())
      ON CONFLICT (term, category) DO UPDATE
        SET search_count = discover_search_term_stats.search_count + 1,
            last_searched_at = now();
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE lower(COALESCE(p.city, '')) = v_token
         OR lower(COALESCE(p.home_gym, '')) = v_token
      LIMIT 1
    ) THEN
      INSERT INTO public.discover_search_term_stats (term, category, search_count, last_searched_at)
      VALUES (v_token, 'location', 1, now())
      ON CONFLICT (term, category) DO UPDATE
        SET search_count = discover_search_term_stats.search_count + 1,
            last_searched_at = now();
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.discover_profile_item(
  p public.profiles,
  p_viewer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mutual_followers INT := 0;
  v_mutual_partners INT := 0;
  v_mutual_groups INT := 0;
  v_mutual_challenges INT := 0;
  v_badges JSONB := '[]'::jsonb;
  v_trainer_level TEXT;
  v_referral_count INT := 0;
BEGIN
  IF p_viewer_id IS NOT NULL THEN
    SELECT COUNT(*)::INT INTO v_mutual_followers
    FROM public.follows f1
    JOIN public.follows f2
      ON f2.follower_id = f1.following_id
     AND f2.following_id = p.id
    WHERE f1.follower_id = p_viewer_id;

    SELECT COUNT(DISTINCT shared.partner_id)::INT INTO v_mutual_partners
    FROM (
      SELECT CASE WHEN m.user_a = p_viewer_id THEN m.user_b ELSE m.user_a END AS partner_id
      FROM public.matches m
      WHERE m.status = 'matched'
        AND (m.user_a = p_viewer_id OR m.user_b = p_viewer_id)
      INTERSECT
      SELECT CASE WHEN m.user_a = p.id THEN m.user_b ELSE m.user_a END
      FROM public.matches m
      WHERE m.status = 'matched'
        AND (m.user_a = p.id OR m.user_b = p.id)
    ) shared;

    SELECT COUNT(*)::INT INTO v_mutual_groups
    FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = p_viewer_id
      AND gm2.user_id = p.id;

    SELECT COUNT(*)::INT INTO v_mutual_challenges
    FROM public.challenge_participants cp1
    JOIN public.challenge_participants cp2 ON cp1.challenge_id = cp2.challenge_id
    WHERE cp1.user_id = p_viewer_id
      AND cp2.user_id = p.id
      AND COALESCE(cp1.status, 'active') = 'active'
      AND COALESCE(cp2.status, 'active') = 'active';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.staff_memberships sm
    WHERE sm.user_id = p.id
      AND sm.role = 'founder'::public.staff_role
      AND sm.revoked_at IS NULL
  ) OR COALESCE(p.is_admin, false) THEN
    v_badges := v_badges || jsonb_build_array('founder');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.staff_memberships sm
    WHERE sm.user_id = p.id
      AND sm.role = 'ambassador_manager'::public.staff_role
      AND sm.revoked_at IS NULL
  ) THEN
    v_badges := v_badges || jsonb_build_array('ambassador');
  ELSE
    SELECT COUNT(*)::INT INTO v_referral_count
    FROM public.referrals r
    WHERE r.referrer_id = p.id;

    IF v_referral_count >= 5 THEN
      v_badges := v_badges || jsonb_build_array('ambassador');
    END IF;
  END IF;

  SELECT tp.verification_level::TEXT INTO v_trainer_level
  FROM public.trainer_profiles tp
  WHERE tp.user_id = p.id;

  IF v_trainer_level IN ('verified', 'featured') THEN
    v_badges := v_badges || jsonb_build_array('verified_trainer');
  END IF;

  IF COALESCE(p.is_premium, false) THEN
    v_badges := v_badges || jsonb_build_array('verified');
  END IF;

  RETURN jsonb_build_object(
    'profile', public.profile_for_viewer(p, p_viewer_id),
    'mutual_followers', v_mutual_followers,
    'mutual_training_partners', v_mutual_partners,
    'mutual_groups', v_mutual_groups,
    'mutual_challenges', v_mutual_challenges,
    'badges', v_badges
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.search_discover_profiles(
  p_query TEXT DEFAULT '',
  p_viewer_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_filters JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query TEXT := btrim(COALESCE(p_query, ''));
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 40);
  v_offset INT := GREATEST(COALESCE(p_offset, 0), 0);
  v_viewer public.profiles%ROWTYPE;
  v_has_query BOOLEAN := length(v_query) >= 2;
  v_nearby BOOLEAN := COALESCE((p_filters->>'nearby')::boolean, false);
  v_same_goals BOOLEAN := COALESCE((p_filters->>'sameGoals')::boolean, false);
  v_same_interests BOOLEAN := COALESCE((p_filters->>'sameInterests')::boolean, false);
  v_training_partners BOOLEAN := COALESCE((p_filters->>'trainingPartners')::boolean, false);
  v_trainers BOOLEAN := COALESCE((p_filters->>'trainers')::boolean, false);
  v_new_members BOOLEAN := COALESCE((p_filters->>'newMembers')::boolean, false);
  v_popular BOOLEAN := COALESCE((p_filters->>'popular')::boolean, false);
  v_has_filters BOOLEAN;
  v_total INT;
  v_items JSONB;
  v_started_at TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_viewer_id IS NOT NULL THEN
    SELECT * INTO v_viewer FROM public.profiles WHERE id = p_viewer_id;
  END IF;

  v_has_filters := v_nearby OR v_same_goals OR v_same_interests OR v_training_partners
    OR v_trainers OR v_new_members OR v_popular;

  IF NOT v_has_query AND NOT v_has_filters THEN
    RETURN jsonb_build_object('items', '[]'::jsonb, 'total', 0, 'has_more', false, 'duration_ms', 0);
  END IF;

  IF v_has_query THEN
    PERFORM public.record_discover_search_terms(v_query);
  END IF;

  WITH base AS (
    SELECT
      p.*,
      COALESCE(fc.follower_count, 0) AS follower_count
    FROM public.profiles p
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INT AS follower_count
      FROM public.follows f
      WHERE f.following_id = p.id
    ) fc ON true
    WHERE p.onboarding_complete = true
      AND p.visibility = 'public'
      AND NOT COALESCE(p.is_banned, false)
      AND (p_viewer_id IS NULL OR p.id != p_viewer_id)
      AND (p_viewer_id IS NULL OR NOT public.users_are_blocked(p_viewer_id, p.id))
      AND (
        NOT v_has_query
        OR p.display_name ILIKE '%' || v_query || '%'
        OR p.username ILIKE '%' || v_query || '%'
        OR COALESCE(p.bio, '') ILIKE '%' || v_query || '%'
        OR COALESCE(p.city, '') ILIKE '%' || v_query || '%'
        OR COALESCE(p.home_gym, '') ILIKE '%' || v_query || '%'
        OR COALESCE(p.match_preference::text, '') ILIKE '%' || v_query || '%'
        OR COALESCE(p.training_environment::text, '') ILIKE '%' || v_query || '%'
        OR EXISTS (
          SELECT 1 FROM unnest(COALESCE(p.activities, '{}')) AS activity
          WHERE activity ILIKE '%' || v_query || '%'
            OR replace(activity, '_', ' ') ILIKE '%' || v_query || '%'
        )
        OR EXISTS (
          SELECT 1 FROM unnest(COALESCE(p.fitness_goals, '{}')) AS goal
          WHERE goal ILIKE '%' || v_query || '%'
            OR replace(goal, '_', ' ') ILIKE '%' || v_query || '%'
        )
      )
      AND (NOT v_nearby OR (
        v_viewer.id IS NOT NULL AND (
          (v_viewer.city IS NOT NULL AND p.city IS NOT NULL AND lower(p.city) = lower(v_viewer.city))
          OR (v_viewer.latitude IS NOT NULL AND v_viewer.longitude IS NOT NULL
              AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
              AND public.haversine_miles(v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude)
                  <= COALESCE(v_viewer.discovery_radius_miles, 25))
        )
      ))
      AND (NOT v_same_goals OR (
        v_viewer.id IS NOT NULL
        AND COALESCE(p.fitness_goals, '{}') && COALESCE(v_viewer.fitness_goals, '{}')
      ))
      AND (NOT v_same_interests OR (
        v_viewer.id IS NOT NULL
        AND COALESCE(p.activities, '{}') && COALESCE(v_viewer.activities, '{}')
      ))
      AND (NOT v_training_partners OR COALESCE(p.matching_enabled, false) = true)
      AND (NOT v_trainers OR COALESCE(p.is_trainer, false) = true)
      AND (NOT v_new_members OR p.created_at >= now() - interval '14 days')
  ),
  counted AS (
    SELECT COUNT(*)::INT AS total FROM base
  ),
  page AS (
    SELECT b.*
    FROM base b
    ORDER BY
      CASE WHEN v_popular THEN -b.follower_count ELSE 0 END,
      CASE WHEN v_has_query AND b.username ILIKE v_query || '%' THEN 0
           WHEN v_has_query AND b.display_name ILIKE v_query || '%' THEN 1
           ELSE 2 END,
      b.display_name
    LIMIT v_limit
    OFFSET v_offset
  )
  SELECT
    (SELECT total FROM counted),
    COALESCE(
      (SELECT jsonb_agg(public.discover_profile_item(p, p_viewer_id) ORDER BY p.display_name)
       FROM page p),
      '[]'::jsonb
    )
  INTO v_total, v_items;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', COALESCE(v_total, 0),
    'has_more', (v_offset + v_limit) < COALESCE(v_total, 0),
    'duration_ms', GREATEST(0, (EXTRACT(EPOCH FROM (clock_timestamp() - v_started_at)) * 1000)::INT)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_discover_suggested_sections(p_viewer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_training JSONB;
  v_nearby JSONB;
  v_new_members JSONB;
  v_similar_goals JSONB;
  v_popular JSONB;
BEGIN
  SELECT COALESCE(payload->'items', '[]'::jsonb) INTO v_training
  FROM (
    SELECT public.search_discover_profiles('', p_viewer_id, 6, 0, '{"trainingPartners": true}'::jsonb) AS payload
  ) q;

  SELECT COALESCE(payload->'items', '[]'::jsonb) INTO v_nearby
  FROM (
    SELECT public.search_discover_profiles('', p_viewer_id, 6, 0, '{"nearby": true}'::jsonb) AS payload
  ) q;

  SELECT COALESCE(payload->'items', '[]'::jsonb) INTO v_new_members
  FROM (
    SELECT public.search_discover_profiles('', p_viewer_id, 6, 0, '{"newMembers": true}'::jsonb) AS payload
  ) q;

  SELECT COALESCE(payload->'items', '[]'::jsonb) INTO v_similar_goals
  FROM (
    SELECT public.search_discover_profiles('', p_viewer_id, 6, 0, '{"sameGoals": true}'::jsonb) AS payload
  ) q;

  SELECT COALESCE(payload->'items', '[]'::jsonb) INTO v_popular
  FROM (
    SELECT public.search_discover_profiles('', p_viewer_id, 6, 0, '{"popular": true}'::jsonb) AS payload
  ) q;

  RETURN jsonb_build_object(
    'training_partners', v_training,
    'nearby', v_nearby,
    'new_members', v_new_members,
    'similar_goals', v_similar_goals,
    'popular', v_popular
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_discover_search_terms(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.discover_profile_item(public.profiles, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discover_suggested_sections(UUID) TO authenticated;

COMMENT ON TABLE public.discover_search_term_stats IS
  'Anonymous aggregated discover search term counts for interests, goals, and locations.';
COMMENT ON FUNCTION public.get_discover_suggested_sections IS
  'Suggested discover people sections when the search box is empty.';
