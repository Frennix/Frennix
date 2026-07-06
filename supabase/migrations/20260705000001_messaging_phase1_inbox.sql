-- Messaging Phase 1: RLS fixes for upsert/clear, delete-for-everyone on messages.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS deleted_for_everyone_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_deleted_for_everyone
  ON public.messages (conversation_id, created_at)
  WHERE deleted_for_everyone_at IS NOT NULL;

COMMENT ON COLUMN public.messages.deleted_for_everyone_at IS
  'When set by the sender, message content is hidden for all conversation members.';

-- Sender may retract a message for all participants (separate from mark-read updates).
CREATE POLICY "Delete own messages for everyone"
  ON public.messages
  FOR UPDATE
  USING (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  )
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

-- Upsert on per-user junction tables requires UPDATE (and clear-on-send uses DELETE).
CREATE POLICY "Update own message deletions"
  ON public.message_user_deletions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      INNER JOIN public.conversation_members cm
        ON cm.conversation_id = m.conversation_id
      WHERE m.id = message_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Remove own message deletions"
  ON public.message_user_deletions
  FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Update own conversation deletions"
  ON public.conversation_user_deletions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_user_deletions.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Remove own conversation deletions"
  ON public.conversation_user_deletions
  FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Update own conversation hides"
  ON public.conversation_user_hides
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_user_hides.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Remove own conversation hides"
  ON public.conversation_user_hides
  FOR DELETE
  USING (user_id = auth.uid());
