-- P1: Matchmaking analytics RPC + activate founder analytics domain.

CREATE OR REPLACE FUNCTION public.get_matchmaking_analytics(
  p_days INT DEFAULT 30,
  p_environment TEXT DEFAULT 'production'
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
  v_today DATE := CURRENT_DATE;
  v_summary JSONB;
  v_series JSONB;
  v_connects INT;
  v_matches INT;
  v_skips INT;
  v_active_matchers INT;
  v_deck_loads INT;
  v_deck_empty INT;
  v_avg_load_ms NUMERIC;
  v_conversion NUMERIC;
  v_flag_enabled BOOLEAN;
BEGIN
  IF NOT (
    public.has_staff_capability('capability_view_analytics')
    OR public.has_staff_capability('capability_view_executive')
  ) THEN
    RAISE EXCEPTION 'Analytics access required';
  END IF;

  SELECT COALESCE(enabled_globally, true)
  INTO v_flag_enabled
  FROM public.feature_flags
  WHERE key = 'training_matchmaking';

  IF NOT FOUND THEN
    v_flag_enabled := true;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE direction = 'right')::INT,
    COUNT(*) FILTER (WHERE direction = 'left')::INT,
    COUNT(DISTINCT swiper_id)::INT
  INTO v_connects, v_skips, v_active_matchers
  FROM public.match_swipes
  WHERE created_at >= v_start;

  SELECT COUNT(*)::INT
  INTO v_matches
  FROM public.matches
  WHERE status = 'matched' AND created_at >= v_start;

  SELECT
    COUNT(*) FILTER (WHERE event_name = 'match_deck_loaded')::INT,
    COUNT(*) FILTER (WHERE event_name = 'match_deck_empty')::INT,
    ROUND(AVG((properties->>'duration_ms')::NUMERIC) FILTER (WHERE event_name = 'perf_matching_load'))
  INTO v_deck_loads, v_deck_empty, v_avg_load_ms
  FROM public.product_events
  WHERE created_at >= v_start
    AND event_name IN ('match_deck_loaded', 'match_deck_empty', 'perf_matching_load');

  v_conversion := CASE
    WHEN v_connects > 0 THEN ROUND((v_matches::NUMERIC / v_connects::NUMERIC) * 100, 1)
    ELSE NULL
  END;

  v_summary := jsonb_build_object(
    'new_matches', v_matches,
    'connects', v_connects,
    'skips', v_skips,
    'mutual_conversion_rate', v_conversion,
    'active_matchers', v_active_matchers,
    'discovery_enabled', (
      SELECT COUNT(*)::INT FROM public.profiles WHERE COALESCE(matching_enabled, false) = true
    ),
    'matches_today', (
      SELECT COUNT(*)::INT FROM public.matches
      WHERE status = 'matched' AND created_at::date = v_today
    ),
    'deck_loads', COALESCE(v_deck_loads, 0),
    'deck_empty', COALESCE(v_deck_empty, 0),
    'avg_deck_load_ms', v_avg_load_ms,
    'feature_flag_enabled', COALESCE(v_flag_enabled, true),
    'unmatched_total', (
      SELECT COUNT(*)::INT FROM public.matches WHERE status = 'unmatched'
    )
  );

  SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.date), '[]'::jsonb)
  INTO v_series
  FROM (
    SELECT
      gs.day::date AS date,
      COALESCE(m.match_count, 0) AS matches,
      COALESCE(s.connect_count, 0) AS connects,
      COALESCE(s.skip_count, 0) AS skips,
      COALESCE(s.active_matchers, 0) AS active_matchers,
      COALESCE(e.deck_loads, 0) AS deck_loads,
      COALESCE(e.deck_empty, 0) AS deck_empty
    FROM generate_series(v_start::date, v_today, interval '1 day') AS gs(day)
    LEFT JOIN (
      SELECT created_at::date AS day, COUNT(*)::INT AS match_count
      FROM public.matches
      WHERE status = 'matched' AND created_at >= v_start
      GROUP BY 1
    ) m ON m.day = gs.day::date
    LEFT JOIN (
      SELECT
        created_at::date AS day,
        COUNT(*) FILTER (WHERE direction = 'right')::INT AS connect_count,
        COUNT(*) FILTER (WHERE direction = 'left')::INT AS skip_count,
        COUNT(DISTINCT swiper_id)::INT AS active_matchers
      FROM public.match_swipes
      WHERE created_at >= v_start
      GROUP BY 1
    ) s ON s.day = gs.day::date
    LEFT JOIN (
      SELECT
        created_at::date AS day,
        COUNT(*) FILTER (WHERE event_name = 'match_deck_loaded')::INT AS deck_loads,
        COUNT(*) FILTER (WHERE event_name = 'match_deck_empty')::INT AS deck_empty
      FROM public.product_events
      WHERE created_at >= v_start
        AND event_name IN ('match_deck_loaded', 'match_deck_empty')
      GROUP BY 1
    ) e ON e.day = gs.day::date
    ORDER BY gs.day
  ) d;

  RETURN jsonb_build_object(
    'environment', p_environment,
    'period_days', v_days,
    'computed_at', now(),
    'summary', v_summary,
    'series', v_series
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_matchmaking_analytics(INT, TEXT) TO authenticated;

UPDATE public.founder_analytics_domains
SET status = 'active', milestone_code = 'P1', description = 'Training partner discovery, swipes, matches, and deck funnel'
WHERE domain_key = 'matchmaking';

INSERT INTO public.founder_metric_definitions (metric_key, domain_key, display_name, emoji, value_type, status, drill_down_path, sort_order)
VALUES
  ('matchmaking_new_matches', 'matchmaking', 'New Matches', '🤝', 'count', 'active', '/founder/analytics/matchmaking', 1),
  ('matchmaking_connects', 'matchmaking', 'Connects', '✅', 'count', 'active', '/founder/analytics/matchmaking', 2),
  ('matchmaking_skips', 'matchmaking', 'Skips', '⏭️', 'count', 'active', '/founder/analytics/matchmaking', 3),
  ('matchmaking_conversion', 'matchmaking', 'Match Conversion', '📈', 'percentage', 'active', '/founder/analytics/matchmaking', 4),
  ('matchmaking_active_matchers', 'matchmaking', 'Active Matchers', '👟', 'count', 'active', '/founder/analytics/matchmaking', 5),
  ('matchmaking_discovery_enabled', 'matchmaking', 'Discovery Enabled', '🔍', 'count', 'active', '/founder/analytics/matchmaking', 6),
  ('matchmaking_deck_loads', 'matchmaking', 'Deck Loads', '📋', 'count', 'active', '/founder/analytics/matchmaking', 7),
  ('matchmaking_avg_load_ms', 'matchmaking', 'Avg Deck Load', '⚡', 'duration_ms', 'active', '/founder/analytics/matchmaking', 8)
ON CONFLICT (metric_key) DO UPDATE SET
  domain_key = EXCLUDED.domain_key,
  display_name = EXCLUDED.display_name,
  status = 'active',
  drill_down_path = EXCLUDED.drill_down_path;
