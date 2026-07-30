-- Per-viewer suggestion dismissals for People You May Know.

CREATE TABLE IF NOT EXISTS public.suggestion_dismissals (
  viewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dismissed_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (viewer_id, dismissed_id),
  CONSTRAINT suggestion_dismissals_not_self CHECK (viewer_id <> dismissed_id)
);

CREATE INDEX IF NOT EXISTS idx_suggestion_dismissals_viewer
  ON public.suggestion_dismissals (viewer_id, dismissed_at DESC);

ALTER TABLE public.suggestion_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own suggestion dismissals"
  ON public.suggestion_dismissals
  FOR SELECT
  USING (viewer_id = auth.uid());

CREATE POLICY "Dismiss suggestions for self"
  ON public.suggestion_dismissals
  FOR INSERT
  WITH CHECK (viewer_id = auth.uid() AND dismissed_id <> auth.uid());

CREATE POLICY "Undo suggestion dismissals for self"
  ON public.suggestion_dismissals
  FOR DELETE
  USING (viewer_id = auth.uid());

COMMENT ON TABLE public.suggestion_dismissals IS
  'People You May Know dismissals. Dismissed profiles stay excluded from future suggestion queries.';

-- Exclude dismissed profiles from server-side People You May Know RPC.
CREATE OR REPLACE FUNCTION public.get_people_you_may_know(
  p_viewer_id UUID,
  p_limit INT DEFAULT 12
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 12), 1), 30);
  v_viewer public.profiles%ROWTYPE;
  v_items JSONB;
BEGIN
  SELECT * INTO v_viewer FROM public.profiles WHERE id = p_viewer_id;
  IF NOT FOUND THEN RETURN '[]'::jsonb; END IF;

  WITH excluded AS (
    SELECT p_viewer_id AS id
    UNION SELECT following_id FROM public.follows WHERE follower_id = p_viewer_id
    UNION SELECT CASE WHEN user_a = p_viewer_id THEN user_b ELSE user_a END
      FROM public.friendships WHERE user_a = p_viewer_id OR user_b = p_viewer_id
    UNION SELECT blocked_id FROM public.blocks WHERE blocker_id = p_viewer_id
    UNION SELECT blocker_id FROM public.blocks WHERE blocked_id = p_viewer_id
    UNION SELECT dismissed_id FROM public.suggestion_dismissals WHERE viewer_id = p_viewer_id
  ),
  candidates AS (
    SELECT p.*,
      public.count_mutual_friends(p_viewer_id, p.id) AS mutual_friends,
      (
        SELECT COUNT(DISTINCT shared.partner_id)::INT
        FROM (
          SELECT CASE WHEN m.user_a = p_viewer_id THEN m.user_b ELSE m.user_a END AS partner_id
          FROM public.matches m WHERE m.status = 'matched'
            AND (m.user_a = p_viewer_id OR m.user_b = p_viewer_id)
          INTERSECT
          SELECT CASE WHEN m.user_a = p.id THEN m.user_b ELSE m.user_a END
          FROM public.matches m WHERE m.status = 'matched'
            AND (m.user_a = p.id OR m.user_b = p.id)
        ) shared
      ) AS mutual_partners,
      cardinality(
        ARRAY(
          SELECT unnest(COALESCE(v_viewer.activities, '{}'))
          INTERSECT SELECT unnest(COALESCE(p.activities, '{}'))
        )
      ) AS shared_interest_count,
      cardinality(
        ARRAY(
          SELECT unnest(COALESCE(v_viewer.fitness_goals, '{}'))
          INTERSECT SELECT unnest(COALESCE(p.fitness_goals, '{}'))
        )
      ) AS shared_goal_count,
      (
        SELECT COUNT(*)::INT FROM public.group_members gm1
        JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
        WHERE gm1.user_id = p_viewer_id AND gm2.user_id = p.id
      ) AS shared_groups,
      (
        SELECT COUNT(*)::INT FROM public.challenge_participants cp1
        JOIN public.challenge_participants cp2 ON cp1.challenge_id = cp2.challenge_id
        WHERE cp1.user_id = p_viewer_id AND cp2.user_id = p.id
      ) AS shared_challenges,
      CASE
        WHEN v_viewer.city IS NOT NULL AND p.city IS NOT NULL
          AND lower(p.city) = lower(v_viewer.city) THEN 1
        WHEN v_viewer.latitude IS NOT NULL AND v_viewer.longitude IS NOT NULL
          AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
          AND public.haversine_miles(v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude)
            <= COALESCE(v_viewer.discovery_radius_miles, 25) THEN 1
        ELSE 0
      END AS is_nearby
    FROM public.profiles p
    WHERE p.onboarding_complete = true
      AND p.visibility = 'public'
      AND NOT COALESCE(p.is_banned, false)
      AND p.id NOT IN (SELECT id FROM excluded)
  ),
  scored AS (
    SELECT *,
      (mutual_friends * 8 + mutual_partners * 6 + shared_interest_count * 4
        + shared_goal_count * 4 + shared_groups * 3 + shared_challenges * 3 + is_nearby * 5) AS score
    FROM candidates
    WHERE (mutual_friends + mutual_partners + shared_interest_count + shared_goal_count
      + shared_groups + shared_challenges + is_nearby) > 0
  ),
  top AS (SELECT * FROM scored ORDER BY score DESC, display_name LIMIT v_limit)
  SELECT COALESCE(
    jsonb_agg(public.discover_profile_item(t, p_viewer_id) ORDER BY t.score DESC),
    '[]'::jsonb
  ) INTO v_items
  FROM top t;

  RETURN v_items;
END;
$$;
