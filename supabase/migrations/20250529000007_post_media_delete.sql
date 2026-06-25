-- Allow users to delete their own post media from storage

CREATE POLICY "Users can delete own post media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'posts'
  AND auth.uid()::text = split_part(name, '/', 1)
);
