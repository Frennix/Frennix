-- M7.2: Executive KPIs, activity feed RPCs, analytics domain registry, activity triggers.

-- ---------------------------------------------------------------------------
-- Analytics domain registry (future business + product metrics)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.founder_analytics_domains (
  domain_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('executive', 'business', 'product', 'platform')),
  status TEXT NOT NULL DEFAULT 'placeholder'
    CHECK (status IN ('active', 'placeholder', 'deprecated')),
  milestone_code TEXT,
  drill_down_path TEXT,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.founder_metric_definitions (
  metric_key TEXT PRIMARY KEY,
  domain_key TEXT NOT NULL REFERENCES public.founder_analytics_domains(domain_key) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  emoji TEXT,
  value_type TEXT NOT NULL DEFAULT 'count'
    CHECK (value_type IN ('count', 'currency', 'percentage', 'duration_ms', 'status', 'text')),
  status TEXT NOT NULL DEFAULT 'placeholder'
    CHECK (status IN ('active', 'placeholder', 'deprecated')),
  drill_down_path TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

-- Daily business metrics (revenue, subscriptions, etc.) — populated when integrations ship
CREATE TABLE IF NOT EXISTS public.founder_business_metrics_daily (
  date DATE NOT NULL,
  environment TEXT NOT NULL DEFAULT 'production',
  revenue_cents BIGINT,
  subscription_mrr_cents BIGINT,
  premium_members INT,
  premium_trials INT,
  ambassador_referrals INT,
  creator_payout_cents BIGINT,
  ad_impressions BIGINT,
  ad_clicks BIGINT,
  marketplace_gmv_cents BIGINT,
  ai_coach_sessions INT,
  app_store_rating_avg NUMERIC(3,2),
  app_store_review_count INT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, environment)
);

INSERT INTO public.founder_analytics_domains (domain_key, display_name, category, status, milestone_code, drill_down_path, description, sort_order)
VALUES
  ('executive', 'Executive Overview', 'executive', 'active', 'M7', '/founder', 'Top-level KPIs', 0),
  ('revenue', 'Revenue', 'business', 'placeholder', 'M9', '/founder/analytics/revenue', 'Revenue and GMV', 10),
  ('subscriptions', 'Subscriptions', 'business', 'placeholder', 'M9', '/founder/analytics/subscriptions', 'Premium membership analytics', 11),
  ('ambassadors', 'Ambassadors', 'business', 'placeholder', 'M8', '/founder/analytics/ambassadors', 'Ambassador performance', 12),
  ('creator_payouts', 'Creator Payouts', 'business', 'placeholder', 'M9', '/founder/analytics/creator-payouts', 'Creator earnings', 13),
  ('advertising', 'Advertising', 'business', 'placeholder', 'M9', '/founder/analytics/advertising', 'Ad analytics', 14),
  ('marketplace', 'Marketplace', 'business', 'placeholder', 'M9', '/founder/analytics/marketplace', 'Marketplace analytics', 15),
  ('ai_coach', 'AI Coach', 'product', 'placeholder', 'M10', '/founder/analytics/ai-coach', 'AI Coach usage', 20),
  ('challenges', 'Challenges', 'product', 'placeholder', 'M4', '/founder/analytics/challenges', 'Challenge analytics', 21),
  ('events', 'Events', 'product', 'placeholder', 'M5', '/founder/analytics/events', 'Event analytics', 22),
  ('matchmaking', 'Matchmaking', 'product', 'placeholder', 'M6', '/founder/analytics/matchmaking', 'Training partner matches', 23),
  ('nutrition', 'Nutrition', 'product', 'placeholder', 'M10', '/founder/analytics/nutrition', 'Nutrition tracking', 24),
  ('referrals', 'Referrals', 'product', 'active', 'M1', '/founder/analytics/referrals', 'Referral and invite growth', 25),
  ('messaging', 'Messaging', 'product', 'active', 'M2', '/founder/analytics/messaging', 'DM volume and delivery', 26),
  ('stories', 'Stories', 'product', 'active', 'M3', '/founder/analytics/stories', 'Workout story engagement', 27),
  ('feature_adoption', 'Feature Adoption', 'product', 'placeholder', 'M7', '/founder/analytics/feature-adoption', 'Feature flag adoption', 28),
  ('crashes', 'Crash Analytics', 'platform', 'placeholder', 'M7', '/founder/analytics/crashes', 'Sentry crash data', 30),
  ('api_performance', 'API Performance', 'platform', 'placeholder', 'M7', '/founder/analytics/api-performance', 'API latency and errors', 31),
  ('database', 'Database Health', 'platform', 'placeholder', 'M7', '/founder/analytics/database', 'DB connections and latency', 32),
  ('realtime', 'Realtime Health', 'platform', 'placeholder', 'M7', '/founder/analytics/realtime', 'Messaging and presence Realtime', 33),
  ('app_store', 'App Store Reviews', 'platform', 'placeholder', 'M8', '/founder/analytics/app-store', 'Review tracking', 34)
