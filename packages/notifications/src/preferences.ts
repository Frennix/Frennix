import type { NotificationType } from "@frennix/types";
import type { ExtendedNotificationType } from "./types";

/** Maps notification types to user preference keys in notification_preferences table. */
export type NotificationPreferenceKey =
  | "messages"
  | "likes"
  | "comments"
  | "replies"
  | "mentions"
  | "followers"
  | "matches"
  | "events"
  | "challenges"
  | "stories"
  | "run_clubs"
  | "groups"
  | "system_announcements"
  | "marketing";

export const NOTIFICATION_PREFERENCE_DEFAULTS: Record<NotificationPreferenceKey, boolean> = {
  messages: true,
  likes: true,
  comments: true,
  replies: true,
  mentions: true,
  followers: true,
  matches: true,
  events: true,
  challenges: true,
  stories: true,
  run_clubs: true,
  groups: true,
  system_announcements: true,
  marketing: false,
};

export function preferenceKeyForType(type: ExtendedNotificationType): NotificationPreferenceKey | null {
  switch (type) {
    case "message":
    case "group_message":
      return "messages";
    case "like":
    case "reaction":
      return "likes";
    case "comment":
      return "comments";
    case "comment_reply":
      return "replies";
    case "mention":
    case "story_mention":
      return "mentions";
    case "follow":
    case "friend_request":
      return "followers";
    case "match":
    case "trainer_connection_request":
    case "trainer_connection_accepted":
    case "coach_notification":
      return "matches";
    case "event_join":
    case "event_invite":
    case "event_reminder":
    case "training_session_invite":
    case "training_session_accepted":
    case "training_session_reminder":
    case "workout_reminder":
      return "events";
    case "challenge_join":
    case "challenge_invite":
    case "challenge_reminder":
    case "challenge_progress":
      return "challenges";
    case "story_reaction":
    case "story_reply":
    case "story_challenge_join":
    case "story_train_invite":
      return "stories";
    case "post_share":
      return "likes";
    case "system_announcement":
    case "app_update":
    case "ai_coach":
    case "nutrition_reminder":
    case "habit_reminder":
    case "achievement_badge":
    case "daily_streak_reminder":
    case "weekly_recap":
    case "monthly_progress_summary":
      return "system_announcements";
    case "group_invite":
      return "groups";
    case "run_club_announcement":
      return "run_clubs";
    case "marketing":
      return "marketing";
    case "referral_reward":
      return "system_announcements";
    default:
      return null;
  }
}

/** Bridge legacy profiles.notification_preferences keys to new table keys. */
export function legacyPreferenceKeyForType(type: NotificationType): string {
  switch (type) {
    case "message":
      return "message";
    case "like":
    case "reaction":
      return "like";
    case "comment":
      return "comment";
    case "comment_reply":
      return "comment_reply";
    case "follow":
      return "follow";
    case "match":
      return "match";
    case "event_join":
      return "event_join";
    case "event_invite":
      return "event_invite";
    case "challenge_join":
      return "challenge_join";
    case "challenge_invite":
      return "challenge_invite";
    case "post_share":
      return "post_share";
    case "trainer_connection_request":
      return "trainer_connection_request";
    case "trainer_connection_accepted":
      return "trainer_connection_accepted";
    case "story_reaction":
    case "story_reply":
    case "story_mention":
    case "story_challenge_join":
    case "story_train_invite":
      return "story_reaction";
    default:
      return type;
  }
}
