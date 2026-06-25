-- Fix avatar storage UPDATE policy (WITH CHECK required for upsert/update on some Supabase versions)

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = split_part(name, '/', 1)
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = split_part(name, '/', 1)
);
