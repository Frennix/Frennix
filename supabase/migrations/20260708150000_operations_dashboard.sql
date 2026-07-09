-- Operations Dashboard — permanent founder monitoring (extends beta health).

CREATE TABLE IF NOT EXISTS public.operations_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'high' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operations_alerts_status_triggered
  ON public.operations_alerts (status, triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_operations_alerts_key_active
  ON public.operations_alerts (alert_key)
  WHERE status = 'active';

ALTER TABLE public.operations_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view operations alerts"
  ON public.operations_alerts FOR SELECT
  USING (
    public.has_staff_capability('capability_view_analytics')
    OR public.has_staff_capability('capability_view_executive')
    OR public.has_staff_capability('capability_manage_staff')
  );

CREATE POLICY "Staff manage operations alerts"
  ON public.operations_alerts FOR UPDATE
  USING (
    public.has_staff_capability('capability_view_analytics')
    OR public.has_staff_capability('capability_view_executive')
    OR public.has_staff_capability('capability_manage_staff')
  );

-- ---------------------------------------------------------------------------
-- Alert sync (threshold-based)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_operations_alerts(
  p_login_rate NUMERIC,
  p_crash_rate NUMERIC,
  p_black_screen_1h INT,
  p_avg_feed_ms NUMERIC,
  p_avg_api_ms NUMERIC,
  p_push_delivery_rate NUMERIC,
  p_db_latency_ms INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_login_rate IS NOT NULL AND p_login_rate < 95
     AND NOT EXISTS (SELECT 1 FROM public.operations_alerts WHERE alert_key = 'login_success_rate' AND status = 'active') THEN
    INSERT INTO public.operations_alerts (alert_key, title, message, severity, metadata)
    VALUES (
      'login_success_rate',
      'Login success rate below 95%',
      format('Current login success rate is %s%%', p_login_rate),
      'critical',
      jsonb_build_object('value', p_login_rate, 'threshold', 95)
    );
  END IF;

  IF p_crash_rate IS NOT NULL AND p_crash_rate > 1
     AND NOT EXISTS (SELECT 1 FROM public.operations_alerts WHERE alert_key = 'crash_rate' AND status = 'active') THEN
    INSERT INTO public.operations_alerts (alert_key, title, message, severity, metadata)
    VALUES (
      'crash_rate',
      'Crash rate exceeds 1%',
      format('Crash rate is %s%%', p_crash_rate),
      'critical',
      jsonb_build_object('value', p_crash_rate, 'threshold', 1)
    );
  END IF;

  IF p_black_screen_1h > 3
     AND NOT EXISTS (SELECT 1 FROM public.operations_alerts WHERE alert_key = 'black_screen_hourly' AND status = 'active') THEN
    INSERT INTO public.operations_alerts (alert_key, title, message, severity, metadata)
    VALUES (
      'black_screen_hourly',
      'Black screen spike',
      format('%s black-screen incidents in the last hour', p_black_screen_1h),
      'critical',
      jsonb_build_object('value', p_black_screen_1h, 'threshold', 3)
    );
  END IF;

  IF p_avg_feed_ms IS NOT NULL AND p_avg_feed_ms > 3000
     AND NOT EXISTS (SELECT 1 FROM public.operations_alerts WHERE alert_key = 'feed_load_slow' AND status = 'active') THEN
    INSERT INTO public.operations_alerts (alert_key, title, message, severity, metadata)
    VALUES (
      'feed_load_slow',
      'Feed load exceeds 3 seconds',
      format('Average feed load is %s ms', ROUND(p_avg_feed_ms)),
      'high',
      jsonb_build_object('value', p_avg_feed_ms, 'threshold', 3000)
    );
  END IF;

  IF p_avg_api_ms IS NOT NULL AND p_avg_api_ms > 2000
     AND NOT EXISTS (SELECT 1 FROM public.operations_alerts WHERE alert_key = 'api_response_slow' AND status = 'active') THEN
    INSERT INTO public.operations_alerts (alert_key, title, message, severity, metadata)
    VALUES (
      'api_response_slow',
      'API response exceeds 2 seconds',
      format('Average API response is %s ms', ROUND(p_avg_api_ms)),
      'high',
      jsonb_build_object('value', p_avg_api_ms, 'threshold', 2000)
    );
  END IF;

  IF p_push_delivery_rate IS NOT NULL AND p_push_delivery_rate < 95
     AND NOT EXISTS (SELECT 1 FROM public.operations_alerts WHERE alert_key = 'push_delivery_low' AND status = 'active') THEN
    INSERT INTO public.operations_alerts (alert_key, title, message, severity, metadata)
    VALUES (
      'push_delivery_low',
      'Push delivery below 95%',
      format('Push delivery rate is %s%%', p_push_delivery_rate),
      'high',
      jsonb_build_object('value', p_push_delivery_rate, 'threshold', 95)
    );
  END IF;

  IF p_db_latency_ms IS NOT NULL AND p_db_latency_ms > 1000
     AND NOT EXISTS (SELECT 1 FROM public.operations_alerts WHERE alert_key = 'database_latency' AND status = 'active') THEN
    INSERT INTO public.operations_alerts (alert_key, title, message, severity, metadata)
    VALUES (
      'database_latency',
      'Database latency abnormal',
      format('Database probe latency is %s ms', p_db_latency_ms),
      'critical',
      jsonb_build_object('value', p_db_latency_ms, 'threshold', 1000)
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_operations_alert(p_alert_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.operations_alerts%ROWTYPE;
BEGIN
  IF NOT (
    public.has_staff_capability('capability_view_analytics')
    OR public.has_staff_capability('capability_view_executive')
    OR public.has_staff_capability('capability_manage_staff')
  ) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  UPDATE public.operations_alerts
  SET status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
  WHERE id = p_alert_id AND status = 'active'
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Alert not found or already resolved';
  END IF;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_resolved_operations_alerts()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  IF NOT (
    public.has_staff_capability('capability_view_analytics')
    OR public.has_staff_capability('capability_view_executive')
    OR public.has_staff_capability('capability_manage_staff')
  ) THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  DELETE FROM public.operations_alerts WHERE status = 'resolved';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Main operations dashboard RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_operations_dashboard(
  p_trend_window TEXT DEFAULT '7d',
  p_preset TEXT DEFAULT 'today'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trend TEXT := lower(COALESCE(p_trend_window, '7d'));
  v_preset TEXT := lower(COALESCE(p_preset, 'today'));
  v_today DATE := CURRENT_DATE;
  v_today_start TIMESTAMPTZ := date_trunc('day', now());
  v_hour_ago TIMESTAMPTZ := now() - interval '1 hour';
  v_trend_start TIMESTAMPTZ;
  v_period_start TIMESTAMPTZ;
  v_health JSONB;
  v_db_latency INT;
  v_db_start TIMESTAMPTZ;
  v_overall TEXT := 'green';
  v_worst INT := 0;
  v_rank INT;
  r RECORD;

  v_users_online INT;
  v_logins_today INT;
  v_posts_today INT;
  v_stories_today INT;
  v_messages_today INT;
  v_events_today INT;
  v_matches_today INT;
  v_push_sent_today INT;
  v_new_users_today INT;

  v_black_screen_1h INT;
  v_crash_rate NUMERIC;
  v_avg_api_ms NUMERIC;

  v_push_pending_retry INT;
  v_storage_objects BIGINT;
BEGIN
  IF NOT (
    public.has_staff_capability('capability_view_analytics')
    OR public.has_staff_capability('capability_view_executive')
    OR public.has_staff_capability('capability_manage_staff')
  ) THEN
    RAISE EXCEPTION 'Operations dashboard requires administrator access';
  END IF;

  v_trend_start := CASE v_trend
    WHEN '24h' THEN now() - interval '24 hours'
    WHEN '30d' THEN date_trunc('day', now()) - interval '29 days'
    ELSE date_trunc('day', now()) - interval '6 days'
  END;

  v_period_start := CASE v_preset
    WHEN 'today' THEN v_today_start
    WHEN 'week' THEN date_trunc('day', now()) - interval '6 days'
    WHEN 'month' THEN date_trunc('day', now()) - interval '29 days'
    WHEN 'all' THEN '1970-01-01'::timestamptz
    ELSE v_today_start
  END;

  v_health := public.get_beta_health_dashboard(v_preset);

  -- Database probe
  v_db_start := clock_timestamp();
  PERFORM COUNT(*)::INT FROM public.profiles;
  v_db_latency := EXTRACT(MILLISECONDS FROM clock_timestamp() - v_db_start)::INT;

  PERFORM public.refresh_system_health_snapshots('production');

  -- Live activity (today)
  SELECT COUNT(*)::INT INTO v_users_online
  FROM public.profiles
  WHERE is_online = true AND (last_seen_at IS NULL OR last_seen_at >= now() - interval '10 minutes');

  SELECT COUNT(*)::INT INTO v_new_users_today FROM public.profiles WHERE created_at::date = v_today;

  SELECT COUNT(*)::INT INTO v_logins_today
  FROM public.product_events
  WHERE event_name = 'auth_login_success' AND created_at >= v_today_start;

  SELECT COUNT(*)::INT INTO v_posts_today FROM public.posts WHERE created_at >= v_today_start;
  SELECT COUNT(*)::INT INTO v_stories_today FROM public.stories WHERE created_at >= v_today_start;
  SELECT COUNT(*)::INT INTO v_messages_today FROM public.messages WHERE created_at >= v_today_start;
  SELECT COUNT(*)::INT INTO v_events_today FROM public.events WHERE created_at >= v_today_start;
  SELECT COUNT(*)::INT INTO v_matches_today FROM public.matches WHERE created_at >= v_today_start AND status = 'matched';

  SELECT COUNT(*)::INT INTO v_push_sent_today
  FROM public.notification_deliveries
  WHERE created_at >= v_today_start AND status IN ('sent', 'delivered');

  SELECT COUNT(*)::INT INTO v_black_screen_1h
  FROM public.product_events
  WHERE event_name IN ('startup_stall', 'black_screen_detected')
    AND created_at >= v_hour_ago;

  v_black_screen_1h := v_black_screen_1h + (
    SELECT COUNT(*)::INT FROM public.beta_feedback
    WHERE type = 'crash' AND created_at >= v_hour_ago
      AND (message ILIKE '%black%' OR COALESCE(metadata->>'source', '') ILIKE '%black%')
  );

  SELECT ROUND(AVG((properties->>'duration_ms')::NUMERIC))
  INTO v_avg_api_ms
  FROM public.product_events
  WHERE event_name = 'api_request_failed'
    AND created_at >= v_period_start
    AND (properties->>'duration_ms') ~ '^[0-9]+$';

  IF v_avg_api_ms IS NULL THEN
    SELECT ROUND(AVG((properties->>'duration_ms')::NUMERIC))
    INTO v_avg_api_ms
    FROM public.product_events
    WHERE event_name LIKE 'perf_%'
      AND created_at >= v_period_start
      AND (properties->>'duration_ms') ~ '^[0-9]+$';
  END IF;

  v_crash_rate := CASE
    WHEN (v_health->'summary'->>'crash_free_session_pct') IS NOT NULL
      THEN ROUND(100.0 - (v_health->'summary'->>'crash_free_session_pct')::NUMERIC, 2)
    ELSE NULL
  END;

  PERFORM public.sync_operations_alerts(
    (v_health->'summary'->>'login_success_rate')::NUMERIC,
    v_crash_rate,
    v_black_screen_1h,
    (v_health->'summary'->>'avg_feed_load_ms')::NUMERIC,
    v_avg_api_ms,
    (v_health->'summary'->>'push_delivery_success_rate')::NUMERIC,
    v_db_latency
  );

  SELECT COUNT(*)::INT INTO v_push_pending_retry
  FROM public.notification_deliveries
  WHERE status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= now() + interval '1 hour';

  BEGIN
    SELECT COUNT(*)::BIGINT INTO v_storage_objects FROM storage.objects;
  EXCEPTION WHEN OTHERS THEN
    v_storage_objects := NULL;
  END;

  -- Overall system health from subsystems + computed services
  FOR r IN
    SELECT * FROM (
      SELECT 'api' AS key, 'API Status' AS label,
        CASE WHEN v_avg_api_ms IS NULL OR v_avg_api_ms < 2000 THEN 'healthy'
             WHEN v_avg_api_ms < 5000 THEN 'degraded' ELSE 'down' END AS status,
        v_avg_api_ms AS latency_ms, NULL::NUMERIC AS error_rate,
        jsonb_build_object('avg_response_ms', v_avg_api_ms) AS details
      UNION ALL
      SELECT 'database', 'Database Status',
        CASE WHEN v_db_latency < 500 THEN 'healthy' WHEN v_db_latency < 1000 THEN 'degraded' ELSE 'down' END,
        v_db_latency, NULL, jsonb_build_object('probe', 'count_profiles')
      UNION ALL
      SELECT 'push', 'Push Notification Service',
        CASE WHEN (v_health->'summary'->>'push_delivery_success_rate')::NUMERIC IS NULL THEN 'unknown'
             WHEN (v_health->'summary'->>'push_delivery_success_rate')::NUMERIC >= 95 THEN 'healthy'
             WHEN (v_health->'summary'->>'push_delivery_success_rate')::NUMERIC >= 80 THEN 'degraded'
             ELSE 'down' END,
        NULL, (100 - COALESCE((v_health->'summary'->>'push_delivery_success_rate')::NUMERIC, 100)),
        jsonb_build_object('delivery_rate', v_health->'summary'->>'push_delivery_success_rate')
      UNION ALL
      SELECT 'auth', 'Authentication Status',
        CASE WHEN (v_health->'summary'->>'login_success_rate')::NUMERIC IS NULL THEN 'unknown'
             WHEN (v_health->'summary'->>'login_success_rate')::NUMERIC >= 95 THEN 'healthy'
             WHEN (v_health->'summary'->>'login_success_rate')::NUMERIC >= 85 THEN 'degraded'
             ELSE 'down' END,
        NULL, (100 - COALESCE((v_health->'summary'->>'login_success_rate')::NUMERIC, 0)),
        jsonb_build_object('failed_logins', v_health->'summary'->>'failed_login_count')
      UNION ALL
      SELECT 'image_upload', 'Image Upload Service',
        CASE WHEN (v_health->'summary'->>'photo_upload_failures')::INT = 0 THEN 'healthy'
             WHEN (v_health->'summary'->>'photo_upload_failures')::INT < 5 THEN 'degraded' ELSE 'down' END,
        NULL, (v_health->'summary'->>'photo_upload_failures')::NUMERIC,
        jsonb_build_object('failures', v_health->'summary'->>'photo_upload_failures')
      UNION ALL
      SELECT 'video_upload', 'Video Upload Service',
        CASE WHEN (v_health->'summary'->>'video_upload_failures')::INT = 0 THEN 'healthy'
             WHEN (v_health->'summary'->>'video_upload_failures')::INT < 5 THEN 'degraded' ELSE 'down' END,
        NULL, (v_health->'summary'->>'video_upload_failures')::NUMERIC,
        jsonb_build_object('failures', v_health->'summary'->>'video_upload_failures')
      UNION ALL
      SELECT 'storage', 'Storage Usage',
        'healthy', NULL, NULL,
        jsonb_build_object('object_count', v_storage_objects)
      UNION ALL
      SELECT 'background_jobs', 'Active Background Jobs',
        CASE WHEN v_push_pending_retry = 0 THEN 'healthy' WHEN v_push_pending_retry < 10 THEN 'degraded' ELSE 'down' END,
        NULL, v_push_pending_retry::NUMERIC,
        jsonb_build_object('pending_push_retries', v_push_pending_retry)
    ) computed
  LOOP
    v_rank := CASE r.status WHEN 'down' THEN 3 WHEN 'degraded' THEN 2 WHEN 'unknown' THEN 1 ELSE 0 END;
    IF v_rank > v_worst THEN
      v_worst := v_rank;
      v_overall := CASE r.status WHEN 'down' THEN 'red' WHEN 'degraded' THEN 'yellow' WHEN 'unknown' THEN 'yellow' ELSE 'green' END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'computed_at', now(),
    'preset', v_preset,
    'trend_window', v_trend,
    'period_start', v_period_start,
    'overall_system_health', v_overall,
    'beta_health', v_health,
    'system_status', (
      SELECT jsonb_build_object(
        'overall', v_overall,
        'subsystems', COALESCE(jsonb_agg(row_to_json(s)::jsonb), '[]'::jsonb)
      )
      FROM (
        SELECT sh.subsystem AS key,
          CASE sh.subsystem
            WHEN 'database' THEN 'Database Status'
            WHEN 'supabase' THEN 'API Status'
            WHEN 'notifications' THEN 'Push Notification Service'
            WHEN 'storage' THEN 'Storage Usage'
            WHEN 'app_errors' THEN 'App Errors'
            ELSE initcap(replace(sh.subsystem, '_', ' '))
          END AS label,
          sh.status,
          sh.latency_ms,
          sh.error_rate,
          sh.details,
          sh.recorded_at
        FROM (
          SELECT DISTINCT ON (subsystem) *
          FROM public.system_health_snapshots
          WHERE environment = 'production'
          ORDER BY subsystem, recorded_at DESC
        ) sh
        UNION ALL
        SELECT 'auth', 'Authentication Status',
          CASE WHEN (v_health->'summary'->>'login_success_rate')::NUMERIC IS NULL THEN 'unknown'
               WHEN (v_health->'summary'->>'login_success_rate')::NUMERIC >= 95 THEN 'healthy'
               ELSE 'degraded' END,
          NULL, NULL,
          jsonb_build_object('login_success_rate', v_health->'summary'->>'login_success_rate'),
          now()
        UNION ALL
        SELECT 'image_upload', 'Image Upload Service',
          CASE WHEN (v_health->'summary'->>'photo_upload_failures')::INT = 0 THEN 'healthy' ELSE 'degraded' END,
          NULL, (v_health->'summary'->>'photo_upload_failures')::NUMERIC,
          jsonb_build_object('failures', v_health->'summary'->>'photo_upload_failures'), now()
        UNION ALL
        SELECT 'video_upload', 'Video Upload Service',
          CASE WHEN (v_health->'summary'->>'video_upload_failures')::INT = 0 THEN 'healthy' ELSE 'degraded' END,
          NULL, (v_health->'summary'->>'video_upload_failures')::NUMERIC,
          jsonb_build_object('failures', v_health->'summary'->>'video_upload_failures'), now()
        UNION ALL
        SELECT 'background_jobs', 'Active Background Jobs',
          CASE WHEN v_push_pending_retry = 0 THEN 'healthy' ELSE 'degraded' END,
          NULL, v_push_pending_retry::NUMERIC,
          jsonb_build_object('pending_retries', v_push_pending_retry), now()
      ) s
    ),
    'live_activity', jsonb_build_object(
      'users_online', COALESCE(v_users_online, 0),
      'new_users_today', COALESCE(v_new_users_today, 0),
      'logins_today', COALESCE(v_logins_today, 0),
      'posts_today', COALESCE(v_posts_today, 0),
      'stories_today', COALESCE(v_stories_today, 0),
      'messages_today', COALESCE(v_messages_today, 0),
      'events_today', COALESCE(v_events_today, 0),
      'matches_today', COALESCE(v_matches_today, 0),
      'push_notifications_sent_today', COALESCE(v_push_sent_today, 0)
    ),
    'performance', jsonb_build_object(
      'averages', jsonb_build_object(
        'app_startup_ms', v_health->'summary'->'avg_app_startup_ms',
        'feed_load_ms', v_health->'summary'->'avg_feed_load_ms',
        'profile_load_ms', (
          SELECT ROUND(AVG((properties->>'duration_ms')::NUMERIC))
          FROM public.product_events
          WHERE event_name = 'perf_screen_load' AND created_at >= v_period_start
            AND COALESCE(properties->>'screen', '') ILIKE '%profile%'
            AND (properties->>'duration_ms') ~ '^[0-9]+$'
        ),
        'message_load_ms', (
          SELECT ROUND(AVG((properties->>'duration_ms')::NUMERIC))
          FROM public.product_events
          WHERE event_name = 'perf_messaging_load' AND created_at >= v_period_start
            AND (properties->>'duration_ms') ~ '^[0-9]+$'
        ),
        'story_load_ms', (
          SELECT ROUND(AVG((properties->>'duration_ms')::NUMERIC))
          FROM public.product_events
          WHERE event_name = 'perf_screen_load' AND created_at >= v_period_start
            AND COALESCE(properties->>'screen', '') ILIKE '%story%'
            AND (properties->>'duration_ms') ~ '^[0-9]+$'
        ),
        'image_load_ms', (
          SELECT ROUND(AVG((properties->>'duration_ms')::NUMERIC))
          FROM public.product_events
          WHERE event_name = 'perf_image_load' AND created_at >= v_period_start
            AND (properties->>'duration_ms') ~ '^[0-9]+$'
        ),
        'api_response_ms', v_avg_api_ms,
        'database_query_ms', v_db_latency
      ),
      'trends', jsonb_build_object(
        '24h', (
          SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.bucket), '[]'::jsonb)
          FROM (
            SELECT date_trunc('hour', pe.created_at) AS bucket,
              ROUND(AVG((pe.properties->>'duration_ms')::NUMERIC) FILTER (WHERE pe.event_name = 'perf_feed_load')) AS feed_load_ms,
              ROUND(AVG((pe.properties->>'duration_ms')::NUMERIC) FILTER (WHERE pe.event_name IN ('perf_app_startup', 'perf_startup'))) AS startup_ms,
              ROUND(AVG((pe.properties->>'duration_ms')::NUMERIC) FILTER (WHERE pe.event_name = 'perf_messaging_load')) AS message_load_ms,
              COUNT(*) FILTER (WHERE pe.event_name IN ('api_request_failed', 'client_error'))::INT AS errors
            FROM public.product_events pe
            WHERE pe.created_at >= now() - interval '24 hours'
            GROUP BY 1 ORDER BY 1
          ) t
        ),
        '7d', (
          SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.day), '[]'::jsonb)
          FROM (
            SELECT d.day,
              ROUND(AVG((pe.properties->>'duration_ms')::NUMERIC) FILTER (WHERE pe.event_name = 'perf_feed_load')) AS feed_load_ms,
              ROUND(AVG((pe.properties->>'duration_ms')::NUMERIC) FILTER (WHERE pe.event_name IN ('perf_app_startup', 'perf_startup'))) AS startup_ms,
              ROUND(AVG((pe.properties->>'duration_ms')::NUMERIC) FILTER (WHERE pe.event_name = 'perf_messaging_load')) AS message_load_ms,
              COUNT(*) FILTER (WHERE pe.event_name IN ('api_request_failed', 'client_error'))::INT AS errors
            FROM (
              SELECT generate_series(
                date_trunc('day', now())::date - 6,
                date_trunc('day', now())::date,
                interval '1 day'
              )::date AS day
            ) d
            LEFT JOIN public.product_events pe ON pe.created_at::date = d.day
            GROUP BY d.day ORDER BY d.day
          ) t
        ),
        '30d', (
          SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.day), '[]'::jsonb)
          FROM (
            SELECT d.day,
              ROUND(AVG((pe.properties->>'duration_ms')::NUMERIC) FILTER (WHERE pe.event_name = 'perf_feed_load')) AS feed_load_ms,
              ROUND(AVG((pe.properties->>'duration_ms')::NUMERIC) FILTER (WHERE pe.event_name IN ('perf_app_startup', 'perf_startup'))) AS startup_ms,
              COUNT(*) FILTER (WHERE pe.event_name IN ('api_request_failed', 'client_error'))::INT AS errors
            FROM (
              SELECT generate_series(
                date_trunc('day', now())::date - 29,
                date_trunc('day', now())::date,
                interval '1 day'
              )::date AS day
            ) d
            LEFT JOIN public.product_events pe ON pe.created_at::date = d.day
            GROUP BY d.day ORDER BY d.day
          ) t
        )
      )
    ),
    'push', jsonb_build_object(
      'active_subscriptions', v_health->'summary'->'active_push_subscriptions',
      'pending_permission_requests', (
        SELECT COUNT(*)::INT FROM public.product_events
        WHERE event_name = 'push_permission_prompt' AND created_at >= v_period_start
      ),
      'permission_denied_count', (
        SELECT COUNT(*)::INT FROM public.product_events
        WHERE event_name = 'push_registration_failed'
          AND COALESCE(properties->>'reason', '') ILIKE '%denied%'
          AND created_at >= v_period_start
      ),
      'successful_registrations', v_health->'summary'->'push_registration_success_count',
      'failed_registrations', v_health->'summary'->'push_registration_failed_count',
      'notifications_delivered', (
        SELECT COUNT(*)::INT FROM public.notification_deliveries
        WHERE status IN ('sent', 'delivered') AND created_at >= v_period_start
      ),
      'notifications_failed', (
        SELECT COUNT(*)::INT FROM public.notification_deliveries
        WHERE status = 'failed' AND created_at >= v_period_start
      ),
      'delivery_percentage', v_health->'summary'->'push_delivery_success_rate'
    ),
    'beta_feedback', jsonb_build_object(
      'new_bug_reports', (
        SELECT COUNT(*)::INT FROM public.beta_feedback
        WHERE type = 'bug' AND status IN ('new', 'in_progress') AND created_at >= v_period_start
      ),
      'feature_requests', (
        SELECT COUNT(*)::INT FROM public.beta_feedback
        WHERE type = 'feature' AND created_at >= v_period_start
      ),
      'general_feedback', (
        SELECT COUNT(*)::INT FROM public.beta_feedback
        WHERE type IN ('general', 'rating') AND created_at >= v_period_start
      ),
      'critical_issues', (
        SELECT COUNT(*)::INT FROM public.beta_feedback
        WHERE priority = 'critical' AND status NOT IN ('fixed', 'released', 'closed')
          AND created_at >= v_period_start
      )
    ),
    'alerts', (
      SELECT COALESCE(jsonb_agg(row_to_json(a)::jsonb ORDER BY a.triggered_at DESC), '[]'::jsonb)
      FROM public.operations_alerts a
      WHERE a.status = 'active' OR a.triggered_at >= v_period_start
      LIMIT 50
    ),
    'errors', (
      SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.occurred_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          bf.id::text AS id,
          CASE
            WHEN bf.message ILIKE '%black%' OR COALESCE(bf.metadata->>'source', '') ILIKE '%black%' THEN 'black_screen'
            WHEN bf.message ILIKE '%white%' THEN 'white_screen'
            WHEN COALESCE(bf.metadata->>'source', '') ILIKE '%feed%' THEN 'feed_load'
            WHEN COALESCE(bf.metadata->>'source', '') ILIKE '%push%' OR COALESCE(bf.metadata->>'source', '') ILIKE '%notification%' THEN 'notification'
            WHEN COALESCE(bf.metadata->>'source', '') ILIKE '%message%' OR COALESCE(bf.metadata->>'source', '') ILIKE '%chat%' THEN 'message'
            WHEN COALESCE(bf.metadata->>'source', '') ILIKE '%story%' THEN 'story'
            WHEN COALESCE(bf.metadata->>'source', '') ILIKE '%upload%' THEN 'upload'
            WHEN COALESCE(bf.metadata->>'source', '') ILIKE '%auth%' OR bf.message ILIKE '%login%' THEN 'login'
            ELSE 'runtime'
          END AS category,
          bf.created_at AS occurred_at,
          bf.user_id::text,
          bf.platform AS device,
          bf.browser,
          bf.os_version AS ios_version,
          bf.app_version,
          COALESCE(bf.metadata->>'stack', bf.metadata->>'error_message', bf.message) AS stack_trace,
          COALESCE((bf.metadata->>'retry_count')::INT, 0) AS retry_count,
          CASE WHEN bf.status IN ('fixed', 'released', 'closed') THEN 'resolved' ELSE 'active' END AS status,
          COALESCE(bf.message, bf.metadata->>'error_message', 'Unknown') AS message,
          bf.metadata
        FROM public.beta_feedback bf
        WHERE bf.type = 'crash' AND bf.created_at >= v_period_start
        UNION ALL
        SELECT
          pe.id::text,
          CASE pe.event_name
            WHEN 'auth_login_failed' THEN 'login'
            WHEN 'startup_stall' THEN 'black_screen'
            WHEN 'api_request_failed' THEN 'api'
            WHEN 'message_send_failed' THEN 'message'
            WHEN 'upload_failed' THEN 'upload'
            WHEN 'comment_failed' THEN 'comment'
            WHEN 'event_creation_failed' THEN 'event'
            ELSE 'runtime'
          END,
          pe.created_at,
          pe.user_id::text,
          pe.platform,
          NULL,
          NULL,
          pe.app_version,
          COALESCE(pe.properties->>'error', pe.properties->>'message', pe.event_name),
          COALESCE((pe.properties->>'retry_count')::INT, 0),
          'active',
          COALESCE(pe.properties->>'message', pe.event_name),
          pe.properties
        FROM public.product_events pe
        WHERE pe.event_name IN (
          'auth_login_failed', 'startup_stall', 'api_request_failed', 'client_error',
          'message_send_failed', 'upload_failed', 'comment_failed', 'event_creation_failed'
        )
          AND pe.created_at >= v_period_start
        ORDER BY occurred_at DESC
        LIMIT 100
      ) e
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_operations_dashboard(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_operations_alert(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_resolved_operations_alerts() TO authenticated;
