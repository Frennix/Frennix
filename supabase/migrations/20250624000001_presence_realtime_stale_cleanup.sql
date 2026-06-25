-- Phase 7: realtime presence updates + stale offline cleanup

-- Clients subscribe to profile presence field changes (is_online, last_seen_at).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

-- Mark users offline when heartbeats stop (e.g. force-quit). Schedule via pg_cron if available.
CREATE OR REPLACE FUNCTION public.expire_stale_presence(p_threshold interval DEFAULT interval '5 minutes')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.profiles
  SET
    is_online = false,
    updated_at = now()
  WHERE is_online = true
    AND (
      last_seen_at IS NULL
      OR last_seen_at < now() - p_threshold
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_presence(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_stale_presence(interval) TO authenticated;
