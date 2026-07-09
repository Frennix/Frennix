-- Beta Health Dashboard — administrator metrics RPC (reuses product_events, beta_feedback,
-- notification_subscriptions, notification_deliveries, founder_activity_events).

CREATE OR REPLACE FUNCTION public.get_beta_health_dashboard(
  p_preset TEXT DEFAULT 'week'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preset TEXT := lower(COALESCE(p_preset, 'week'));
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ := now();
  v_today DATE := CURRENT_DATE;
  v_week_start TIMESTAMPTZ := date_trunc('day', now()) - interval '6 days';

  v_total_beta_users INT;
  v_dau INT;
  v_wau INT;
  v_login_success INT;
  v_login_failed INT;
  v_login_success_rate NUMERIC;
  v_black_screen INT;
  v_startup_failures INT;
  v_js_errors INT;
  v_api_failures INT;
  v_avg_feed_load_ms NUMERIC;
  v_avg_startup_ms NUMERIC;
  v_push_reg_success INT;
  v_push_reg_failed INT;
  v_push_reg_rate NUMERIC;
  v_push_delivery_rate NUMERIC;
  v_active_push_subs INT;
  v_message_failures INT;
  v_story_upload_failures INT;
  v_photo_upload_failures INT;
  v_video_upload_failures INT;
  v_event_creation_failures INT;
  v_comment_failures INT;
  v_avg_session_ms NUMERIC;
  v_crash_count INT;
  v_session_signals INT;
  v_crash_free_pct NUMERIC;
  v_new_signups_by_day JSONB;
  v_performance_trends JSONB;
  v_recent_errors JSONB;
  v_critical_issues JSONB;
  v_top_bugs JSONB;
  v_device_breakdown JSONB;
  v_ios_versions JSONB;
  v_browser_versions JSONB;
  v_new_signups_today INT;
BEGIN
  IF NOT (
    public.has_staff_capability('capability_view_analytics')
    OR public.has_staff_capability('capability_view_executive')
    OR public.has_staff_capability('capability_manage_staff')
  ) THEN
    RAISE EXCEPTION 'Beta health dashboard requires administrator access';
  END IF;

  v_start := CASE v_preset
    WHEN 'today' THEN date_trunc('day', now())
    WHEN 'week' THEN date_trunc('day', now()) - interval '6 days'
    WHEN 'month' THEN date_trunc('day', now()) - interval '29 days'
    WHEN 'all' THEN '1970-01-01'::timestamptz
    ELSE date_trunc('day', now()) - interval '6 days'
  END;

  -- Users
  SELECT COUNT(*)::INT INTO v_total_beta_users FROM public.profiles;

  SELECT COUNT(DISTINCT user_id)::INT INTO v_dau
  FROM public.product_events
  WHERE event_name = 'daily_active_user' AND created_at::date = v_today;

  SELECT COUNT(DISTINCT user_id)::INT INTO v_wau
  FROM public.product_events
  WHERE event_name = 'daily_active_user' AND created_at >= v_week_start;

  SELECT COUNT(*)::INT INTO v_new_signups_today
  FROM public.profiles WHERE created_at::date = v_today;

  -- Login
  SELECT
    COUNT(*) FILTER (WHERE event_name = 'auth_login_success')::INT,
    COUNT(*) FILTER (WHERE event_name = 'auth_login_failed')::INT
  INTO v_login_success, v_login_failed
  FROM public.product_events
  WHERE event_name IN ('auth_login_success', 'auth_login_failed')
    AND created_at >= v_start AND created_at <= v_end;

  v_login_success_rate := CASE
    WHEN (v_login_success + v_login_failed) > 0
      THEN ROUND(100.0 * v_login_success / (v_login_success + v_login_failed), 1)
    ELSE NULL
  END;

  -- Black screen / startup
  SELECT COUNT(*)::INT INTO v_black_screen
  FROM public.beta_feedback
  WHERE created_at >= v_start AND created_at <= v_end
    AND (
      type = 'crash' AND (
        message ILIKE '%black%'
        OR COALESCE(metadata->>'source', '') ILIKE '%black%'
        OR COALESCE(metadata->>'error_message', '') ILIKE '%black%'
      )
    );

  v_black_screen := v_black_screen + (
    SELECT COUNT(*)::INT FROM public.product_events
    WHERE event_name IN ('startup_stall', 'black_screen_detected')
      AND created_at >= v_start AND created_at <= v_end
  );

  SELECT COUNT(*)::INT INTO v_startup_failures
  FROM (
    SELECT id FROM public.product_events
    WHERE event_name IN ('startup_stall', 'startup_failure')
      AND created_at >= v_start AND created_at <= v_end
    UNION ALL
    SELECT id FROM public.beta_feedback
    WHERE type = 'crash' AND created_at >= v_start AND created_at <= v_end
      AND (
        COALESCE(metadata->>'source', '') ILIKE '%startup%'
        OR message ILIKE '%startup%'
        OR COALESCE(metadata->>'startup_gap', '') <> ''
      )
  ) s;

  -- Errors
  SELECT COUNT(*)::INT INTO v_js_errors
  FROM (
    SELECT id FROM public.beta_feedback
    WHERE type = 'crash' AND created_at >= v_start AND created_at <= v_end
    UNION ALL
    SELECT id FROM public.product_events
    WHERE event_name IN ('client_error', 'error')
      AND created_at >= v_start AND created_at <= v_end
    UNION ALL
    SELECT id FROM public.founder_activity_events
    WHERE kind IN ('error_detected', 'crash_reported')
      AND created_at >= v_start AND created_at <= v_end
  ) e;

  SELECT COUNT(*)::INT INTO v_api_failures
  FROM public.product_events
  WHERE event_name IN ('api_request_failed', 'api_failure')
    AND created_at >= v_start AND created_at <= v_end;

  v_api_failures := v_api_failures + COALESCE((
    SELECT SUM(
      (SELECT COUNT(*)::INT
       FROM jsonb_array_elements(COALESCE(bf.metadata->'apiCalls', '[]'::jsonb)) elem
       WHERE COALESCE((elem->>'ok')::boolean, true) = false)
    )::INT
    FROM public.beta_feedback bf
    WHERE bf.type = 'crash' AND bf.created_at >= v_start AND bf.created_at <= v_end
  ), 0);

  -- Performance
  SELECT ROUND(AVG((properties->>'duration_ms')::NUMERIC))
  INTO v_avg_feed_load_ms
  FROM public.product_events
  WHERE event_name = 'perf_feed_load'
    AND created_at >= v_start AND created_at <= v_end
    AND (properties->>'duration_ms') ~ '^[0-9]+$';

  SELECT ROUND(AVG((properties->>'duration_ms')::NUMERIC))
  INTO v_avg_startup_ms
  FROM public.product_events
  WHERE event_name IN ('perf_app_startup', 'perf_startup')
    AND created_at >= v_start AND created_at <= v_end
    AND (properties->>'duration_ms') ~ '^[0-9]+$';

  SELECT ROUND(AVG((properties->>'duration_ms')::NUMERIC))
  INTO v_avg_session_ms
  FROM public.product_events
  WHERE event_name = 'perf_screen_load'
    AND created_at >= v_start AND created_at <= v_end
    AND (properties->>'duration_ms') ~ '^[0-9]+$';

  -- Push registration
  SELECT
    COUNT(*) FILTER (WHERE event_name = 'push_registration_success')::INT,
    COUNT(*) FILTER (WHERE event_name = 'push_registration_failed')::INT
  INTO v_push_reg_success, v_push_reg_failed
  FROM public.product_events
  WHERE event_name IN ('push_registration_success', 'push_registration_failed')
    AND created_at >= v_start AND created_at <= v_end;

  v_push_reg_rate := CASE
    WHEN (v_push_reg_success + v_push_reg_failed) > 0
      THEN ROUND(100.0 * v_push_reg_success / (v_push_reg_success + v_push_reg_failed), 1)
    ELSE NULL
  END;

  SELECT COUNT(*)::INT INTO v_active_push_subs
  FROM public.notification_subscriptions
  WHERE enabled = true;

  SELECT CASE WHEN COUNT(*) > 0 THEN
    ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) / COUNT(*), 1)
  ELSE NULL END INTO v_push_delivery_rate
  FROM public.notification_deliveries
  WHERE created_at >= v_start AND created_at <= v_end;

  -- Operation failures
  SELECT COUNT(*)::INT INTO v_message_failures
  FROM public.product_events
  WHERE event_name = 'message_send_failed'
    AND created_at >= v_start AND created_at <= v_end;

  SELECT COUNT(*)::INT INTO v_story_upload_failures
  FROM public.product_events
  WHERE event_name = 'upload_failed'
    AND COALESCE(properties->>'media_type', '') = 'story'
    AND created_at >= v_start AND created_at <= v_end;

  SELECT COUNT(*)::INT INTO v_photo_upload_failures
  FROM public.product_events
  WHERE event_name = 'upload_failed'
    AND COALESCE(properties->>'media_type', '') IN ('photo', 'image')
    AND created_at >= v_start AND created_at <= v_end;

  SELECT COUNT(*)::INT INTO v_video_upload_failures
  FROM public.product_events
  WHERE event_name = 'upload_failed'
    AND COALESCE(properties->>'media_type', '') = 'video'
    AND created_at >= v_start AND created_at <= v_end;

  SELECT COUNT(*)::INT INTO v_event_creation_failures
  FROM public.product_events
  WHERE event_name = 'event_creation_failed'
    AND created_at >= v_start AND created_at <= v_end;

  SELECT COUNT(*)::INT INTO v_comment_failures
  FROM public.product_events
  WHERE event_name = 'comment_failed'
    AND created_at >= v_start AND created_at <= v_end;

  -- Crash-free sessions (approximate)
  SELECT COUNT(*)::INT INTO v_crash_count
  FROM public.beta_feedback
  WHERE type = 'crash' AND created_at >= v_start AND created_at <= v_end;

  SELECT COUNT(DISTINCT user_id)::INT INTO v_session_signals
  FROM public.product_events
  WHERE event_name IN ('daily_active_user', 'perf_screen_load')
    AND created_at >= v_start AND created_at <= v_end
    AND user_id IS NOT NULL;

  v_crash_free_pct := CASE
    WHEN v_session_signals > 0
      THEN ROUND(GREATEST(0, 100.0 * (v_session_signals - LEAST(v_crash_count, v_session_signals)) / v_session_signals), 1)
    ELSE NULL
  END;

  -- New signups by day
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.day), '[]'::jsonb)
  INTO v_new_signups_by_day
  FROM (
    SELECT created_at::date AS day, COUNT(*)::INT AS count
    FROM public.profiles
    WHERE created_at >= v_start AND created_at <= v_end
    GROUP BY 1
    ORDER BY 1
  ) t;

  -- Performance trends (daily)
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.day), '[]'::jsonb)
  INTO v_performance_trends
  FROM (
    SELECT
      d.day,
      ROUND(AVG((pe.properties->>'duration_ms')::NUMERIC) FILTER (WHERE pe.event_name = 'perf_feed_load')) AS feed_load_ms,
      ROUND(AVG((pe.properties->>'duration_ms')::NUMERIC) FILTER (WHERE pe.event_name IN ('perf_app_startup', 'perf_startup'))) AS startup_ms,
      COUNT(*) FILTER (WHERE pe.event_name IN ('api_request_failed', 'api_failure'))::INT AS api_failures,
      COUNT(*) FILTER (WHERE pe.event_name IN ('client_error', 'startup_stall'))::INT AS error_events
    FROM (
      SELECT generate_series(
        date_trunc('day', v_start)::date,
        date_trunc('day', v_end)::date,
        interval '1 day'
      )::date AS day
    ) d
    LEFT JOIN public.product_events pe
      ON pe.created_at::date = d.day
    GROUP BY d.day
    ORDER BY d.day
  ) t;

  -- Recent errors
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_recent_errors
  FROM (
    SELECT
      bf.id::text,
      COALESCE(bf.metadata->>'source', 'crash_report') AS source,
      COALESCE(bf.message, bf.metadata->>'error_message', 'Unknown error') AS message,
      COALESCE(bf.priority, 'high') AS severity,
      bf.user_id::text,
      bf.platform,
      bf.created_at
    FROM public.beta_feedback bf
    WHERE bf.type = 'crash' AND bf.created_at >= v_start
    UNION ALL
    SELECT
      pe.id::text,
      COALESCE(pe.properties->>'source', pe.event_name) AS source,
      COALESCE(pe.properties->>'message', pe.properties->>'error', pe.event_name) AS message,
      'medium' AS severity,
      pe.user_id::text,
      pe.platform,
      pe.created_at
    FROM public.product_events pe
    WHERE pe.event_name IN ('client_error', 'startup_stall', 'api_request_failed', 'auth_login_failed', 'upload_failed')
      AND pe.created_at >= v_start
    ORDER BY created_at DESC
    LIMIT 50
  ) t;

  -- Top bugs
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.report_count DESC), '[]'::jsonb)
  INTO v_top_bugs
  FROM (
    SELECT
      COALESCE(feature_area, 'general') AS bug_area,
      COALESCE(NULLIF(trim(message), ''), 'Unspecified') AS bug_summary,
      COUNT(*)::INT AS report_count,
      MAX(priority) AS max_priority
    FROM public.beta_feedback
    WHERE type = 'bug' AND created_at >= v_start AND created_at <= v_end
    GROUP BY 1, 2
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) t;

  -- Device breakdown
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.count DESC), '[]'::jsonb)
  INTO v_device_breakdown
  FROM (
    SELECT COALESCE(platform, 'unknown') AS platform, COUNT(*)::INT AS count
    FROM (
      SELECT platform FROM public.product_events WHERE created_at >= v_start AND platform IS NOT NULL
      UNION ALL
      SELECT platform FROM public.beta_feedback WHERE created_at >= v_start AND platform IS NOT NULL
    ) u
    GROUP BY 1
    ORDER BY COUNT(*) DESC
  ) t;

  -- iOS versions
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.count DESC), '[]'::jsonb)
  INTO v_ios_versions
  FROM (
    SELECT COALESCE(os_version, 'unknown') AS version, COUNT(*)::INT AS count
    FROM public.beta_feedback
    WHERE platform = 'ios' AND created_at >= v_start AND os_version IS NOT NULL
    GROUP BY 1
    ORDER BY COUNT(*) DESC
    LIMIT 12
  ) t;

  -- Browser versions
  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.count DESC), '[]'::jsonb)
  INTO v_browser_versions
  FROM (
    SELECT COALESCE(browser, 'unknown') AS browser, COUNT(*)::INT AS count
    FROM public.beta_feedback
    WHERE platform = 'web' AND created_at >= v_start AND browser IS NOT NULL
    GROUP BY 1
    ORDER BY COUNT(*) DESC
    LIMIT 12
  ) t;

  -- Critical issues (auto-detected thresholds)
  SELECT COALESCE(jsonb_agg(issue ORDER BY (issue->>'severity') DESC), '[]'::jsonb)
  INTO v_critical_issues
  FROM (
    SELECT jsonb_build_object(
      'key', 'login_success_rate',
      'title', 'Low login success rate',
      'severity', 'critical',
      'message', format('Login success is %s%% (%s failed of %s attempts)', v_login_success_rate, v_login_failed, v_login_success + v_login_failed),
      'value', v_login_success_rate,
      'threshold', 90
    ) AS issue
    WHERE v_login_success_rate IS NOT NULL AND v_login_success_rate < 90
      AND (v_login_success + v_login_failed) >= 5
    UNION ALL
    SELECT jsonb_build_object(
      'key', 'crash_free_sessions',
      'title', 'Crash-free sessions below target',
      'severity', 'critical',
      'message', format('Crash-free sessions at %s%% (%s crashes)', v_crash_free_pct, v_crash_count),
      'value', v_crash_free_pct,
      'threshold', 95
    )
    WHERE v_crash_free_pct IS NOT NULL AND v_crash_free_pct < 95 AND v_session_signals >= 10
    UNION ALL
    SELECT jsonb_build_object(
      'key', 'black_screen',
      'title', 'Black screen reports detected',
      'severity', 'critical',
      'message', format('%s black-screen related events in period', v_black_screen),
      'value', v_black_screen,
      'threshold', 0
    )
    WHERE v_black_screen > 0
    UNION ALL
    SELECT jsonb_build_object(
      'key', 'startup_failures',
      'title', 'Startup failures elevated',
      'severity', 'high',
      'message', format('%s startup failures in period', v_startup_failures),
      'value', v_startup_failures,
      'threshold', 3
    )
    WHERE v_startup_failures >= 3
    UNION ALL
    SELECT jsonb_build_object(
      'key', 'push_delivery',
      'title', 'Push delivery rate degraded',
      'severity', 'high',
      'message', format('Push delivery at %s%%', v_push_delivery_rate),
      'value', v_push_delivery_rate,
      'threshold', 80
    )
    WHERE v_push_delivery_rate IS NOT NULL AND v_push_delivery_rate < 80
    UNION ALL
    SELECT jsonb_build_object(
      'key', 'feed_load',
      'title', 'Feed load time slow',
      'severity', 'medium',
      'message', format('Average feed load %s ms', v_avg_feed_load_ms),
      'value', v_avg_feed_load_ms,
      'threshold', 2000
    )
    WHERE v_avg_feed_load_ms IS NOT NULL AND v_avg_feed_load_ms > 2000
    UNION ALL
    SELECT jsonb_build_object(
      'key', 'api_failures',
      'title', 'API failure spike',
      'severity', 'high',
      'message', format('%s API failures in period', v_api_failures),
      'value', v_api_failures,
      'threshold', 10
    )
    WHERE v_api_failures >= 10
  ) issues(issue);

  RETURN jsonb_build_object(
    'preset', v_preset,
    'period_start', v_start,
    'period_end', v_end,
    'computed_at', now(),
    'summary', jsonb_build_object(
      'total_beta_users', COALESCE(v_total_beta_users, 0),
      'daily_active_users', COALESCE(v_dau, 0),
      'weekly_active_users', COALESCE(v_wau, 0),
      'new_signups_today', COALESCE(v_new_signups_today, 0),
      'login_success_rate', v_login_success_rate,
      'failed_login_count', COALESCE(v_login_failed, 0),
      'login_success_count', COALESCE(v_login_success, 0),
      'black_screen_occurrences', COALESCE(v_black_screen, 0),
      'startup_failures', COALESCE(v_startup_failures, 0),
      'javascript_runtime_errors', COALESCE(v_js_errors, 0),
      'api_failures', COALESCE(v_api_failures, 0),
      'avg_feed_load_ms', v_avg_feed_load_ms,
      'avg_app_startup_ms', v_avg_startup_ms,
      'push_registration_success_rate', v_push_reg_rate,
      'push_registration_success_count', COALESCE(v_push_reg_success, 0),
      'push_registration_failed_count', COALESCE(v_push_reg_failed, 0),
      'push_delivery_success_rate', v_push_delivery_rate,
      'active_push_subscriptions', COALESCE(v_active_push_subs, 0),
      'message_delivery_failures', COALESCE(v_message_failures, 0),
      'story_upload_failures', COALESCE(v_story_upload_failures, 0),
      'photo_upload_failures', COALESCE(v_photo_upload_failures, 0),
      'video_upload_failures', COALESCE(v_video_upload_failures, 0),
      'event_creation_failures', COALESCE(v_event_creation_failures, 0),
      'comment_failures', COALESCE(v_comment_failures, 0),
      'avg_session_duration_ms', v_avg_session_ms,
      'crash_free_session_pct', v_crash_free_pct,
      'crash_count', COALESCE(v_crash_count, 0)
    ),
    'new_signups_by_day', v_new_signups_by_day,
    'performance_trends', v_performance_trends,
    'recent_errors', v_recent_errors,
    'critical_issues', v_critical_issues,
    'top_bugs', v_top_bugs,
    'device_breakdown', v_device_breakdown,
    'ios_versions', v_ios_versions,
    'browser_versions', v_browser_versions
  );
END;
$$;

COMMENT ON FUNCTION public.get_beta_health_dashboard IS
  'Administrator beta health metrics — aggregates product_events, beta_feedback, push delivery.';

GRANT EXECUTE ON FUNCTION public.get_beta_health_dashboard(TEXT) TO authenticated;
