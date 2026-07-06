-- Messaging inbox performance: speed up unread counts and member lookups.

CREATE INDEX IF NOT EXISTS idx_messages_unread_by_conversation
  ON public.messages (conversation_id, sender_id)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation
  ON public.conversation_members (conversation_id, user_id);
