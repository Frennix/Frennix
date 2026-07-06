-- App-wide performance indexes for feed membership, groups, and inbox lookups.

CREATE INDEX IF NOT EXISTS idx_conversation_members_user
  ON public.conversation_members (user_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower
  ON public.follows (follower_id);

CREATE INDEX IF NOT EXISTS idx_group_members_user
  ON public.group_members (user_id);

CREATE INDEX IF NOT EXISTS idx_group_members_group
  ON public.group_members (group_id);

CREATE INDEX IF NOT EXISTS idx_likes_post
  ON public.likes (post_id);

CREATE INDEX IF NOT EXISTS idx_comments_post
  ON public.comments (post_id);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_message_user_deletions_user_message
  ON public.message_user_deletions (user_id, message_id);
