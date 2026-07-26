-- Challenges & Accountability: types, check-ins, leaderboards, hub RPCs, notifications.

DO $$ BEGIN
  CREATE TYPE public.challenge_type AS ENUM (
    'running', 'walking', 'cycling', 'strength', 'weight_loss', 'steps', 'workout_streak', 'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS challenge_type public.challenge_type NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS city TEXT;

CREATE INDEX IF NOT EXISTS idx_challenges_public_active
  ON public.challenges (is_public, end_date DESC)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_challenges_featured
  ON public.challenges (is_featured, end_date DESC)
  WHERE is_featured = true;

CREATE TABLE IF NOT EXISTS public.challenge_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL DEFAULT (timezone('utc', now()))::date,
  value NUMERIC,
  note TEXT,
  post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id, check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_challenge_check_ins_challenge
  ON public.challenge_check_ins (challenge_id, check_in_date DESC);

CREATE INDEX IF NOT EXISTS idx_challenge_check_ins_user
  ON public.challenge_check_ins (user_id, created_at DESC);

ALTER TABLE public.challenge_check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View challenge check-ins" ON public.challenge_check_ins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.challenge_participants cp
      WHERE cp.challenge_id = challenge_check_ins.challenge_id
        AND cp.user_id = auth.uid()
        AND cp.status = 'active'
    )
    OR EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = challenge_check_ins.challenge_id AND c.is_public = true
    )
  );

CREATE POLICY "Insert own challenge check-ins" ON public.challenge_check_ins
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.challenge_participants cp
      JOIN public.challenges c ON c.id = cp.challenge_id
      WHERE cp.challenge_id = challenge_check_ins.challenge_id
        AND cp.user_id = auth.uid()
        AND cp.status = 'active'
        AND c.end_date > now()
    )
  );

CREATE TABLE IF NOT EXISTS public.challenge_encouragements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id != recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_encouragements_recipient
  ON public.challenge_encouragements (recipient_id, created_at DESC);

ALTER TABLE public.challenge_encouragements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants send encouragements" ON public.challenge_encouragements
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.challenge_participants cp
      WHERE cp.challenge_id = challenge_encouragements.challenge_id
        AND cp.user_id = auth.uid()
        AND cp.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM public.challenge_participants cp2
      WHERE cp2.challenge_id = challenge_encouragements.challenge_id
        AND cp2.user_id = challenge_encouragements.recipient_id
        AND cp2.status = 'active'
    )
  );

CREATE POLICY "View own encouragements" ON public.challenge_encouragements
  FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.challenge_user_badges (
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL CHECK (badge_key IN (
    'completed', 'first_place', 'top_10', 'streak_champion', 'consistency'
  )),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id, badge_key)
);

ALTER TABLE public.challenge_user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View challenge badges" ON public.challenge_user_badges
  FOR SELECT USING (true);

