import type { ExtendedNotificationType } from "./types";
import type { NotificationPreferenceKey } from "./preferences";

/**
 * Founder-facing notification categories — maps to notification_preferences columns.
 * UI layer uses this; engine uses preferenceKeyForType() per notification type.
 */
export type UserNotificationCategoryId =
  | "messages"
  | "likes"
  | "comments"
  | "follows"
  | "matches"
  | "events"
  | "stories"
  | "challenges"
  | "run_clubs"
  | "groups"
  | "system_announcements"
  | "marketing";

export type UserNotificationCategory = {
  id: UserNotificationCategoryId;
  title: string;
  description: string;
  /** Preference column keys toggled together when user changes this category. */
  preferenceKeys: NotificationPreferenceKey[];
  optional?: boolean;
};

export const USER_NOTIFICATION_CATEGORIES: UserNotificationCategory[] = [
  {
    id: "messages",
    title: "Direct Messages",
    description: "Direct messages and training partner chats",
    preferenceKeys: ["messages"],
  },
  {
    id: "likes",
    title: "Likes",
    description: "Likes, reactions, and post shares",
    preferenceKeys: ["likes"],
  },
  {
    id: "comments",
    title: "Comments",
    description: "Comments, replies, and mentions on posts",
    preferenceKeys: ["comments", "replies", "mentions"],
  },
  {
    id: "follows",
    title: "Follows",
    description: "When someone follows you or sends a friend request",
    preferenceKeys: ["followers"],
  },
  {
    id: "matches",
    title: "Matches",
    description: "Training matches and coach connection updates",
    preferenceKeys: ["matches"],
  },
  {
    id: "events",
    title: "Events",
    description: "Event invites, joins, and training reminders",
    preferenceKeys: ["events"],
  },
  {
    id: "stories",
    title: "Stories",
    description: "Story likes, replies, and mentions",
    preferenceKeys: ["stories"],
  },
  {
    id: "challenges",
    title: "Challenges",
    description: "Challenge invites and progress updates",
    preferenceKeys: ["challenges"],
  },
  {
    id: "run_clubs",
    title: "Run Clubs",
    description: "Run club announcements and club activity",
    preferenceKeys: ["run_clubs"],
  },
  {
    id: "groups",
    title: "Groups",
    description: "Group invites and group activity",
    preferenceKeys: ["groups"],
  },
  {
    id: "system_announcements",
    title: "System Announcements",
    description: "Product updates, achievements, referrals, and important alerts",
    preferenceKeys: ["system_announcements"],
  },
  {
    id: "marketing",
    title: "Marketing",
    description: "Optional promotional messages and partner offers",
    preferenceKeys: ["marketing"],
    optional: true,
  },
];

/** Maps engine notification types → user category for filtering and analytics. */
export function userCategoryForType(type: ExtendedNotificationType): UserNotificationCategoryId {
  switch (type) {
    case "message":
    case "group_message":
      return "messages";
    case "like":
    case "reaction":
    case "post_share":
      return "likes";
    case "comment":
    case "comment_reply":
    case "mention":
      return "comments";
    case "follow":
    case "friend_request":
      return "follows";
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
    case "story_reaction":
    case "story_reply":
    case "story_mention":
    case "story_challenge_join":
    case "story_train_invite":
      return "stories";
    case "challenge_join":
    case "challenge_invite":
    case "challenge_reminder":
    case "challenge_progress":
      return "challenges";
    case "run_club_announcement":
      return "run_clubs";
    case "group_invite":
      return "groups";
    case "marketing":
      return "marketing";
    case "system_announcement":
    case "app_update":
    case "referral_reward":
    case "achievement_badge":
    case "ai_coach":
    case "nutrition_reminder":
    case "habit_reminder":
    case "daily_streak_reminder":
    case "weekly_recap":
    case "monthly_progress_summary":
      return "system_announcements";
    default:
      return "system_announcements";
  }
}
