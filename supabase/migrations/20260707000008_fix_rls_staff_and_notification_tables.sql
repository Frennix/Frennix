-- Fix Supabase Security Advisor: RLS disabled in public.
--
-- Advisor findings (pre-fix):
--   public.staff_role_capabilities  — no RLS
--   public.notification_push_groups — no RLS
--
-- Note: there is no table public.notification_push_subscriptions.
-- Push device rows live in public.notification_subscriptions (already had RLS;
-- policies are re-applied here idempotently for clarity).

-- ---------------------------------------------------------------------------
-- 1. staff_role_capabilities
--    Reference matrix for staff permissions. The app never queries this table
--    directly — only SECURITY DEFINER RPCs (has_staff_capability, etc.).
--    Enable RLS with no authenticated/anon policies = deny direct PostgREST access.
-- ---------------------------------------------------------------------------

ALTER TABLE public.staff_role_capabilities ENABLE ROW LEVEL SECURITY;

-- Drop any legacy permissive policies if they exist.
DROP POLICY IF EXISTS "Staff read role capabilities" ON public.staff_role_capabilities;
DROP POLICY IF EXISTS "Public read staff role capabilities" ON public.staff_role_capabilities;

REVOKE ALL ON public.staff_role_capabilities FROM anon, authenticated;

-- service_role retains full access (bypasses RLS for admin/edge operations).

-- ---------------------------------------------------------------------------
-- 2. notification_push_groups
--    Internal message-push grouping for the dispatch worker. Not exposed to
--    clients today; only service_role / SECURITY DEFINER paths should touch it.
-- ---------------------------------------------------------------------------

ALTER TABLE public.notification_push_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification push groups" ON public.notification_push_groups;

REVOKE ALL ON public.notification_push_groups FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. notification_subscriptions
--    Web push / Expo device endpoints. Clients use upsert_web_push_subscription
--    RPC (SECURITY DEFINER) but direct table access must still be user-scoped.
-- ---------------------------------------------------------------------------

ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notification subscriptions" ON public.notification_subscriptions;

CREATE POLICY "Users select own notification subscriptions"
  ON public.notification_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own notification subscriptions"
  ON public.notification_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own notification subscriptions"
  ON public.notification_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own notification subscriptions"
  ON public.notification_subscriptions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Keep default authenticated grants so RLS policies can allow scoped access.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_subscriptions TO authenticated;