-- Safe concurrent join
CREATE OR REPLACE FUNCTION public.join_challenge_safe(p_challenge_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = p_challenge_id AND c.end_date > now()
  ) THEN
    RAISE EXCEPTION 'Challenge is not open';
  END IF;

  INSERT INTO public.challenge_participants (challenge_id, user_id, status)
  VALUES (p_challenge_id, p_user_id, 'active')
  ON CONFLICT (challenge_id, user_id) DO UPDATE
    SET status = 'active'
    WHERE public.challenge_participants.status != 'active';

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_challenge_safe(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_challenge_leaderboard(
  p_challenge_id UUID,
  p_viewer_id UUID DEFAULT auth.uid(),
  p_scope TEXT DEFAULT 'overall',
  p_limit INT DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items JSONB;
  v_viewer_rank INT;
BEGIN
  WITH friend_ids AS (
    SELECT f.following_id AS user_id
    FROM public.follows f
    WHERE f.follower_id = p_viewer_id
    UNION
    SELECT f.follower_id
    FROM public.follows f
    WHERE f.following_id = p_viewer_id
  ),
  scores AS (
    SELECT
      cp.user_id,
      COUNT(ci.id)::INT AS check_in_count,
      COALESCE(SUM(ci.value), 0)::NUMERIC AS total_value,
      COUNT(ci.id) FILTER (
        WHERE ci.check_in_date >= (timezone('utc', now()))::date - 6
      )::INT AS weekly_count,
      COUNT(ci.id) FILTER (
        WHERE ci.check_in_date = (timezone('utc', now()))::date
      )::INT AS daily_count,
      GREATEST(
        COUNT(ci.id),
        COALESCE(SUM(ci.value), 0)
      )::NUMERIC AS score
    FROM public.challenge_participants cp
    LEFT JOIN public.challenge_check_ins ci
      ON ci.challenge_id = cp.challenge_id AND ci.user_id = cp.user_id
      AND (
        p_scope = 'overall'
        OR (p_scope = 'weekly' AND ci.check_in_date >= (timezone('utc', now()))::date - 6)
        OR (p_scope = 'daily' AND ci.check_in_date = (timezone('utc', now()))::date)
      )
    WHERE cp.challenge_id = p_challenge_id
      AND cp.status = 'active'
      AND (
        p_scope != 'friends'
        OR cp.user_id IN (SELECT user_id FROM friend_ids)
        OR cp.user_id = p_viewer_id
      )
    GROUP BY cp.user_id
  ),
  ranked AS (
    SELECT
      s.*,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN p_scope = 'daily' THEN s.daily_count ELSE 0 END DESC,
          CASE WHEN p_scope = 'weekly' THEN s.weekly_count ELSE 0 END DESC,
          s.score DESC,
          s.check_in_count DESC
      )::INT AS rank
    FROM scores s
  ),
  limited AS (
    SELECT * FROM ranked
    ORDER BY rank
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  )
  SELECT
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'rank', r.rank,
          'user_id', r.user_id,
          'profile', public.profile_for_viewer(p, p_viewer_id),
          'check_in_count', r.check_in_count,
          'weekly_count', r.weekly_count,
          'daily_count', r.daily_count,
          'score', r.score,
          'badges', COALESCE((
            SELECT jsonb_agg(cub.badge_key ORDER BY cub.earned_at)
            FROM public.challenge_user_badges cub
            WHERE cub.challenge_id = p_challenge_id AND cub.user_id = r.user_id
          ), '[]'::jsonb)
        ) ORDER BY r.rank
      )
      FROM limited r
      JOIN public.profiles p ON p.id = r.user_id
    ), '[]'::jsonb),
    (SELECT rank FROM ranked WHERE user_id = p_viewer_id)
  INTO v_items, v_viewer_rank;

  RETURN jsonb_build_object(
    'items', v_items,
    'viewer_rank', v_viewer_rank,
    'scope', p_scope,
    'updated_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_challenge_hub(p_viewer_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer public.profiles%ROWTYPE;
  v_featured JSONB;
  v_trending JSONB;
  v_friends JSONB;
  v_nearby JSONB;
  v_mine JSONB;
BEGIN
  IF p_viewer_id IS NOT NULL THEN
    SELECT * INTO v_viewer FROM public.profiles WHERE id = p_viewer_id;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.participant_count DESC), '[]'::jsonb)
  INTO v_featured
  FROM (
    SELECT c.*, (
      SELECT COUNT(*)::INT FROM public.challenge_participants cp
      WHERE cp.challenge_id = c.id AND cp.status = 'active'
    ) AS participant_count
    FROM public.challenges c
    WHERE c.is_public = true AND c.is_featured = true AND c.end_date > now()
    ORDER BY c.start_date
    LIMIT 8
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.participant_count DESC), '[]'::jsonb)
  INTO v_trending
  FROM (
    SELECT c.*, (
      SELECT COUNT(*)::INT FROM public.challenge_participants cp
      WHERE cp.challenge_id = c.id AND cp.status = 'active'
    ) AS participant_count
    FROM public.challenges c
    WHERE c.is_public = true AND c.end_date > now()
    ORDER BY participant_count DESC, c.created_at DESC
    LIMIT 12
  ) t;

  IF p_viewer_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.participant_count DESC), '[]'::jsonb)
    INTO v_friends
    FROM (
      SELECT DISTINCT ON (c.id) c.*, (
        SELECT COUNT(*)::INT FROM public.challenge_participants cp2
        WHERE cp2.challenge_id = c.id AND cp2.status = 'active'
      ) AS participant_count
      FROM public.challenges c
      JOIN public.challenge_participants cp ON cp.challenge_id = c.id AND cp.status = 'active'
      WHERE c.is_public = true AND c.end_date > now()
        AND cp.user_id IN (
          SELECT f.following_id FROM public.follows f WHERE f.follower_id = p_viewer_id
          UNION
          SELECT f.follower_id FROM public.follows f WHERE f.following_id = p_viewer_id
        )
        AND cp.user_id != p_viewer_id
      LIMIT 12
    ) t;

    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.participant_count DESC), '[]'::jsonb)
    INTO v_nearby
    FROM (
      SELECT c.*, (
        SELECT COUNT(*)::INT FROM public.challenge_participants cp
        WHERE cp.challenge_id = c.id AND cp.status = 'active'
      ) AS participant_count
      FROM public.challenges c
      WHERE c.is_public = true AND c.end_date > now()
        AND v_viewer.city IS NOT NULL AND c.city IS NOT NULL
        AND lower(c.city) = lower(v_viewer.city)
      ORDER BY participant_count DESC
      LIMIT 12
    ) t;

    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.end_date), '[]'::jsonb)
    INTO v_mine
    FROM (
      SELECT c.*, cp.status AS my_status, (
        SELECT COUNT(*)::INT FROM public.challenge_participants cp2
        WHERE cp2.challenge_id = c.id AND cp2.status = 'active'
      ) AS participant_count,
      (
        SELECT COUNT(*)::INT FROM public.challenge_check_ins ci
        WHERE ci.challenge_id = c.id AND ci.user_id = p_viewer_id
      ) AS my_check_ins
      FROM public.challenges c
      JOIN public.challenge_participants cp ON cp.challenge_id = c.id
      WHERE cp.user_id = p_viewer_id AND cp.status = 'active' AND c.end_date > now()
      LIMIT 20
    ) t;
  ELSE
    v_friends := '[]'::jsonb;
    v_nearby := '[]'::jsonb;
    v_mine := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'featured', v_featured,
    'trending', v_trending,
    'friends', v_friends,
    'nearby', v_nearby,
    'mine', v_mine
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_challenge_check_in(
  p_challenge_id UUID,
  p_note TEXT DEFAULT NULL,
  p_value NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_check_in public.challenge_check_ins%ROWTYPE;
  v_total_days INT;
  v_my_check_ins INT;
  v_challenge public.challenges%ROWTYPE;
  v_prev_leader UUID;
  v_new_leader UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id;
  IF NOT FOUND OR v_challenge.end_date <= now() THEN
    RAISE EXCEPTION 'Challenge is not active';
  END IF;

  INSERT INTO public.challenge_check_ins (challenge_id, user_id, note, value)
  VALUES (p_challenge_id, v_user_id, NULLIF(btrim(p_note), ''), p_value)
  ON CONFLICT (challenge_id, user_id, check_in_date) DO UPDATE
    SET note = COALESCE(EXCLUDED.note, challenge_check_ins.note),
        value = COALESCE(EXCLUDED.value, challenge_check_ins.value)
  RETURNING * INTO v_check_in;

  SELECT GREATEST(1, (v_challenge.end_date::date - v_challenge.start_date::date + 1))::INT
  INTO v_total_days;

  SELECT COUNT(*)::INT INTO v_my_check_ins
  FROM public.challenge_check_ins
  WHERE challenge_id = p_challenge_id AND user_id = v_user_id;

  -- Progress notification to creator on milestones
  IF v_my_check_ins IN (1, 7, 14, 30) OR v_my_check_ins = v_total_days THEN
    PERFORM public.create_notification(
      v_challenge.created_by,
      'challenge_progress',
      jsonb_build_object(
        'challenge_id', p_challenge_id,
        'challenge_title', v_challenge.title,
        'check_in_count', v_my_check_ins,
        'user_id', v_user_id
      ),
      v_user_id,
      'challenge',
      p_challenge_id
    );
  END IF;

  -- Award consistency badge at 7 check-ins
  IF v_my_check_ins >= 7 THEN
    INSERT INTO public.challenge_user_badges (challenge_id, user_id, badge_key)
    VALUES (p_challenge_id, v_user_id, 'consistency')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'check_in', row_to_json(v_check_in),
    'my_check_ins', v_my_check_ins,
    'total_days', v_total_days,
    'progress_pct', LEAST(100, ROUND((v_my_check_ins::NUMERIC / v_total_days) * 100))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_challenge_hub(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_challenge_leaderboard(UUID, UUID, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_challenge_check_in(UUID, TEXT, NUMERIC) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_challenge_encouragement(
  p_challenge_id UUID,
  p_recipient_id UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID := auth.uid();
  v_challenge public.challenges%ROWTYPE;
BEGIN
  IF v_sender_id IS NULL OR v_sender_id = p_recipient_id THEN
    RAISE EXCEPTION 'Invalid encouragement';
  END IF;

  SELECT * INTO v_challenge FROM public.challenges WHERE id = p_challenge_id;

  INSERT INTO public.challenge_encouragements (challenge_id, sender_id, recipient_id, message)
  VALUES (p_challenge_id, v_sender_id, p_recipient_id, NULLIF(btrim(p_message), ''));

  PERFORM public.create_notification(
    p_recipient_id,
    'challenge_progress',
    jsonb_build_object(
      'challenge_id', p_challenge_id,
      'challenge_title', v_challenge.title,
      'encouragement', true,
      'message', COALESCE(NULLIF(btrim(p_message), ''), 'Keep going — you''ve got this!')
    ),
    v_sender_id,
    'challenge',
    p_challenge_id
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_challenge_encouragement(UUID, UUID, TEXT) TO authenticated;

INSERT INTO public.achievement_definitions (key, label, emoji, description, category, sort_order)
VALUES
  ('challenge_first_place', 'First place', '🥇', 'Finished first in a challenge', 'challenge', 131),
  ('challenge_top_10', 'Top 10', '🔟', 'Finished in the top 10 of a challenge', 'challenge', 132),
  ('challenge_streak_champion', 'Streak champion', '🔥', 'Longest check-in streak in a challenge', 'challenge', 133),
  ('challenge_consistency', 'Consistency badge', '✅', 'Checked in 7+ days in a challenge', 'challenge', 134)
ON CONFLICT (key) DO NOTHING;
