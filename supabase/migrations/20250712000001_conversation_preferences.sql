-- Conversation inbox management: delete-for-me, pin, mute, mark-unread, message replies.

CREATE TABLE IF NOT EXISTS public.conversation_user_deletions (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_user_deletions_user
  ON public.conversation_user_deletions (user_id);

ALTER TABLE public.conversation_user_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own conversation deletions"
  ON public.conversation_user_deletions
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Delete conversations for self"
  ON public.conversation_user_deletions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_id
        AND cm.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.conversation_user_deletions IS
  'Per-user conversation delete (remove from inbox permanently for this user).';

CREATE TABLE IF NOT EXISTS public.conversation_user_preferences (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ,
  muted_at TIMESTAMPTZ,
  marked_unread_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_user_preferences_user
  ON public.conversation_user_preferences (user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_user_preferences_pinned
  ON public.conversation_user_preferences (user_id, pinned_at DESC)
  WHERE pinned_at IS NOT NULL;

ALTER TABLE public.conversation_user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage own conversation preferences"
  ON public.conversation_user_preferences
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_user_preferences.conversation_id
        AND cm.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.conversation_user_preferences IS
  'Per-user conversation inbox preferences: pin (max 3 enforced in app), mute, mark unread.';

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON public.messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;
