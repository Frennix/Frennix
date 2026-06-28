-- Beta Feedback — single source of truth (status workflow, links, screenshots, analytics).

DROP FUNCTION IF EXISTS public.list_beta_feedback(INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_beta_feedback(UUID, TEXT, TEXT);

-- ---------------------------------------------------------------------------
-- Schema extensions
-- ---------------------------------------------------------------------------

ALTER TABLE public.beta_feedback
  ADD COLUMN IF NOT EXISTS screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS milestone_code TEXT,
  ADD COLUMN IF NOT EXISTS release_version TEXT,
  ADD COLUMN IF NOT EXISTS github_issue_url TEXT,
  ADD COLUMN IF NOT EXISTS github_commit_sha TEXT,
  ADD COLUMN IF NOT EXISTS notify_tester_when_resolved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tester_notified_at TIMESTAMPTZ;

UPDATE public.beta_feedback SET status = 'new' WHERE status = 'open';

ALTER TABLE public.beta_feedback DROP CONSTRAINT IF EXISTS beta_feedback_status_check;
ALTER TABLE public.beta_feedback ADD CONSTRAINT beta_feedback_status_check
  CHECK (status IN ('new', 'in_progress', 'fixed', 'released', 'closed'));

ALTER TABLE public.beta_feedback ALTER COLUMN status SET DEFAULT 'new';

CREATE INDEX IF NOT EXISTS idx_beta_feedback_release ON public.beta_feedback(release_version, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_milestone ON public.beta_feedback(milestone_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_feature_area ON public.beta_feedback(feature_area, type, created_at DESC);

-- ---------------------------------------------------------------------------
-- Filter options RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_beta_feedback_filter_options()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_staff_capability('capability_support')
    OR public.has_staff_capability('capability_view_executive')
    OR public.has_staff_capability('capability_view_analytics')
  ) THEN
    RAISE EXCEPTION 'Beta feedback access required';
  END IF;

  RETURN jsonb_build_object(
    'platforms', COALESCE((
      SELECT jsonb_agg(DISTINCT platform ORDER BY platform)
      FROM public.beta_feedback WHERE platform IS NOT NULL
    ), '[]'::jsonb),
    'app_versions', COALESCE((
      SELECT jsonb_agg(DISTINCT app_version ORDER BY app_version DESC)
      FROM public.beta_feedback WHERE app_version IS NOT NULL
    ), '[]'::jsonb),
    'release_versions', COALESCE((
      SELECT jsonb_agg(DISTINCT release_version ORDER BY release_version DESC)
      FROM public.beta_feedback WHERE release_version IS NOT NULL
    ), '[]'::jsonb),
    'feature_areas', COALESCE((
      SELECT jsonb_agg(DISTINCT feature_area ORDER BY feature_area)
      FROM public.beta_feedback WHERE feature_area IS NOT NULL
    ), '[]'::jsonb),
    'milestone_codes', COALESCE((
      SELECT jsonb_agg(DISTINCT milestone_code ORDER BY milestone_code)
      FROM public.beta_feedback WHERE milestone_code IS NOT NULL
    ), '[]'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard metrics RPC (replace)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_beta_feedback_dashboard(
  p_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days INT := LEAST(GREATEST(COALESCE(p_days, 30), 1), 90);
  v_start TIMESTAMPTZ := date_trunc('day', now()) - ((v_days - 1) || ' days')::interval;
  v_week_start TIMESTAMPTZ := date_trunc('day', now()) - interval '6 days';
  v_today DATE := CURRENT_DATE;
  v_cohort_d1 DATE := v_today - 1;
  v_cohort_d7 DATE := v_today - 7;
  v_cohort_d30 DATE := v_today - 30;
  v_total_feedback INT;
  v_awaiting_review INT;
  v_bug_reports INT;
  v_feature_requests INT;
  v_crash_reports INT;
  v_avg_rating NUMERIC;
  v_dau_testers INT;
  v_wau_testers INT;
  v_match_success NUMERIC;
  v_conversation_start NUMERIC;
  v_messages_after_match INT;
  v_ret_d1 NUMERIC;
  v_ret_d7 NUMERIC;
  v_ret_d30 NUMERIC;
  v_avg_session_ms NUMERIC;
  v_total_matches INT;
  v_matches_with_chat INT;
  v_connects INT;
  v_top_features JSONB;
  v_top_bugs JSONB;
  v_exit_screens JSONB;
  v_tester_devices JSONB;
BEGIN
  IF NOT (
    public.has_staff_capability('capability_support')
    OR public.has_staff_capability('capability_view_executive')
    OR public.has_staff_capability('capability_view_analytics')
  ) THEN
    RAISE EXCEPTION 'Beta feedback dashboard access required';
  END IF;

  SELECT COUNT(*)::INT INTO v_total_feedback FROM public.beta_feedback;

  SELECT COUNT(*)::INT INTO v_awaiting_review
  FROM public.beta_feedback WHERE status = 'new';

  SELECT
    COUNT(*) FILTER (WHERE type = 'bug')::INT,
    COUNT(*) FILTER (WHERE type = 'feature')::INT,
    ROUND(AVG(rating) FILTER (WHERE type = 'rating'), 2)
  INTO v_bug_reports, v_feature_requests, v_avg_rating
  FROM public.beta_feedback
  WHERE created_at >= v_start;

  SELECT COUNT(*)::INT INTO v_crash_reports
  FROM (
    SELECT id FROM public.beta_feedback WHERE type = 'crash' AND created_at >= v_start
    UNION ALL
    SELECT id FROM public.founder_activity_events
    WHERE kind = 'crash_reported' AND created_at >= v_start
  ) c;

  SELECT COUNT(DISTINCT user_id)::INT INTO v_dau_testers
  FROM public.product_events
  WHERE event_name = 'daily_active_user' AND created_at::date = v_today;

  SELECT COUNT(DISTINCT user_id)::INT INTO v_wau_testers
  FROM public.product_events
  WHERE event_name = 'daily_active_user' AND created_at >= v_week_start;

  SELECT COUNT(*) FILTER (WHERE direction = 'right')::INT INTO v_connects
  FROM public.match_swipes WHERE created_at >= v_start;

  SELECT COUNT(*)::INT INTO v_total_matches
  FROM public.matches WHERE status = 'matched' AND created_at >= v_start;

  v_match_success := CASE
    WHEN v_connects > 0 THEN ROUND((v_total_matches::NUMERIC / v_connects::NUMERIC) * 100, 1)
    ELSE NULL
  END;

  WITH match_pairs AS (
    SELECT id, user_a, user_b, created_at AS matched_at
    FROM public.matches WHERE status = 'matched' AND created_at >= v_start
  ),
  pair_conversations AS (
    SELECT DISTINCT mp.id AS match_id, cm1.conversation_id, mp.matched_at
    FROM match_pairs mp
    JOIN public.conversation_members cm1 ON cm1.user_id = mp.user_a
    JOIN public.conversation_members cm2
      ON cm2.conversation_id = cm1.conversation_id AND cm2.user_id = mp.user_b
    WHERE (SELECT COUNT(*) FROM public.conversation_members cm WHERE cm.conversation_id = cm1.conversation_id) = 2
  )
  SELECT COUNT(DISTINCT pc.match_id)::INT, COUNT(msg.id)::INT
  INTO v_matches_with_chat, v_messages_after_match
  FROM pair_conversations pc
  LEFT JOIN public.messages msg
    ON msg.conversation_id = pc.conversation_id AND msg.created_at >= pc.matched_at;

  v_conversation_start := CASE
    WHEN v_total_matches > 0 THEN ROUND((v_matches_with_chat::NUMERIC / v_total_matches::NUMERIC) * 100, 1)
    ELSE NULL
  END;

  SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * COUNT(DISTINCT pe.user_id) / COUNT(DISTINCT p.id), 2) ELSE 0 END
  INTO v_ret_d1 FROM public.profiles p
  LEFT JOIN public.product_events pe ON pe.user_id = p.id AND pe.event_name = 'daily_active_user'
    AND pe.created_at::date = p.created_at::date + 1 WHERE p.created_at::date = v_cohort_d1;

  SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * COUNT(DISTINCT pe.user_id) / COUNT(DISTINCT p.id), 2) ELSE 0 END
  INTO v_ret_d7 FROM public.profiles p
  LEFT JOIN public.product_events pe ON pe.user_id = p.id AND pe.event_name = 'daily_active_user'
    AND pe.created_at::date BETWEEN p.created_at::date + 1 AND p.created_at::date + 7 WHERE p.created_at::date = v_cohort_d7;

  SELECT CASE WHEN COUNT(*) > 0 THEN ROUND(100.0 * COUNT(DISTINCT pe.user_id) / COUNT(DISTINCT p.id), 2) ELSE 0 END
  INTO v_ret_d30 FROM public.profiles p
  LEFT JOIN public.product_events pe ON pe.user_id = p.id AND pe.event_name = 'daily_active_user'
    AND pe.created_at::date BETWEEN p.created_at::date + 1 AND p.created_at::date + 30 WHERE p.created_at::date = v_cohort_d30;

  SELECT ROUND(AVG((properties->>'duration_ms')::NUMERIC)) INTO v_avg_session_ms
  FROM public.product_events
  WHERE event_name = 'perf_screen_load' AND created_at >= v_start AND (properties->>'duration_ms') IS NOT NULL;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.request_count DESC), '[]'::jsonb)
  INTO v_top_features FROM (
    SELECT COALESCE(NULLIF(trim(message), ''), feature_area, 'Unknown') AS feature_label, COUNT(*)::INT AS request_count
    FROM public.beta_feedback WHERE type = 'feature' AND created_at >= v_start GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.report_count DESC), '[]'::jsonb)
  INTO v_top_bugs FROM (
    SELECT
      COALESCE(feature_area, 'general') AS bug_area,
      LEFT(COALESCE(NULLIF(trim(message), ''), 'Unknown bug'), 120) AS bug_summary,
      COUNT(*)::INT AS report_count
    FROM public.beta_feedback WHERE type = 'bug' AND created_at >= v_start
    GROUP BY 1, 2 ORDER BY COUNT(*) DESC LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.exit_count DESC), '[]'::jsonb)
  INTO v_exit_screens FROM (
    SELECT COALESCE(properties->>'screen', 'unknown') AS screen, COUNT(*)::INT AS exit_count,
      ROUND(AVG((properties->>'duration_ms')::NUMERIC)) AS avg_duration_ms
    FROM public.product_events WHERE event_name = 'perf_screen_load' AND created_at >= v_start
    GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 10
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.last_seen DESC), '[]'::jsonb)
  INTO v_tester_devices FROM (
    SELECT DISTINCT ON (bf.user_id) bf.user_id, p.username, p.display_name, bf.app_version, bf.platform,
      bf.os_version, bf.browser, bf.build_number, bf.created_at AS last_seen
    FROM public.beta_feedback bf JOIN public.profiles p ON p.id = bf.user_id
    WHERE bf.app_version IS NOT NULL OR bf.platform IS NOT NULL
    ORDER BY bf.user_id, bf.created_at DESC LIMIT 20
  ) t;

  RETURN jsonb_build_object(
    'period_days', v_days,
    'computed_at', now(),
    'summary', jsonb_build_object(
      'total_feedback', COALESCE(v_total_feedback, 0),
      'awaiting_review', COALESCE(v_awaiting_review, 0),
      'bug_reports', COALESCE(v_bug_reports, 0),
      'feature_requests', COALESCE(v_feature_requests, 0),
      'crash_reports', COALESCE(v_crash_reports, 0),
      'avg_satisfaction_rating', v_avg_rating,
      'daily_active_testers', COALESCE(v_dau_testers, 0),
      'weekly_active_testers', COALESCE(v_wau_testers, 0),
      'match_success_rate', v_match_success,
      'conversation_start_rate', v_conversation_start,
      'messages_after_match', COALESCE(v_messages_after_match, 0),
      'retention_d1', v_ret_d1,
      'retention_d7', v_ret_d7,
      'retention_d30', v_ret_d30,
      'avg_session_length_ms', v_avg_session_ms,
      'total_matches', COALESCE(v_total_matches, 0),
      'matches_with_conversation', COALESCE(v_matches_with_chat, 0)
    ),
    'top_feature_requests', v_top_features,
    'top_bugs', v_top_bugs,
    'exit_screens', v_exit_screens,
    'tester_devices', v_tester_devices
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Paginated list RPC (replace)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_beta_feedback(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25,
  p_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL,
  p_release_version TEXT DEFAULT NULL,
  p_feature_area TEXT DEFAULT NULL,
  p_milestone_code TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INT := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size INT := LEAST(GREATEST(COALESCE(p_page_size, 25), 5), 100);
  v_offset INT := (v_page - 1) * v_page_size;
  v_total INT;
  v_items JSONB;
  v_platform TEXT := p_platform;
BEGIN
  IF NOT (
    public.has_staff_capability('capability_support')
    OR public.has_staff_capability('capability_view_executive')
    OR public.has_staff_capability('capability_view_analytics')
  ) THEN
    RAISE EXCEPTION 'Beta feedback access required';
  END IF;

  IF v_platform = 'iphone' THEN v_platform := 'ios';
  ELSIF v_platform = 'android' THEN v_platform := 'android';
  ELSIF v_platform = 'web' THEN v_platform := 'web';
  END IF;

  SELECT COUNT(*)::INT INTO v_total
  FROM public.beta_feedback bf
  JOIN public.profiles p ON p.id = bf.user_id
  WHERE (p_type IS NULL OR bf.type = p_type)
    AND (p_status IS NULL OR bf.status = p_status)
    AND (p_priority IS NULL OR bf.priority = p_priority)
    AND (v_platform IS NULL OR bf.platform = v_platform)
    AND (p_app_version IS NULL OR bf.app_version = p_app_version)
    AND (p_release_version IS NULL OR bf.release_version = p_release_version)
    AND (p_feature_area IS NULL OR bf.feature_area = p_feature_area)
    AND (p_milestone_code IS NULL OR bf.milestone_code = p_milestone_code)
    AND (p_user_id IS NULL OR bf.user_id = p_user_id)
    AND (
      p_search IS NULL OR p_search = ''
      OR bf.message ILIKE '%' || p_search || '%'
      OR p.username ILIKE '%' || p_search || '%'
      OR COALESCE(p.display_name, '') ILIKE '%' || p_search || '%'
      OR COALESCE(bf.feature_area, '') ILIKE '%' || p_search || '%'
      OR COALESCE(bf.milestone_code, '') ILIKE '%' || p_search || '%'
      OR COALESCE(bf.release_version, '') ILIKE '%' || p_search || '%'
      OR COALESCE(bf.github_issue_url, '') ILIKE '%' || p_search || '%'
      OR COALESCE(bf.github_commit_sha, '') ILIKE '%' || p_search || '%'
    );

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb) INTO v_items
  FROM (
    SELECT bf.*, p.username, p.display_name, p.avatar_url
    FROM public.beta_feedback bf
    JOIN public.profiles p ON p.id = bf.user_id
    WHERE (p_type IS NULL OR bf.type = p_type)
      AND (p_status IS NULL OR bf.status = p_status)
      AND (p_priority IS NULL OR bf.priority = p_priority)
      AND (v_platform IS NULL OR bf.platform = v_platform)
      AND (p_app_version IS NULL OR bf.app_version = p_app_version)
      AND (p_release_version IS NULL OR bf.release_version = p_release_version)
      AND (p_feature_area IS NULL OR bf.feature_area = p_feature_area)
      AND (p_milestone_code IS NULL OR bf.milestone_code = p_milestone_code)
      AND (p_user_id IS NULL OR bf.user_id = p_user_id)
      AND (
        p_search IS NULL OR p_search = ''
        OR bf.message ILIKE '%' || p_search || '%'
        OR p.username ILIKE '%' || p_search || '%'
        OR COALESCE(p.display_name, '') ILIKE '%' || p_search || '%'
        OR COALESCE(bf.feature_area, '') ILIKE '%' || p_search || '%'
        OR COALESCE(bf.milestone_code, '') ILIKE '%' || p_search || '%'
        OR COALESCE(bf.release_version, '') ILIKE '%' || p_search || '%'
        OR COALESCE(bf.github_issue_url, '') ILIKE '%' || p_search || '%'
        OR COALESCE(bf.github_commit_sha, '') ILIKE '%' || p_search || '%'
      )
    ORDER BY
      CASE bf.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      bf.created_at DESC
    LIMIT v_page_size OFFSET v_offset
  ) x;

  RETURN jsonb_build_object(
    'items', v_items, 'total', v_total, 'page', v_page,
    'pageSize', v_page_size, 'hasMore', (v_offset + v_page_size) < v_total
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Update feedback RPC (replace)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_beta_feedback(
  p_feedback_id UUID,
  p_status TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT NULL,
  p_milestone_code TEXT DEFAULT NULL,
  p_release_version TEXT DEFAULT NULL,
  p_github_issue_url TEXT DEFAULT NULL,
  p_github_commit_sha TEXT DEFAULT NULL,
  p_notify_tester BOOLEAN DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
  v_row public.beta_feedback%ROWTYPE;
  v_new_status TEXT;
BEGIN
  IF NOT (
    public.has_staff_capability('capability_support')
    OR public.has_staff_capability('capability_manage_staff')
  ) THEN
    RAISE EXCEPTION 'Support access required to update feedback';
  END IF;

  SELECT row_to_json(bf)::jsonb INTO v_before FROM public.beta_feedback bf WHERE bf.id = p_feedback_id;
  IF v_before IS NULL THEN RAISE EXCEPTION 'Feedback not found'; END IF;

  IF p_status IS NOT NULL AND p_status NOT IN ('new', 'in_progress', 'fixed', 'released', 'closed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  IF p_priority IS NOT NULL AND p_priority NOT IN ('critical', 'high', 'medium', 'low') THEN
    RAISE EXCEPTION 'Invalid priority';
  END IF;

  v_new_status := COALESCE(p_status, (v_before->>'status'));

  UPDATE public.beta_feedback bf SET
    status = COALESCE(p_status, bf.status),
    priority = COALESCE(p_priority, bf.priority),
    milestone_code = CASE WHEN p_milestone_code IS NOT NULL THEN NULLIF(trim(p_milestone_code), '') ELSE bf.milestone_code END,
    release_version = CASE WHEN p_release_version IS NOT NULL THEN NULLIF(trim(p_release_version), '') ELSE bf.release_version END,
    github_issue_url = CASE WHEN p_github_issue_url IS NOT NULL THEN NULLIF(trim(p_github_issue_url), '') ELSE bf.github_issue_url END,
    github_commit_sha = CASE WHEN p_github_commit_sha IS NOT NULL THEN NULLIF(trim(p_github_commit_sha), '') ELSE bf.github_commit_sha END,
    notify_tester_when_resolved = COALESCE(p_notify_tester, bf.notify_tester_when_resolved),
    updated_at = now(),
    resolved_at = CASE
      WHEN v_new_status IN ('fixed', 'released', 'closed') THEN now()
      WHEN v_new_status IN ('new', 'in_progress') THEN NULL
      ELSE bf.resolved_at
    END,
    resolved_by = CASE
      WHEN v_new_status IN ('fixed', 'released', 'closed') THEN auth.uid()
      WHEN v_new_status IN ('new', 'in_progress') THEN NULL
      ELSE bf.resolved_by
    END
  WHERE bf.id = p_feedback_id
  RETURNING * INTO v_row;

  v_after := row_to_json(v_row)::jsonb;

  PERFORM public.log_founder_audit(
    'beta_feedback_updated', 'beta_feedback', p_feedback_id, v_before, v_after
  );

  RETURN v_after;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_beta_feedback_filter_options() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_beta_feedback_dashboard(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_beta_feedback(INT, INT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_beta_feedback(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
