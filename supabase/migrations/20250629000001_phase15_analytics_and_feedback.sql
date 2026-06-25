-- Phase 15: Product analytics (Supabase events) + feedback enhancements

CREATE TABLE IF NOT EXISTS public.product_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  app_version TEXT,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_events_name_created
  ON public.product_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_events_user_created
  ON public.product_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_events_day
  ON public.product_events (((created_at AT TIME ZONE 'UTC')::date), event_name);

ALTER TABLE public.product_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own product events"
  ON public.product_events FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Admins read product events"
  ON public.product_events FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE OR REPLACE FUNCTION public.log_product_event(
  p_user_id UUID,
  p_event_name TEXT,
  p_properties JSONB DEFAULT '{}'::jsonb,
  p_app_version TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.product_events (user_id, event_name, properties, app_version, platform)
  VALUES (p_user_id, p_event_name, COALESCE(p_properties, '{}'::jsonb), p_app_version, p_platform);
END;
$$;

CREATE OR REPLACE FUNCTION public.track_product_event(
  p_event_name TEXT,
  p_properties JSONB DEFAULT '{}'::jsonb,
  p_app_version TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL
)
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

  PERFORM public.log_product_event(v_user_id, p_event_name, p_properties, p_app_version, p_platform);
END;
$$;

CREATE OR REPLACE FUNCTION public.track_daily_active_user(
  p_app_version TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.product_events
    WHERE user_id = v_user_id
      AND event_name = 'daily_active_user'
      AND created_at::date = CURRENT_DATE
  ) THEN
    RETURN;
  END IF;

  PERFORM public.log_product_event(
    v_user_id,
    'daily_active_user',
    jsonb_build_object('date', CURRENT_DATE::text),
    p_app_version,
    p_platform
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_product_analytics_summary(p_days INT DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin UUID := auth.uid();
  v_days INT := LEAST(GREATEST(COALESCE(p_days, 7), 1), 90);
  v_since TIMESTAMPTZ := now() - (v_days || ' days')::interval;
BEGIN
  IF v_admin IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = v_admin AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_build_object(
    'days', v_days,
    'since', v_since,
    'signups', (
      SELECT COUNT(*)::int FROM public.product_events
      WHERE event_name = 'user_signed_up' AND created_at >= v_since
    ),
    'daily_active_users', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('date', day, 'count', cnt) ORDER BY day DESC), '[]'::jsonb)
      FROM (
        SELECT created_at::date AS day, COUNT(DISTINCT user_id)::int AS cnt
        FROM public.product_events
        WHERE event_name = 'daily_active_user' AND created_at >= v_since
        GROUP BY created_at::date
      ) d
    ),
    'daily_active_users_total', (
      SELECT COUNT(DISTINCT user_id)::int FROM public.product_events
      WHERE event_name = 'daily_active_user' AND created_at >= v_since
    ),
    'training_partner_matches', (
      SELECT COUNT(*)::int FROM public.product_events
      WHERE event_name = 'training_partner_match' AND created_at >= v_since
    ),
    'trainer_connection_requests', (
      SELECT COUNT(*)::int FROM public.product_events
      WHERE event_name = 'trainer_connection_requested' AND created_at >= v_since
    ),
    'trainer_connections_accepted', (
      SELECT COUNT(*)::int FROM public.product_events
      WHERE event_name = 'trainer_connection_accepted' AND created_at >= v_since
    ),
    'messages_sent', (
      SELECT COUNT(*)::int FROM public.product_events
      WHERE event_name = 'message_sent' AND created_at >= v_since
    ),
    'events_joined', (
      SELECT COUNT(*)::int FROM public.product_events
      WHERE event_name = 'event_joined' AND created_at >= v_since
    ),
    'perf_events', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'event_name', event_name,
        'count', cnt,
        'avg_ms', avg_ms
      )), '[]'::jsonb)
      FROM (
        SELECT
          event_name,
          COUNT(*)::int AS cnt,
          ROUND(AVG(NULLIF((properties->>'duration_ms')::numeric, 0)), 0) AS avg_ms
        FROM public.product_events
        WHERE event_name LIKE 'perf_%' AND created_at >= v_since
        GROUP BY event_name
      ) p
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_product_event(TEXT, JSONB, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_daily_active_user(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_product_analytics_summary(INT) TO authenticated;

-- Server-side analytics triggers (reliable business metrics)

CREATE OR REPLACE FUNCTION public.analytics_on_profile_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.log_product_event(NEW.id, 'user_signed_up', '{}'::jsonb, NULL, NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS product_analytics_profile_created ON public.profiles;
CREATE TRIGGER product_analytics_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.analytics_on_profile_created();

CREATE OR REPLACE FUNCTION public.analytics_on_training_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'matched' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'matched') THEN
    PERFORM public.log_product_event(NEW.user_a, 'training_partner_match', jsonb_build_object('match_id', NEW.id), NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS product_analytics_training_match ON public.matches;
CREATE TRIGGER product_analytics_training_match
  AFTER INSERT OR UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.analytics_on_training_match();

DROP TRIGGER IF EXISTS product_analytics_trainer_connection ON public.trainer_connections;
DROP FUNCTION IF EXISTS public.analytics_on_trainer_connection();

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trainer_connections'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.analytics_on_trainer_connection()
      RETURNS TRIGGER AS $body$
      BEGIN
        IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
          PERFORM public.log_product_event(
            NEW.client_id,
            'trainer_connection_requested',
            jsonb_build_object('connection_id', NEW.id, 'trainer_id', NEW.trainer_id),
            NULL, NULL
          );
        ELSIF TG_OP = 'UPDATE' AND NEW.status = 'connected' AND OLD.status IS DISTINCT FROM 'connected' THEN
          PERFORM public.log_product_event(
            NEW.trainer_id,
            'trainer_connection_accepted',
            jsonb_build_object('connection_id', NEW.id, 'client_id', NEW.client_id),
            NULL, NULL
          );
        END IF;
        RETURN NEW;
      END;
      $body$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
    $fn$;

    CREATE TRIGGER product_analytics_trainer_connection
      AFTER INSERT OR UPDATE ON public.trainer_connections
      FOR EACH ROW EXECUTE FUNCTION public.analytics_on_trainer_connection();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.analytics_on_message_sent()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.log_product_event(
    NEW.sender_id,
    'message_sent',
    jsonb_build_object('conversation_id', NEW.conversation_id),
    NULL, NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS product_analytics_message_sent ON public.messages;
CREATE TRIGGER product_analytics_message_sent
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.analytics_on_message_sent();

CREATE OR REPLACE FUNCTION public.analytics_on_event_joined()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.log_product_event(
    NEW.user_id,
    'event_joined',
    jsonb_build_object('event_id', NEW.event_id),
    NULL, NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS product_analytics_event_joined ON public.event_attendees;
CREATE TRIGGER product_analytics_event_joined
  AFTER INSERT ON public.event_attendees
  FOR EACH ROW EXECUTE FUNCTION public.analytics_on_event_joined();

-- Beta feedback enhancements

ALTER TABLE public.beta_feedback
  ADD COLUMN IF NOT EXISTS feature_area TEXT,
  ADD COLUMN IF NOT EXISTS screen_path TEXT,
  ADD COLUMN IF NOT EXISTS app_version TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.beta_feedback DROP CONSTRAINT IF EXISTS beta_feedback_type_check;
ALTER TABLE public.beta_feedback ADD CONSTRAINT beta_feedback_type_check
  CHECK (type IN ('bug', 'feature', 'general', 'rating'));

ALTER TABLE public.beta_feedback DROP CONSTRAINT IF EXISTS beta_feedback_message_or_rating;
ALTER TABLE public.beta_feedback ADD CONSTRAINT beta_feedback_message_or_rating CHECK (
  (type = 'rating' AND rating IS NOT NULL)
  OR (type IN ('bug', 'feature', 'general') AND message IS NOT NULL AND length(trim(message)) > 0)
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-attachments', 'feedback-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read feedback attachments" ON storage.objects;
CREATE POLICY "Public read feedback attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'feedback-attachments');

DROP POLICY IF EXISTS "Users upload feedback attachments" ON storage.objects;
CREATE POLICY "Users upload feedback attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'feedback-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
