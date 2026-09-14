-- Reels iPhone HEVC/MOV clips commonly exceed the 50 MiB standard-upload
-- protocol. Raise only the public posts bucket so resumable TUS uploads can
-- accept Reels up to 150 MiB. Stories and other buckets stay unchanged.
UPDATE storage.buckets
SET file_size_limit = 157286400
WHERE id = 'posts';
