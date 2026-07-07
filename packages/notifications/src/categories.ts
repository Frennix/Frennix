import type { NotificationType } from "@frennix/types";
import type { ExtendedNotificationType, NotificationCategory } from "./types";

const MESSAGE_TYPES = new Set<string>(["message", "group_message"]);

const SOCIAL_TYPES = new Set<string>([
  "follow",
  "like",
  "reaction",
  "comment",
  "comment_reply",
  "mention",
  "match",
  "post_share",
  "friend_request",
  "story_reaction",
  "story_reply",
  "story_mention",
  "story_challenge_join",
  "story_train_invite",
  "trainer_connection_request",
  "trainer_connection_accepted",
  "coach_notification",
  "group_invite",
  "referral_reward",
  "run_club_announcement",
  "marketing",
]);

const EVENT_TYPES = new Set<string>([
  "event_join",
  "event_invite",
  "event_reminder",
  "training_session_invite",
  "training_session_accepted",
  "training_session_reminder",
  "workout_reminder",
]);

const CHALLENGE_TYPES = new Set<string>([
  "challenge_join",
  "challenge_invite",
  "challenge_reminder",
  "challenge_progress",
]);

const SYSTEM_TYPES = new Set<string>([
  "system_announcement",
  "app_update",
  "ai_coach",
  "nutrition_reminder",
  "habit_reminder",
  "achievement_badge",
  "daily_streak_reminder",
  "weekly_recap",
  "monthly_progress_summary",
]);

export function getNotificationCategory(type: ExtendedNotificationType): NotificationCategory {
  if (MESSAGE_TYPES.has(type)) return "messages";
  if (EVENT_TYPES.has(type)) return "events";
  if (CHALLENGE_TYPES.has(type)) return "challenges";
  if (SYSTEM_TYPES.has(type)) return "system";
  if (SOCIAL_TYPES.has(type)) return "social";
  return "social";
}

export function notificationTypesForCategory(category: NotificationCategory): string[] {
  switch (category) {
    case "messages":
      return [...MESSAGE_TYPES];
    case "events":
      return [...EVENT_TYPES];
    case "challenges":
      return [...CHALLENGE_TYPES];
    case "system":
      return [...SYSTEM_TYPES];
    case "social":
      return [...SOCIAL_TYPES];
    default:
      return [];
  }
}

export function isKnownNotificationType(type: string): type is NotificationType | ExtendedNotificationType {
  return (
    MESSAGE_TYPES.has(type) ||
    SOCIAL_TYPES.has(type) ||
    EVENT_TYPES.has(type) ||
    CHALLENGE_TYPES.has(type) ||
    SYSTEM_TYPES.has(type)
  );
}
