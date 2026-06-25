-- Automatically dispatch push notifications when in-app notification rows are created.
-- Requires pg_net extension (enabled on Supabase hosted projects).

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.platform_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO public.platform_config (key, value)
VALUES (
  'send_push_url',
  'https://wkrwncovmpsveatlrqel.supabase.co/functions/v1/send-push'
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- No policies: only service role / triggers can read via SECURITY DEFINER functions

CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  push_url TEXT;
  request_id BIGINT;
BEGIN
  SELECT value INTO push_url
  FROM public.platform_config
  WHERE key = 'send_push_url';

  IF push_url IS NULL OR push_url = '' THEN
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := push_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('record', to_jsonb(NEW))
  ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_notification_push_dispatch ON public.notifications;
CREATE TRIGGER on_notification_push_dispatch
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_push_notification();
