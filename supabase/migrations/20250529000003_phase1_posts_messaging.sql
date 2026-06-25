-- Phase 1: workout_type on posts, media_url on messages, messages storage bucket

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS workout_type TEXT;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS media_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('messages', 'messages', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Message media publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'messages');

CREATE POLICY "Users can upload message media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'messages'
  AND auth.uid()::text = split_part(name, '/', 1)
);

CREATE POLICY "Mark messages read in own conversations" ON public.messages
  FOR UPDATE USING (
    sender_id != auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    sender_id != auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
  );
