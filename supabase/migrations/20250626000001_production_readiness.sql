-- Phase 13: production readiness — stale presence cron + match_swipes RLS hardening
-- Does NOT modify matches, messages, notifications, or discovery logic.

-- 1. Schedule stale presence cleanup (profiles.is_online only)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $cron$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'expire-stale-presence'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'expire-stale-presence',
    '*/5 * * * *',
    $$SELECT public.expire_stale_presence(interval '5 minutes')$$
  );
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'pg_cron not available — schedule expire_stale_presence manually in Supabase Dashboard';
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule expire_stale_presence: %', SQLERRM;
END;
$cron$;

-- 2. Security: swipes must go through record_match_swipe RPC (SECURITY DEFINER).
--    Direct client INSERT/UPDATE/DELETE bypassed business rules.
DROP POLICY IF EXISTS "Users manage own swipes" ON public.match_swipes;

CREATE POLICY "Users view own swipes"
  ON public.match_swipes
  FOR SELECT
  USING (swiper_id = auth.uid());

-- matches: SELECT-only policy already enforced (mutations via RPC/triggers).
-- notifications: SELECT/UPDATE own rows; INSERT via SECURITY DEFINER triggers only.
