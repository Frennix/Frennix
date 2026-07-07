-- Phase 3b: User-facing notification categories (Run Clubs, Groups, Marketing)
-- Engine remains UI-independent — preferences are data columns only.

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS run_clubs BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS groups BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS marketing BOOLEAN NOT NULL DEFAULT false;

-- Marketing notification type (optional category — off by default)
CREATE OR REPLACE FUNCTION public.is_valid_notification_type(p_type TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_type = ANY (ARRAY[
    'follow', 'message', 'group_message', 'like', 'reaction', 'comment', 'comment_reply', 'mention',
    'match', 'trainer_connection_request', 'trainer_connection_accepted', 'coach_notification',
    'group_invite', 'challenge_reminder', 'challenge_join', 'challenge_invite', 'challenge_progress',
    'event_join', 'event_invite', 'event_reminder', 'run_club_announcement',
    'post_share', 'story_train_invite', 'story_reaction', 'story_reply',
    'story_mention', 'story_challenge_join', 'training_session_invite',
    'training_session_accepted', 'training_session_reminder', 'workout_reminder',
    'system_announcement', 'app_update', 'friend_request', 'referral_reward',
    'marketing',
    'ai_coach', 'nutrition_reminder', 'habit_reminder', 'achievement_badge',
    'daily_streak_reminder', 'weekly_recap', 'monthly_progress_summary'
  ]::text[]);
$$;

COMMENT ON COLUMN public.notification_preferences.run_clubs IS
  'Run club announcements and club activity push/in-app alerts.';
COMMENT ON COLUMN public.notification_preferences.groups IS
  'Group invites and group activity notifications.';
COMMENT ON COLUMN public.notification_preferences.marketing IS
  'Optional promotional and marketing communications. Default off.';
