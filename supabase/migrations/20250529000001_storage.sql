-- Storage buckets for Frennix

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Post media publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'posts');

CREATE POLICY "Users can upload post media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'posts'
  AND auth.uid()::text = split_part(name, '/', 1)
);
