-- Startup health monitoring for Founder Platform Health dashboard.
-- Alerts when startup failure rate exceeds 0.5% of measured app launches (24h window).

CREATE OR REPLACE FUNCTION public.get_startup_health_metrics(
  p_hours INT DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ := now() - make_interval(hours => GREATEST(p_hours, 1));
  v_failures INT := 0;
  v_successes INT := 0;
  v_attempts INT := 0;
  v_rate NUMERIC := 0;
  v_threshold NUMERIC := 0.5;
  v_status TEXT := 'healthy';
  v_alert BOOLEAN := false;
BEGIN
  SELECT COUNT(*)::INT
  INTO v_failures
  FROM public.product_events
  WHERE event_name = 'startup_stall'
    AND created_at >= v_start;

  SELECT COUNT(*)::INT
  INTO v_successes
  FROM public.product_events
  WHERE event_name = 'perf_app_startup'
    AND created_at >= v_start;

  v_attempts := v_failures + v_successes;

  IF v_attempts > 0 THEN
    v_rate := ROUND((v_failures::NUMERIC / v_attempts::NUMERIC) * 100, 3);
  END IF;

  IF v_attempts >= 20 AND v_rate > v_threshold THEN
    v_status := 'degraded';
    v_alert := true;
  ELSIF v_attempts > 0 AND v_rate > (v_threshold * 2) THEN
    v_status := 'down';
    v_alert := true;
  ELSIF v_attempts = 0 THEN
    v_status := 'unknown';
  END IF;

  RETURN jsonb_build_object(
    'window_hours', p_hours,
    'failures', v_failures,
    'successes', v_successes,
    'attempts', v_attempts,
    'failure_rate_pct', v_rate,
    'alert_threshold_pct', v_threshold,
    'alert_active', v_alert,
    'status', v_status,
    'computed_at', now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_platform_health(
  p_environment TEXT DEFAULT 'production'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subsystems JSONB;
  v_overall TEXT := 'healthy';
  v_worst INT := 0;
  v_status_rank INT;
  v_startup JSONB;
  r RECORD;
BEGIN
  IF NOT public.has_staff_capability('capability_view_platform') THEN
    RAISE EXCEPTION 'Platform health access required';
  END IF;

  PERFORM public.refresh_system_health_snapshots(p_environment);

  SELECT COALESCE(jsonb_agg(row_to_json(latest)::jsonb ORDER BY latest.sort_order), '[]'::jsonb)
  INTO v_subsystems
  FROM (
    SELECT DISTINCT ON (sh.subsystem)
      sh.subsystem AS key,
      CASE sh.subsystem
        WHEN 'app_errors' THEN 'App Errors'
        WHEN 'crashes' THEN 'Crash Reports'
        WHEN 'api_latency' THEN 'API Latency'
        WHEN 'supabase' THEN 'Supabase Health'
        WHEN 'realtime_messaging' THEN 'Realtime Messaging'
        WHEN 'database' THEN 'Database Health'
        WHEN 'storage' THEN 'Storage Usage'
        WHEN 'notifications' THEN 'Notification Delivery'
        WHEN 'deployment' THEN 'Deployment Status'
        WHEN 'app' THEN 'App Health'
        ELSE initcap(replace(sh.subsystem, '_', ' '))
      END AS label,
      sh.status,
      sh.latency_ms,
      sh.error_rate,
      sh.details,
      COALESCE((sh.details->>'placeholder')::boolean, false) AS placeholder,
      sh.recorded_at,
      CASE sh.subsystem
        WHEN 'app_errors' THEN 1 WHEN 'crashes' THEN 2 WHEN 'api_latency' THEN 3
        WHEN 'supabase' THEN 4 WHEN 'realtime_messaging' THEN 5 WHEN 'database' THEN 6
        WHEN 'storage' THEN 7 WHEN 'notifications' THEN 8 WHEN 'deployment' THEN 9
        ELSE 10
      END AS sort_order
    FROM public.system_health_snapshots sh
    WHERE sh.environment = p_environment
    ORDER BY sh.subsystem, sh.recorded_at DESC
  ) latest;

  v_startup := public.get_startup_health_metrics(24);

  v_subsystems := COALESCE(v_subsystems, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'key', 'startup',
      'label', 'App Startup',
      'status', v_startup->>'status',
      'latency_ms', NULL,
      'error_rate', (v_startup->>'failure_rate_pct')::NUMERIC,
      'details', v_startup,
      'placeholder', false,
      'recorded_at', v_startup->>'computed_at'
    )
  );

  FOR r IN SELECT * FROM jsonb_to_recordset(v_subsystems) AS x(status TEXT)
  LOOP
    v_status_rank := CASE r.status
      WHEN 'down' THEN 3 WHEN 'degraded' THEN 2 WHEN 'unknown' THEN 1 ELSE 0
    END;
    IF v_status_rank > v_worst THEN v_worst := v_status_rank; END IF;
  END LOOP;

  v_overall := CASE v_worst
    WHEN 3 THEN 'down' WHEN 2 THEN 'degraded' WHEN 1 THEN 'unknown' ELSE 'healthy'
  END;

  RETURN jsonb_build_object(
    'environment', p_environment,
    'computed_at', now(),
    'overall_status', v_overall,
    'subsystems', v_subsystems
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_startup_health_metrics(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_health(TEXT) TO authenticated;
