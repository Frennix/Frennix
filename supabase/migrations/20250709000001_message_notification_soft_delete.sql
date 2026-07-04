-- User-controlled soft delete for messages (delete-for-me) and notifications.

-- Per-user message hiding — message row stays for the other participant.
CREATE TABLE IF NOT EXISTS public.message_user_deletions (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_user_deletions_user
  ON public.message_user_deletions (user_id);

ALTER TABLE public.message_user_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own message deletions"
  ON public.message_user_deletions
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Hide messages for self"
  ON public.message_user_deletions
  FOR INSERT
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

COMMENT ON TABLE public.message_user_deletions IS
  'Per-user message soft delete (delete for me). Rows remain for other conversation members.';

-- Notification soft delete — row kept for analytics; hidden from recipient UI.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_user_active
  ON public.notifications (user_id, created_at DESC)
  WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS "View own notifications" ON public.notifications;

CREATE POLICY "View own notifications"
  ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid() AND deleted_at IS NULL);

COMMENT ON COLUMN public.notifications.deleted_at IS
  'When set, notification is dismissed for this user (soft delete).';
