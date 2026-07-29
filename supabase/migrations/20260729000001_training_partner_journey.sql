-- Training Partner Journey: partnership metadata, milestones, per-user intro, and journey RPCs.

CREATE TABLE IF NOT EXISTS public.training_partnerships (
  match_id UUID PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  engagement_points INT NOT NULL DEFAULT 0 CHECK (engagement_points >= 0),
  level_id TEXT NOT NULL DEFAULT 'new_partners'
    CHECK (level_id IN (
      'new_partners',
      'consistent_partners',
      'dedicated_partners',
      'elite_partners',
      'legendary_partners'
    )),
  match_score_at_start INT CHECK (match_score_at_start IS NULL OR (match_score_at_start >= 0 AND match_score_at_start <= 100)),
  match_score_current INT CHECK (match_score_current IS NULL OR (match_score_current >= 0 AND match_score_current <= 100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.training_partnership_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.training_partnerships(match_id) ON DELETE CASCADE,
  milestone_code TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (match_id, milestone_code)
);

CREATE TABLE IF NOT EXISTS public.training_partnership_intro_views (
  match_id UUID NOT NULL REFERENCES public.training_partnerships(match_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_training_partnership_milestones_match
  ON public.training_partnership_milestones(match_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_training_partnership_intro_views_user
  ON public.training_partnership_intro_views(user_id, completed_at DESC);

ALTER TABLE public.training_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_partnership_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_partnership_intro_views ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_access_match(p_match_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = p_match_id
      AND m.status = 'matched'
      AND (m.user_a = p_user_id OR m.user_b = p_user_id)
      AND NOT public.users_are_blocked(
        p_user_id,
        CASE WHEN m.user_a = p_user_id THEN m.user_b ELSE m.user_a END
      )
  );
$$;

CREATE POLICY "Users read own training partnerships"
  ON public.training_partnerships
  FOR SELECT
  USING (public.user_can_access_match(match_id, auth.uid()));

CREATE POLICY "Users read own partnership milestones"
  ON public.training_partnership_milestones
  FOR SELECT
  USING (public.user_can_access_match(match_id, auth.uid()));

CREATE POLICY "Users read own partnership intro views"
  ON public.training_partnership_intro_views
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND public.user_can_access_match(match_id, auth.uid())
  );

CREATE OR REPLACE FUNCTION public.partnership_milestone_location_label(p_match_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_a public.profiles%ROWTYPE;
  v_b public.profiles%ROWTYPE;
  v_label_a TEXT;
  v_label_b TEXT;
BEGIN
  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_a FROM public.profiles WHERE id = v_match.user_a;
  SELECT * INTO v_b FROM public.profiles WHERE id = v_match.user_b;

  IF NOT COALESCE(v_a.use_location_for_matching, false)
     OR NOT COALESCE(v_b.use_location_for_matching, false)
     OR NOT COALESCE(v_a.show_city_state, false)
     OR NOT COALESCE(v_b.show_city_state, false) THEN
    RETURN NULL;
  END IF;

  v_label_a := NULLIF(TRIM(CONCAT_WS(', ', NULLIF(TRIM(v_a.city), ''), NULLIF(TRIM(v_a.state), ''))), '');
  v_label_b := NULLIF(TRIM(CONCAT_WS(', ', NULLIF(TRIM(v_b.city), ''), NULLIF(TRIM(v_b.state), ''))), '');

  IF v_label_a IS NULL AND v_label_b IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_label_a IS NOT NULL AND v_label_a = v_label_b THEN
    RETURN v_label_a;
  END IF;

  IF v_label_a IS NOT NULL AND v_label_b IS NOT NULL THEN
    RETURN v_label_a || ' & ' || v_label_b;
  END IF;

  RETURN COALESCE(v_label_a, v_label_b);
END;
$$;

CREATE OR REPLACE FUNCTION public.partnership_message_is_real(p_message public.messages)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_message.deleted_for_everyone_at IS NULL
    AND (
      NULLIF(TRIM(p_message.content), '') IS NOT NULL
      OR NULLIF(TRIM(p_message.media_url), '') IS NOT NULL
      OR p_message.post_id IS NOT NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.partnership_has_bidirectional_conversation(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_conv_id UUID;
BEGIN
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
    AND status = 'matched';

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_conv_id := public.get_dm_conversation(v_match.user_a, v_match.user_b);
  IF v_conv_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.conversation_id = v_conv_id
      AND m.sender_id = v_match.user_a
      AND public.partnership_message_is_real(m)
  )
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.conversation_id = v_conv_id
      AND m.sender_id = v_match.user_b
      AND public.partnership_message_is_real(m)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_partnership_milestone_eligibility(
  p_match_id UUID,
  p_milestone_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE p_milestone_code
    WHEN 'partnership_started' THEN
      RETURN EXISTS (
        SELECT 1
        FROM public.matches m
        WHERE m.id = p_match_id
          AND m.status = 'matched'
      );
    WHEN 'first_conversation' THEN
      RETURN public.partnership_has_bidirectional_conversation(p_match_id);
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_training_partnership_engagement(p_match_id UUID)
RETURNS public.training_partnerships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points INT := 0;
  v_level_id TEXT := 'new_partners';
  v_partnership public.training_partnerships%ROWTYPE;
  v_code TEXT;
BEGIN
  FOR v_code IN
    SELECT milestone_code
    FROM public.training_partnership_milestones
    WHERE match_id = p_match_id
  LOOP
    v_points := v_points + CASE v_code
      WHEN 'partnership_started' THEN 10
      WHEN 'first_conversation' THEN 15
      WHEN 'first_workout_together' THEN 25
      WHEN 'first_shared_streak_7' THEN 30
      WHEN 'first_event_together' THEN 20
      WHEN 'first_challenge_together' THEN 25
      WHEN 'workouts_together_10' THEN 40
      WHEN 'encouragements_100' THEN 35
      WHEN 'partnership_30_days' THEN 30
      WHEN 'match_score_improved' THEN 20
      WHEN 'top_training_partners' THEN 50
      ELSE 0
    END;
  END LOOP;

  v_level_id := CASE
    WHEN v_points >= 700 THEN 'legendary_partners'
    WHEN v_points >= 350 THEN 'elite_partners'
    WHEN v_points >= 150 THEN 'dedicated_partners'
    WHEN v_points >= 50 THEN 'consistent_partners'
    ELSE 'new_partners'
  END;

  UPDATE public.training_partnerships
  SET engagement_points = v_points,
      level_id = v_level_id,
      updated_at = now()
  WHERE match_id = p_match_id
  RETURNING * INTO v_partnership;

  RETURN v_partnership;
END;
$$;

CREATE OR REPLACE FUNCTION public.internal_award_partnership_milestone(
  p_match_id UUID,
  p_milestone_code TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS public.training_partnership_milestones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.training_partnership_milestones%ROWTYPE;
  v_metadata JSONB := COALESCE(p_metadata, '{}'::jsonb);
  v_location_label TEXT;
BEGIN
  IF NOT public.validate_partnership_milestone_eligibility(p_match_id, p_milestone_code) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.training_partnerships (match_id)
  VALUES (p_match_id)
  ON CONFLICT (match_id) DO NOTHING;

  v_location_label := public.partnership_milestone_location_label(p_match_id);
  IF v_location_label IS NOT NULL AND NOT (v_metadata ? 'location_label') THEN
    v_metadata := v_metadata || jsonb_build_object('location_label', v_location_label);
  END IF;

  IF NOT (v_metadata ? 'links') THEN
    v_metadata := v_metadata || jsonb_build_object(
      'links',
      jsonb_build_object(
        'workout_id', NULL,
        'challenge_id', NULL,
        'event_id', NULL,
        'photo_url', NULL
      )
    );
  END IF;

  INSERT INTO public.training_partnership_milestones (match_id, milestone_code, metadata)
  VALUES (p_match_id, p_milestone_code, v_metadata)
  ON CONFLICT (match_id, milestone_code) DO NOTHING
  RETURNING * INTO v_row;

  IF FOUND THEN
    PERFORM public.recalculate_training_partnership_engagement(p_match_id);
  ELSE
    SELECT * INTO v_row
    FROM public.training_partnership_milestones
    WHERE match_id = p_match_id
      AND milestone_code = p_milestone_code;
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_training_partnership_milestones(p_match_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.partnership_has_bidirectional_conversation(p_match_id) THEN
    PERFORM public.internal_award_partnership_milestone(
      p_match_id,
      'first_conversation',
      jsonb_build_object('trigger_source', 'conversation_sync')
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_training_partnership_on_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'matched' THEN
    INSERT INTO public.training_partnerships (match_id)
    VALUES (NEW.id)
    ON CONFLICT (match_id) DO NOTHING;

    PERFORM public.internal_award_partnership_milestone(
      NEW.id,
      'partnership_started',
      jsonb_build_object('trigger_source', 'match_created')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_training_partnership_on_match ON public.matches;
CREATE TRIGGER trg_ensure_training_partnership_on_match
  AFTER INSERT OR UPDATE OF status ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_training_partnership_on_match();

CREATE OR REPLACE FUNCTION public.get_or_create_training_partnership(
  p_match_id UUID,
  p_match_score_at_start INT DEFAULT NULL
)
RETURNS public.training_partnerships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_partnership public.training_partnerships%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_match(p_match_id, v_user_id) THEN
    RAISE EXCEPTION 'Not authorized for this training match';
  END IF;

  INSERT INTO public.training_partnerships (match_id, match_score_at_start, match_score_current)
  VALUES (p_match_id, p_match_score_at_start, p_match_score_at_start)
  ON CONFLICT (match_id) DO UPDATE
  SET match_score_at_start = COALESCE(public.training_partnerships.match_score_at_start, EXCLUDED.match_score_at_start),
      match_score_current = COALESCE(public.training_partnerships.match_score_current, EXCLUDED.match_score_at_start),
      updated_at = now()
  RETURNING * INTO v_partnership;

  PERFORM public.internal_award_partnership_milestone(
    p_match_id,
    'partnership_started',
    jsonb_build_object('trigger_source', 'partnership_bootstrap')
  );

  RETURN public.recalculate_training_partnership_engagement(p_match_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_training_partnership_intro(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_access_match(p_match_id, v_user_id) THEN
    RAISE EXCEPTION 'Not authorized for this training match';
  END IF;

  INSERT INTO public.training_partnerships (match_id)
  VALUES (p_match_id)
  ON CONFLICT (match_id) DO NOTHING;

  INSERT INTO public.training_partnership_intro_views (match_id, user_id)
  VALUES (p_match_id, v_user_id)
  ON CONFLICT (match_id, user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'match_id', p_match_id,
    'user_id', v_user_id,
    'intro_completed', TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_training_partner_journey_route(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_match public.matches%ROWTYPE;
  v_partner_id UUID;
  v_intro_done BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'accessible', FALSE,
      'fallback_href', '/matching/matches',
      'message', 'Sign in to view your training partner journey.'
    );
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'accessible', FALSE,
      'fallback_href', '/matching/matches',
      'message', 'This training match is no longer available.'
    );
  END IF;

  IF v_match.status != 'matched' THEN
    RETURN jsonb_build_object(
      'accessible', FALSE,
      'fallback_href', '/matching/matches',
      'message', 'This training partnership is no longer active.'
    );
  END IF;

  IF v_match.user_a != v_user_id AND v_match.user_b != v_user_id THEN
    RETURN jsonb_build_object(
      'accessible', FALSE,
      'fallback_href', '/matching/matches',
      'message', 'You do not have access to this journey.'
    );
  END IF;

  v_partner_id := CASE WHEN v_match.user_a = v_user_id THEN v_match.user_b ELSE v_match.user_a END;

  IF public.users_are_blocked(v_user_id, v_partner_id) THEN
    RETURN jsonb_build_object(
      'accessible', FALSE,
      'fallback_href', '/matching/matches',
      'message', 'This training partnership is unavailable.'
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.training_partnership_intro_views
    WHERE match_id = p_match_id
      AND user_id = v_user_id
  ) INTO v_intro_done;

  IF v_intro_done THEN
    RETURN jsonb_build_object(
      'accessible', TRUE,
      'route', 'timeline',
      'href', '/matching/journey/' || p_match_id::text
    );
  END IF;

  RETURN jsonb_build_object(
    'accessible', TRUE,
    'route', 'intro',
    'href', '/matching/journey/' || p_match_id::text || '/intro'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_training_partnership_journey(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_match public.matches%ROWTYPE;
  v_partner_id UUID;
  v_partnership public.training_partnerships%ROWTYPE;
  v_milestones JSONB;
  v_intro_completed BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF NOT FOUND OR v_match.status != 'matched' THEN
    RAISE EXCEPTION 'Training match not found';
  END IF;

  IF v_match.user_a != v_user_id AND v_match.user_b != v_user_id THEN
    RAISE EXCEPTION 'Not authorized for this training match';
  END IF;

  v_partner_id := CASE WHEN v_match.user_a = v_user_id THEN v_match.user_b ELSE v_match.user_a END;

  IF public.users_are_blocked(v_user_id, v_partner_id) THEN
    RAISE EXCEPTION 'Training partnership unavailable';
  END IF;

  SELECT * INTO v_partnership
  FROM public.training_partnerships
  WHERE match_id = p_match_id;

  IF NOT FOUND THEN
    v_partnership := public.get_or_create_training_partnership(p_match_id, NULL);
  END IF;

  PERFORM public.sync_training_partnership_milestones(p_match_id);

  SELECT * INTO v_partnership
  FROM public.training_partnerships
  WHERE match_id = p_match_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'match_id', m.match_id,
      'milestone_code', m.milestone_code,
      'occurred_at', m.occurred_at,
      'metadata', m.metadata
    )
    ORDER BY m.occurred_at ASC
  ), '[]'::jsonb)
  INTO v_milestones
  FROM public.training_partnership_milestones m
  WHERE m.match_id = p_match_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.training_partnership_intro_views
    WHERE match_id = p_match_id
      AND user_id = v_user_id
  ) INTO v_intro_completed;

  RETURN jsonb_build_object(
    'partnership', to_jsonb(v_partnership),
    'milestones', v_milestones,
    'partner_id', v_partner_id,
    'intro_completed', v_intro_completed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.user_can_access_match(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partnership_milestone_location_label(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partnership_message_is_real(public.messages) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.partnership_has_bidirectional_conversation(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_partnership_milestone_eligibility(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_training_partnership_engagement(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.internal_award_partnership_milestone(UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_training_partnership_milestones(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_training_partnership_on_match() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_training_partnership(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_training_partnership_intro(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_training_partner_journey_route(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_training_partnership_journey(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_or_create_training_partnership(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_training_partnership_intro(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_training_partner_journey_route(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_training_partnership_journey(UUID) TO authenticated;

-- Backfill partnerships for existing active matches.
INSERT INTO public.training_partnerships (match_id)
SELECT m.id
FROM public.matches m
WHERE m.status = 'matched'
ON CONFLICT (match_id) DO NOTHING;

INSERT INTO public.training_partnership_milestones (match_id, milestone_code, metadata)
SELECT m.id, 'partnership_started', jsonb_build_object('trigger_source', 'backfill')
FROM public.matches m
WHERE m.status = 'matched'
ON CONFLICT (match_id, milestone_code) DO NOTHING;

DO $$
DECLARE
  v_match_id UUID;
BEGIN
  FOR v_match_id IN SELECT match_id FROM public.training_partnerships LOOP
    PERFORM public.recalculate_training_partnership_engagement(v_match_id);
    PERFORM public.sync_training_partnership_milestones(v_match_id);
  END LOOP;
END $$;
