-- User-initiated account deletion.
-- FILE ONLY until a production rollout is explicitly approved.
-- Do not apply this migration to the production project.
--
-- Recoverable order: delete auth.users first. File cleanup uses the
-- Supabase Storage API in a trusted server process
-- (packages/api/src/account-deletion-server.ts and
-- supabase/functions/delete-own-account).
-- Do not DELETE FROM storage.objects. File cleanup uses the Storage API
-- in the trusted server process. Do not swallow cleanup errors.
-- Auth delete is admin.auth.admin.deleteUser in delete-own-account.
-- DELETE FROM auth.users WHERE id = uid is not granted to signed-in clients.

-- Drop policies this feature previously added. Service-role cleanup does not need them.
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own message media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own feedback attachments" ON storage.objects;

CREATE TABLE IF NOT EXISTS public.account_deletion_jobs (
  user_id uuid PRIMARY KEY,
  status text NOT NULL,
  buckets_completed text[] NOT NULL DEFAULT '{}',
  buckets_failed text[] NOT NULL DEFAULT '{}',
  files_removed integer NOT NULL DEFAULT 0,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_deletion_jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RAISE EXCEPTION 'Account deletion must use the delete-own-account function';
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_own_account() FROM anon;
REVOKE ALL ON FUNCTION public.delete_own_account() FROM authenticated;

COMMENT ON FUNCTION public.delete_own_account() IS
  'Rejected for clients. Account deletion uses the delete-own-account Edge Function.';
