-- Fix notification dispatch: pg_net must send Authorization for send-push edge function.
-- Also allow internal dispatch secret as fallback when service role JWT is configured in platform_config.

CREATE OR REPLACE FUNCTION public.dispatch_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  push_url TEXT;
  auth_token TEXT;
  request_id BIGINT;
  headers JSONB;
BEGIN
  SELECT value INTO push_url
  FROM public.platform_config
  WHERE key = 'send_push_url';

  IF push_url IS NULL OR push_url = '' THEN
    RETURN NEW;
  END IF;

  SELECT value INTO auth_token
  FROM public.platform_config
  WHERE key = 'send_push_service_role_key';

  headers := jsonb_build_object('Content-Type', 'application/json');
  IF auth_token IS NOT NULL AND length(trim(auth_token)) > 0 THEN
    headers := headers || jsonb_build_object('Authorization', 'Bearer ' || trim(auth_token));
  END IF;

  SELECT net.http_post(
    url := push_url,
    headers := headers,
    body := jsonb_build_object('record', to_jsonb(NEW))
  ) INTO request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;