ON CONFLICT (domain_key) DO NOTHING;

INSERT INTO public.founder_metric_definitions (metric_key, domain_key, display_name, emoji, value_type, status, drill_down_path, sort_order)
VALUES
  ('total_users', 'executive', 'Total Users', '👥', 'count', 'active', '/founder/analytics/users', 1),
  ('users_online', 'executive', 'Online Now', '🟢', 'count', 'active', '/founder/analytics/users', 2),
  ('new_signups_today', 'executive', 'New Users Today', '✨', 'count', 'active', '/founder/analytics/users', 3),
  ('dau', 'executive', 'Daily Active Users', '📊', 'count', 'active', '/founder/analytics/users', 4),
  ('wau', 'executive', 'Weekly Active Users', '📈', 'count', 'active', '/founder/analytics/users', 5),
  ('mau', 'executive', 'Monthly Active Users', '📅', 'count', 'active', '/founder/analytics/users', 6),
  ('messages_today', 'executive', 'Messages Today', '💬', 'count', 'active', '/founder/analytics/messaging', 7),
  ('workout_posts_today', 'executive', 'Workout Posts Today', '🏋️', 'count', 'active', '/founder/analytics/stories', 8),
  ('stories_today', 'executive', 'Stories Today', '📸', 'count', 'active', '/founder/analytics/stories', 9),
  ('new_matches_today', 'executive', 'New Matches', '🤝', 'count', 'active', '/founder/analytics/matchmaking', 10),
  ('active_challenges', 'executive', 'Active Challenges', '🏆', 'count', 'active', '/founder/analytics/challenges', 11),
  ('events_this_week', 'executive', 'Events This Week', '📅', 'count', 'active', '/founder/analytics/events', 12),
  ('push_delivery_rate', 'executive', 'Push Delivery', '🔔', 'percentage', 'placeholder', '/founder/analytics/notifications', 13),
  ('current_release', 'executive', 'Current Release', '🚀', 'text', 'active', '/founder/releases', 14),
  ('system_status', 'executive', 'System Status', '🟢', 'status', 'active', '/founder/platform', 15),
  ('active_errors', 'executive', 'Active Errors', '⚠️', 'count', 'active', '/founder/analytics/crashes', 16),
  ('server_health', 'executive', 'Server Health', '🖥️', 'status', 'active', '/founder/platform', 17),
  ('revenue_today', 'revenue', 'Revenue Today', '💰', 'currency', 'placeholder', '/founder/analytics/revenue', 1),
  ('mrr', 'subscriptions', 'MRR', '💳', 'currency', 'placeholder', '/founder/analytics/subscriptions', 1),
  ('premium_members', 'subscriptions', 'Premium Members', '⭐', 'count', 'placeholder', '/founder/analytics/subscriptions', 2)
ON CONFLICT (metric_key) DO NOTHING;

ALTER TABLE public.founder_analytics_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_metric_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_business_metrics_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read analytics domains" ON public.founder_analytics_domains;
CREATE POLICY "Staff read analytics domains" ON public.founder_analytics_domains
  FOR SELECT USING (public.has_staff_capability('capability_view_executive'));

DROP POLICY IF EXISTS "Staff read metric definitions" ON public.founder_metric_definitions;
CREATE POLICY "Staff read metric definitions" ON public.founder_metric_definitions
  FOR SELECT USING (public.has_staff_capability('capability_view_executive'));

DROP POLICY IF EXISTS "Staff read business metrics" ON public.founder_business_metrics_daily;
CREATE POLICY "Staff read business metrics" ON public.founder_business_metrics_daily
  FOR SELECT USING (public.has_staff_capability('capability_view_executive'));

