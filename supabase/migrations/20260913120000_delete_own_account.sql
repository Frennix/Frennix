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

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = split_part(name, '/', 1)
);

DROP POLICY IF EXISTS "Users can delete own message media" ON storage.objects;
CREATE POLICY "Users can delete own message media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'messages'
  AND auth.uid()::text = split_part(name, '/', 1)
);

DROP POLICY IF EXISTS "Users can delete own feedback attachments" ON storage.objects;
CREATE POLICY "Users can delete own feedback attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'feedback-attachments'
  AND auth.uid()::text = split_part(name, '/', 1)
);

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
DECLARE
  uid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM auth.users WHERE id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account could not be deleted';
  END IF;

  RETURN jsonb_build_object('ok', true, 'user_id', uid);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_own_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

COMMENT ON FUNCTION public.delete_own_account() IS
  'Deletes the authenticated auth user only. Owned files are removed by the trusted Storage API process.';
