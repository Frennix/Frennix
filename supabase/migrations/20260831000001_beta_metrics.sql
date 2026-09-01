-- Beta Metrics: 30-day motivation survey + consolidated traction dashboard RPC.
-- Reuses profiles, matches, messages, conversation_members, product_events.

-- ---------------------------------------------------------------------------
-- Survey responses (one submission per user)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.beta_motivation_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer TEXT NOT NULL CHECK (
    answer IN ('yes_a_lot', 'yes_somewhat', 'not_really', 'not_yet_still_using')
  ),
  feedback TEXT,
  account_age_days INT NOT NULL CHECK (account_age_days >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT beta_motivation_surveys_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_beta_motivation_surveys_created
  ON public.beta_motivation_surveys (created_at DESC);

COMMENT ON TABLE public.beta_motivation_surveys IS
  'One-time 30-day motivation/connection survey for beta traction metrics.';

-- Dismissals allow re-prompt after cooldown without storing PII beyond user_id.
CREATE TABLE IF NOT EXISTS public.beta_motivation_survey_dismissals (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.beta_motivation_survey_dismissals IS
  'Last dismiss timestamp for the 30-day motivation survey prompt.';

ALTER TABLE public.beta_motivation_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beta_motivation_survey_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own motivation survey"
  ON public.beta_motivation_surveys FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own motivation survey"
  ON public.beta_motivation_surveys FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Staff read motivation surveys"
  ON public.beta_motivation_surveys FOR SELECT
  USING (
    public.has_staff_capability('capability_view_executive')
    OR public.has_staff_capability('capability_view_analytics')
    OR public.has_staff_capability('capability_manage_staff')
  );

CREATE POLICY "Users manage own survey dismissals"
  ON public.beta_motivation_survey_dismissals FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT ON public.beta_motivation_surveys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_motivation_survey_dismissals TO authenticated;

-- ---------------------------------------------------------------------------
-- User-facing survey RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_beta_motivation_survey_prompt()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_created_at TIMESTAMPTZ;
  v_account_age_days INT;
  v_min_age_days INT := 28;
  v_dismiss_cooldown_days INT := 7;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('show', false, 'reason', 'not_authenticated');
  END IF;

  IF EXISTS (SELECT 1 FROM public.beta_motivation_surveys WHERE user_id = v_user_id) THEN
    RETURN jsonb_build_object('show', false, 'reason', 'already_answered');
  END IF;

  SELECT created_at INTO v_created_at FROM public.profiles WHERE id = v_user_id;
  IF v_created_at IS NULL THEN
    RETURN jsonb_build_object('show', false, 'reason', 'profile_missing');
  END IF;

  v_account_age_days := GREATEST(0, (CURRENT_DATE - v_created_at::date));

  IF v_account_age_days < v_min_age_days THEN
    RETURN jsonb_build_object(
      'show', false,
      'reason', 'account_too_new',
      'account_age_days', v_account_age_days,
      'eligible_in_days', v_min_age_days - v_account_age_days
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.beta_motivation_survey_dismissals d
    WHERE d.user_id = v_user_id
      AND d.dismissed_at >= now() - (v_dismiss_cooldown_days || ' days')::interval
  ) THEN
    RETURN jsonb_build_object('show', false, 'reason', 'dismissed_recently');
  END IF;

  RETURN jsonb_build_object(
    'show', true,
    'account_age_days', v_account_age_days
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_beta_motivation_survey()
RETURNS void
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

  INSERT INTO public.beta_motivation_survey_dismissals (user_id, dismissed_at)
  VALUES (v_user_id, now())
  ON CONFLICT (user_id) DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_beta_motivation_survey(
  p_answer TEXT,
  p_feedback TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_created_at TIMESTAMPTZ;
  v_account_age_days INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_answer NOT IN ('yes_a_lot', 'yes_somewhat', 'not_really', 'not_yet_still_using') THEN
    RAISE EXCEPTION 'Invalid survey answer';
  END IF;

  IF EXISTS (SELECT 1 FROM public.beta_motivation_surveys WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Survey already submitted';
  END IF;

  SELECT created_at INTO v_created_at FROM public.profiles WHERE id = v_user_id;
  IF v_created_at IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_account_age_days := GREATEST(0, (CURRENT_DATE - v_created_at::date));

  INSERT INTO public.beta_motivation_surveys (user_id, answer, feedback, account_age_days)
  VALUES (
    v_user_id,
    p_answer,
    NULLIF(trim(p_feedback), ''),
    v_account_age_days
  );

  DELETE FROM public.beta_motivation_survey_dismissals WHERE user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_beta_motivation_survey_prompt() TO authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_beta_motivation_survey() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_beta_motivation_survey(TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Founder/admin consolidated beta metrics dashboard
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_beta_metrics_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_week_start TIMESTAMPTZ := date_trunc('day', now()) - interval '6 days';
  v_prev_week_start TIMESTAMPTZ := date_trunc('day', now()) - interval '13 days';
  v_prev_week_end TIMESTAMPTZ := date_trunc('day', now()) - interval '7 days';

  v_total_users INT;
  v_new_users_this_week INT;
  v_new_users_prev_week INT;

  v_wau INT;
  v_wau_prev INT;
  v_multi_day_wau INT;
  v_multi_day_wau_prev INT;

  v_total_matches INT;
  v_users_matched INT;
  v_match_rate NUMERIC;
  v_users_messaged INT;
  v_conversation_rate NUMERIC;
  v_conversations_started INT;

  v_survey_responses INT;
  v_survey_positive_pct NUMERIC;
  v_survey_breakdown JSONB;

  v_match_rate_prev NUMERIC;
  v_conversation_rate_prev NUMERIC;
  v_survey_positive_pct_prev NUMERIC;
BEGIN
  IF NOT (
    public.has_staff_capability('capability_view_executive')
    OR public.has_staff_capability('capability_manage_staff')
    OR public.has_staff_capability('capability_view_analytics')
  ) THEN
    RAISE EXCEPTION 'Beta metrics dashboard requires administrator access';
  END IF;

  -- Users
  SELECT COUNT(*)::INT INTO v_total_users FROM public.profiles;

  SELECT COUNT(*)::INT INTO v_new_users_this_week
  FROM public.profiles WHERE created_at >= v_week_start;

  SELECT COUNT(*)::INT INTO v_new_users_prev_week
  FROM public.profiles
  WHERE created_at >= v_prev_week_start AND created_at < v_prev_week_end;

  -- WAU from daily_active_user events (ProductAnalyticsBootstrap)
  SELECT COUNT(DISTINCT user_id)::INT INTO v_wau
  FROM public.product_events
  WHERE event_name = 'daily_active_user' AND created_at >= v_week_start;

  SELECT COUNT(DISTINCT user_id)::INT INTO v_wau_prev
  FROM public.product_events
  WHERE event_name = 'daily_active_user'
    AND created_at >= v_prev_week_start AND created_at < v_prev_week_end;

  SELECT COUNT(*)::INT INTO v_multi_day_wau
  FROM (
    SELECT user_id
    FROM public.product_events
    WHERE event_name = 'daily_active_user' AND created_at >= v_week_start
    GROUP BY user_id
    HAVING COUNT(DISTINCT (created_at AT TIME ZONE 'UTC')::date) >= 2
  ) md;

  SELECT COUNT(*)::INT INTO v_multi_day_wau_prev
  FROM (
    SELECT user_id
    FROM public.product_events
    WHERE event_name = 'daily_active_user'
      AND created_at >= v_prev_week_start AND created_at < v_prev_week_end
    GROUP BY user_id
    HAVING COUNT(DISTINCT (created_at AT TIME ZONE 'UTC')::date) >= 2
  ) md;

  -- Match funnel (all-time, user-centric)
  SELECT COUNT(*)::INT INTO v_total_matches
  FROM public.matches WHERE status = 'matched';

  WITH matched_users AS (
    SELECT user_a AS user_id FROM public.matches WHERE status = 'matched'
    UNION
    SELECT user_b FROM public.matches WHERE status = 'matched'
  )
  SELECT COUNT(DISTINCT user_id)::INT INTO v_users_matched FROM matched_users;

  v_match_rate := CASE
    WHEN v_total_users > 0 THEN ROUND(100.0 * v_users_matched / v_total_users, 1)
    ELSE NULL
  END;

  WITH match_pairs AS (
    SELECT id, user_a, user_b, created_at AS matched_at
    FROM public.matches WHERE status = 'matched'
  ),
  pair_conversations AS (
    SELECT DISTINCT mp.id AS match_id, mp.user_a, mp.user_b, mp.matched_at, cm1.conversation_id
    FROM match_pairs mp
    JOIN public.conversation_members cm1 ON cm1.user_id = mp.user_a
    JOIN public.conversation_members cm2
      ON cm2.conversation_id = cm1.conversation_id AND cm2.user_id = mp.user_b
    WHERE (
      SELECT COUNT(*)::INT FROM public.conversation_members cm
      WHERE cm.conversation_id = cm1.conversation_id
    ) = 2
  ),
  match_messages AS (
    SELECT pc.match_id, pc.user_a, pc.user_b, msg.sender_id
    FROM pair_conversations pc
    JOIN public.messages msg
      ON msg.conversation_id = pc.conversation_id AND msg.created_at >= pc.matched_at
  )
  SELECT
    COUNT(DISTINCT sender_id)::INT,
    COUNT(DISTINCT match_id)::INT
  INTO v_users_messaged, v_conversations_started
  FROM match_messages;

  v_conversation_rate := CASE
    WHEN v_users_matched > 0 THEN ROUND(100.0 * v_users_messaged / v_users_matched, 1)
    ELSE NULL
  END;

  -- Survey metrics
  SELECT COUNT(*)::INT INTO v_survey_responses FROM public.beta_motivation_surveys;

  SELECT CASE
    WHEN COUNT(*) > 0 THEN ROUND(
      100.0 * COUNT(*) FILTER (WHERE answer IN ('yes_a_lot', 'yes_somewhat')) / COUNT(*),
      1
    )
    ELSE NULL
  END INTO v_survey_positive_pct
  FROM public.beta_motivation_surveys;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.sort_order), '[]'::jsonb)
  INTO v_survey_breakdown
  FROM (
    SELECT
      answer,
      CASE answer
        WHEN 'yes_a_lot' THEN 1
        WHEN 'yes_somewhat' THEN 2
        WHEN 'not_really' THEN 3
        WHEN 'not_yet_still_using' THEN 4
      END AS sort_order,
      COUNT(*)::INT AS count,
      CASE WHEN v_survey_responses > 0
        THEN ROUND(100.0 * COUNT(*) / v_survey_responses, 1)
        ELSE 0
      END AS pct
    FROM public.beta_motivation_surveys
    GROUP BY answer
  ) t;

  -- Week-over-week snapshots (match/survey rates use cohort windows for trend signal)
  WITH prev_matched_users AS (
    SELECT user_a AS user_id FROM public.matches
    WHERE status = 'matched' AND created_at < v_prev_week_end
    UNION
    SELECT user_b FROM public.matches
    WHERE status = 'matched' AND created_at < v_prev_week_end
  ),
  prev_users AS (
    SELECT COUNT(*)::INT AS total FROM public.profiles WHERE created_at < v_prev_week_end
  ),
  prev_messaged AS (
    WITH match_pairs AS (
      SELECT id, user_a, user_b, created_at AS matched_at
      FROM public.matches
      WHERE status = 'matched' AND created_at < v_prev_week_end
    ),
    pair_conversations AS (
      SELECT DISTINCT mp.id AS match_id, mp.user_a, mp.user_b, mp.matched_at, cm1.conversation_id
      FROM match_pairs mp
      JOIN public.conversation_members cm1 ON cm1.user_id = mp.user_a
      JOIN public.conversation_members cm2
        ON cm2.conversation_id = cm1.conversation_id AND cm2.user_id = mp.user_b
      WHERE (
        SELECT COUNT(*)::INT FROM public.conversation_members cm
        WHERE cm.conversation_id = cm1.conversation_id
      ) = 2
    )
    SELECT COUNT(DISTINCT msg.sender_id)::INT AS cnt
    FROM pair_conversations pc
    JOIN public.messages msg
      ON msg.conversation_id = pc.conversation_id
      AND msg.created_at >= pc.matched_at
      AND msg.created_at < v_prev_week_end
  )
  SELECT
    CASE WHEN pu.total > 0
      THEN ROUND(100.0 * (SELECT COUNT(DISTINCT user_id) FROM prev_matched_users) / pu.total, 1)
      ELSE NULL
    END,
    CASE WHEN (SELECT COUNT(DISTINCT user_id) FROM prev_matched_users) > 0
      THEN ROUND(
        100.0 * (SELECT cnt FROM prev_messaged)
        / (SELECT COUNT(DISTINCT user_id) FROM prev_matched_users),
        1
      )
      ELSE NULL
    END
  INTO v_match_rate_prev, v_conversation_rate_prev
  FROM prev_users pu;

  SELECT CASE
    WHEN COUNT(*) > 0 THEN ROUND(
      100.0 * COUNT(*) FILTER (WHERE answer IN ('yes_a_lot', 'yes_somewhat')) / COUNT(*),
      1
    )
    ELSE NULL
  END INTO v_survey_positive_pct_prev
  FROM public.beta_motivation_surveys
  WHERE created_at < v_prev_week_end;

  RETURN jsonb_build_object(
    'computed_at', now(),
    'summary', jsonb_build_object(
      'total_registered_users', COALESCE(v_total_users, 0),
      'new_users_this_week', COALESCE(v_new_users_this_week, 0),
      'weekly_active_users', COALESCE(v_wau, 0),
      'multi_day_active_users', COALESCE(v_multi_day_wau, 0),
      'total_matches', COALESCE(v_total_matches, 0),
      'users_matched', COALESCE(v_users_matched, 0),
      'match_rate_pct', v_match_rate,
      'users_messaged_match', COALESCE(v_users_messaged, 0),
      'conversation_rate_pct', v_conversation_rate,
      'conversations_started', COALESCE(v_conversations_started, 0),
      'survey_response_count', COALESCE(v_survey_responses, 0),
      'survey_positive_pct', v_survey_positive_pct
    ),
    'week_over_week', jsonb_build_object(
      'new_users', jsonb_build_object(
        'current', COALESCE(v_new_users_this_week, 0),
        'previous', COALESCE(v_new_users_prev_week, 0),
        'delta', COALESCE(v_new_users_this_week, 0) - COALESCE(v_new_users_prev_week, 0)
      ),
      'weekly_active_users', jsonb_build_object(
        'current', COALESCE(v_wau, 0),
        'previous', COALESCE(v_wau_prev, 0),
        'delta', COALESCE(v_wau, 0) - COALESCE(v_wau_prev, 0)
      ),
      'multi_day_active_users', jsonb_build_object(
        'current', COALESCE(v_multi_day_wau, 0),
        'previous', COALESCE(v_multi_day_wau_prev, 0),
        'delta', COALESCE(v_multi_day_wau, 0) - COALESCE(v_multi_day_wau_prev, 0)
      ),
      'match_rate_pct', jsonb_build_object(
        'current', v_match_rate,
        'previous', v_match_rate_prev,
        'delta', CASE
          WHEN v_match_rate IS NOT NULL AND v_match_rate_prev IS NOT NULL
            THEN ROUND(v_match_rate - v_match_rate_prev, 1)
          ELSE NULL
        END
      ),
      'conversation_rate_pct', jsonb_build_object(
        'current', v_conversation_rate,
        'previous', v_conversation_rate_prev,
        'delta', CASE
          WHEN v_conversation_rate IS NOT NULL AND v_conversation_rate_prev IS NOT NULL
            THEN ROUND(v_conversation_rate - v_conversation_rate_prev, 1)
          ELSE NULL
        END
      ),
      'survey_positive_pct', jsonb_build_object(
        'current', v_survey_positive_pct,
        'previous', v_survey_positive_pct_prev,
        'delta', CASE
          WHEN v_survey_positive_pct IS NOT NULL AND v_survey_positive_pct_prev IS NOT NULL
            THEN ROUND(v_survey_positive_pct - v_survey_positive_pct_prev, 1)
          ELSE NULL
        END
      )
    ),
    'survey_breakdown', v_survey_breakdown
  );
END;
$$;

COMMENT ON FUNCTION public.get_beta_metrics_dashboard IS
  'Consolidated beta traction metrics for grants/investors: match rate, WAU, 30-day survey.';

GRANT EXECUTE ON FUNCTION public.get_beta_metrics_dashboard() TO authenticated;