-- ---------------------------------------------------------------------------
-- Activity triggers (core events)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_log_profile_signup_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_founder_activity(
    'user_signed_up'::public.activity_kind,
    'growth'::public.activity_category,
    'New user signed up',
    COALESCE(NEW.display_name, NEW.username, 'New user'),
    NEW.id,
    'profile',
    NEW.id,
    jsonb_build_object('username', NEW.username),
    'success',
    'production'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_founder_activity_profile_signup ON public.profiles;
CREATE TRIGGER trg_founder_activity_profile_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_profile_signup_activity();

CREATE OR REPLACE FUNCTION public.trg_log_message_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_founder_activity(
    'message_sent'::public.activity_kind,
    'messaging'::public.activity_category,
    'Message sent',
    NULL,
    NEW.sender_id,
    'message',
    NEW.id,
    jsonb_build_object('conversation_id', NEW.conversation_id),
    'info',
    'production'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_founder_activity_message ON public.messages;
CREATE TRIGGER trg_founder_activity_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_message_activity();

CREATE OR REPLACE FUNCTION public.trg_log_post_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind public.activity_kind;
  v_category public.activity_category;
  v_title TEXT;
BEGIN
  IF NEW.post_type = 'workout_update'
     OR (to_jsonb(NEW) ? 'story_milestones' AND COALESCE(cardinality(NEW.story_milestones), 0) > 0) THEN
    v_kind := 'story_uploaded';
    v_category := 'stories';
    v_title := 'Story uploaded';
  ELSE
    v_kind := 'workout_posted';
    v_category := 'posts';
    v_title := 'Workout posted';
  END IF;

  PERFORM public.log_founder_activity(
    v_kind,
    v_category,
    v_title,
    NULL,
    NEW.author_id,
    'post',
    NEW.id,
    jsonb_build_object('post_type', NEW.post_type),
    'info',
    'production'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_founder_activity_post ON public.posts;
CREATE TRIGGER trg_founder_activity_post
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_post_activity();

CREATE OR REPLACE FUNCTION public.trg_log_match_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'matched' THEN
    PERFORM public.log_founder_activity(
      'training_match'::public.activity_kind,
      'matches'::public.activity_category,
      'New training partner match',
      NULL,
      NULL,
      'match',
      NEW.id,
      '{}'::jsonb,
      'success',
      'production'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_founder_activity_match ON public.matches;
CREATE TRIGGER trg_founder_activity_match
  AFTER INSERT OR UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_match_activity();

-- ---------------------------------------------------------------------------
-- Executive dashboard RPC
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_executive_dashboard(
  p_environment TEXT DEFAULT 'production',
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_online_threshold TIMESTAMPTZ := now() - interval '3 minutes';
  v_week_start TIMESTAMPTZ := date_trunc('week', p_date::timestamptz);
  v_month_start TIMESTAMPTZ := date_trunc('month', p_date::timestamptz);
  v_release RECORD;
  v_health_status TEXT := 'healthy';
  v_server_status TEXT := 'healthy';
  v_push_rate NUMERIC;
  v_active_errors INT;
  v_kpis JSONB;
BEGIN
  IF NOT public.has_staff_capability('capability_view_executive') THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  SELECT version, git_commit, deployed_at
  INTO v_release
  FROM public.app_releases
  WHERE environment = p_environment AND status = 'production'
  ORDER BY deployed_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  SELECT status INTO v_health_status
  FROM public.system_health_snapshots
  WHERE environment = p_environment AND subsystem = 'app'
  ORDER BY recorded_at DESC LIMIT 1;

  SELECT status INTO v_server_status
  FROM public.system_health_snapshots
  WHERE environment = p_environment AND subsystem = 'supabase'
  ORDER BY recorded_at DESC LIMIT 1;

  IF v_health_status IS NULL THEN v_health_status := 'unknown'; END IF;
  IF v_server_status IS NULL THEN v_server_status := 'unknown'; END IF;

  SELECT COUNT(*)::INT INTO v_active_errors
  FROM public.product_events
  WHERE event_name = 'error'
    AND created_at >= now() - interval '15 minutes';

  v_push_rate := NULL;

  v_kpis := jsonb_build_array(
    jsonb_build_object('key', 'total_users', 'label', 'Total Users', 'emoji', '👥', 'value', (SELECT COUNT(*)::INT FROM public.profiles), 'drillDown', '/founder/analytics/users'),
    jsonb_build_object('key', 'users_online', 'label', 'Online Now', 'emoji', '🟢', 'value', (
      SELECT COUNT(*)::INT FROM public.profiles
      WHERE is_online = true AND last_seen_at >= v_online_threshold
    ), 'drillDown', '/founder/analytics/users'),
    jsonb_build_object('key', 'new_signups_today', 'label', 'New Users Today', 'emoji', '✨', 'value', (
      SELECT COUNT(*)::INT FROM public.profiles WHERE created_at::date = p_date
    ), 'drillDown', '/founder/analytics/users'),
    jsonb_build_object('key', 'dau', 'label', 'Daily Active Users', 'emoji', '📊', 'value', (
      SELECT COUNT(DISTINCT user_id)::INT FROM public.product_events
      WHERE event_name = 'daily_active_user' AND created_at::date = p_date
    ), 'drillDown', '/founder/analytics/users'),
    jsonb_build_object('key', 'wau', 'label', 'Weekly Active Users', 'emoji', '📈', 'value', (
      SELECT COUNT(DISTINCT user_id)::INT FROM public.product_events
      WHERE event_name = 'daily_active_user' AND created_at >= v_week_start
    ), 'drillDown', '/founder/analytics/users'),
    jsonb_build_object('key', 'mau', 'label', 'Monthly Active Users', 'emoji', '📅', 'value', (
      SELECT COUNT(DISTINCT user_id)::INT FROM public.product_events
      WHERE event_name = 'daily_active_user' AND created_at >= v_month_start
    ), 'drillDown', '/founder/analytics/users'),
    jsonb_build_object('key', 'messages_today', 'label', 'Messages Today', 'emoji', '💬', 'value', (
      SELECT COUNT(*)::INT FROM public.messages WHERE created_at::date = p_date
    ), 'drillDown', '/founder/analytics/messaging'),
    jsonb_build_object('key', 'workout_posts_today', 'label', 'Workout Posts Today', 'emoji', '🏋️', 'value', (
      SELECT COUNT(*)::INT FROM public.posts
      WHERE created_at::date = p_date AND post_type IN ('workout_update', 'photo', 'video')
    ), 'drillDown', '/founder/analytics/stories'),
    jsonb_build_object('key', 'stories_today', 'label', 'Stories Today', 'emoji', '📸', 'value', (
      SELECT COUNT(*)::INT FROM public.posts
      WHERE created_at::date = p_date AND post_type = 'workout_update'
    ), 'drillDown', '/founder/analytics/stories'),
    jsonb_build_object('key', 'new_matches_today', 'label', 'New Matches', 'emoji', '🤝', 'value', (
      SELECT COUNT(*)::INT FROM public.matches
      WHERE status = 'matched' AND created_at::date = p_date
    ), 'drillDown', '/founder/analytics/matchmaking'),
    jsonb_build_object('key', 'active_challenges', 'label', 'Active Challenges', 'emoji', '🏆', 'value', (
      SELECT COUNT(DISTINCT challenge_id)::INT FROM public.challenge_participants WHERE status = 'active'
    ), 'drillDown', '/founder/analytics/challenges'),
    jsonb_build_object('key', 'events_this_week', 'label', 'Events This Week', 'emoji', '📅', 'value', (
      SELECT COUNT(*)::INT FROM public.events
      WHERE starts_at >= v_week_start AND starts_at < v_week_start + interval '7 days'
    ), 'drillDown', '/founder/analytics/events'),
    jsonb_build_object('key', 'push_delivery_rate', 'label', 'Push Delivery', 'emoji', '🔔', 'value', v_push_rate, 'placeholder', true, 'drillDown', '/founder/analytics/notifications'),
    jsonb_build_object('key', 'current_release', 'label', 'Current Release', 'emoji', '🚀', 'value', COALESCE(v_release.version, '—'), 'drillDown', '/founder/releases'),
    jsonb_build_object('key', 'system_status', 'label', 'System Status', 'emoji', '●', 'value', v_health_status, 'drillDown', '/founder/platform'),
    jsonb_build_object('key', 'active_errors', 'label', 'Active Errors', 'emoji', '⚠️', 'value', v_active_errors, 'drillDown', '/founder/analytics/crashes'),
    jsonb_build_object('key', 'server_health', 'label', 'Server Health', 'emoji', '🖥️', 'value', v_server_status, 'drillDown', '/founder/platform')
  );

  RETURN jsonb_build_object(
    'environment', p_environment,
    'date', p_date,
    'computed_at', now(),
    'release', CASE WHEN v_release.version IS NOT NULL THEN jsonb_build_object(
      'version', v_release.version,
      'commit', v_release.git_commit,
      'deployed_at', v_release.deployed_at
    ) ELSE NULL END,
    'kpis', v_kpis
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Activity feed RPC (paginated, filterable, searchable)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_founder_activity_feed(
  p_since TIMESTAMPTZ DEFAULT now() - interval '24 hours',
  p_until TIMESTAMPTZ DEFAULT now(),
  p_category TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'created_at',
  p_sort_dir TEXT DEFAULT 'desc',
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25,
  p_environment TEXT DEFAULT 'production'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page INT := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size INT := LEAST(GREATEST(COALESCE(p_page_size, 25), 10), 100);
  v_offset INT := (v_page - 1) * v_page_size;
  v_total INT;
  v_items JSONB;
  v_cat public.activity_category;
BEGIN
  IF NOT public.has_staff_capability('capability_view_activity') THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  IF p_category IS NOT NULL AND p_category <> '' AND p_category <> 'all' THEN
    v_cat := p_category::public.activity_category;
  END IF;

  SELECT COUNT(*)::INT INTO v_total
  FROM public.founder_activity_events e
  WHERE e.created_at >= p_since
    AND e.created_at <= p_until
    AND e.environment = p_environment
    AND (v_cat IS NULL OR e.category = v_cat)
    AND (
      p_search IS NULL OR p_search = ''
      OR e.title ILIKE '%' || p_search || '%'
      OR COALESCE(e.summary, '') ILIKE '%' || p_search || '%'
    );

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.sort_created DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      e.id,
      e.kind,
      e.category,
      e.title,
      e.summary,
      e.severity,
      e.actor_user_id,
      e.entity_type,
      e.entity_id,
      e.metadata,
      e.environment,
      e.created_at,
      e.created_at AS sort_created
    FROM public.founder_activity_events e
    WHERE e.created_at >= p_since
      AND e.created_at <= p_until
      AND e.environment = p_environment
      AND (v_cat IS NULL OR e.category = v_cat)
      AND (
        p_search IS NULL OR p_search = ''
        OR e.title ILIKE '%' || p_search || '%'
        OR COALESCE(e.summary, '') ILIKE '%' || p_search || '%'
      )
    ORDER BY
      CASE WHEN p_sort_dir = 'asc' AND p_sort_by = 'created_at' THEN e.created_at END ASC,
      CASE WHEN p_sort_dir <> 'asc' AND p_sort_by = 'created_at' THEN e.created_at END DESC,
      e.created_at DESC
    LIMIT v_page_size OFFSET v_offset
  ) x;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'pageSize', v_page_size,
    'hasMore', (v_offset + v_page_size) < v_total
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.export_founder_activity_feed(
  p_since TIMESTAMPTZ DEFAULT now() - interval '24 hours',
  p_until TIMESTAMPTZ DEFAULT now(),
  p_category TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_environment TEXT DEFAULT 'production',
  p_limit INT DEFAULT 5000
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat public.activity_category;
  v_limit INT := LEAST(GREATEST(COALESCE(p_limit, 5000), 1), 10000);
BEGIN
  IF NOT public.has_staff_capability('capability_view_activity') THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  IF p_category IS NOT NULL AND p_category <> '' AND p_category <> 'all' THEN
    v_cat := p_category::public.activity_category;
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.created_at DESC), '[]'::jsonb)
    FROM (
      SELECT id, kind, category, title, summary, severity, created_at, environment
      FROM public.founder_activity_events e
      WHERE e.created_at >= p_since AND e.created_at <= p_until
        AND e.environment = p_environment
        AND (v_cat IS NULL OR e.category = v_cat)
        AND (
          p_search IS NULL OR p_search = ''
          OR e.title ILIKE '%' || p_search || '%'
          OR COALESCE(e.summary, '') ILIKE '%' || p_search || '%'
        )
      ORDER BY e.created_at DESC
      LIMIT v_limit
    ) e
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_founder_analytics_domains()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_staff_capability('capability_view_executive') THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(d)::jsonb ORDER BY d.sort_order), '[]'::jsonb)
    FROM public.founder_analytics_domains d
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_executive_dashboard(TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_founder_activity_feed(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, INT, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_founder_activity_feed(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_founder_analytics_domains() TO authenticated;
