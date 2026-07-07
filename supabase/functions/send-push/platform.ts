/**
 * Shared dispatch logic for send-push edge function.
 * Keep in sync with @frennix/notifications preferences + catalog.
 */

export type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";

export type UserPrefs = {
  push_enabled: boolean;
  messages: boolean;
  likes: boolean;
  comments: boolean;
  replies: boolean;
  mentions: boolean;
  followers: boolean;
  matches: boolean;
  events: boolean;
  challenges: boolean;
  stories: boolean;
  run_clubs: boolean;
  groups: boolean;
  system_announcements: boolean;
  marketing: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
};

export const DEFAULT_PREFS: UserPrefs = {
  push_enabled: true,
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
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
  timezone: "UTC",
};

export const MESSAGE_GROUPING_WINDOW_MS = 45_000;

/** All notification types supported by unified dispatch. */
export const DISPATCH_TYPES = [
  "message",
  "group_message",
  "like",
  "reaction",
  "comment",
  "comment_reply",
  "mention",
  "follow",
  "friend_request",
  "match",
  "story_reaction",
  "story_reply",
  "story_mention",
  "story_challenge_join",
  "story_train_invite",
  "event_invite",
  "event_reminder",
  "event_join",
  "training_session_invite",
  "training_session_accepted",
  "training_session_reminder",
  "workout_reminder",
  "group_invite",
  "challenge_invite",
  "challenge_join",
  "challenge_progress",
  "challenge_reminder",
  "post_share",
  "trainer_connection_request",
  "trainer_connection_accepted",
  "coach_notification",
  "run_club_announcement",
  "referral_reward",
  "achievement_badge",
  "system_announcement",
  "app_update",
  "ai_coach",
  "nutrition_reminder",
  "habit_reminder",
  "daily_streak_reminder",
  "weekly_recap",
  "monthly_progress_summary",
] as const;

export function preferenceKeyForType(type: string): keyof UserPrefs | null {
  switch (type) {
    case "message":
    case "group_message":
      return "messages";
    case "like":
    case "reaction":
    case "post_share":
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
    case "group_invite":
      return "groups";
    case "run_club_announcement":
      return "run_clubs";
    case "marketing":
      return "marketing";
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
      return null;
  }
}

export function isInQuietHours(prefs: UserPrefs): boolean {
  if (!prefs.quiet_hours_enabled) return false;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: prefs.timezone || "UTC",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const nowMins = hour * 60 + minute;
    const [startH, startM] = prefs.quiet_hours_start.split(":").map(Number);
    const [endH, endM] = prefs.quiet_hours_end.split(":").map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    if (startMins < endMins) return nowMins >= startMins && nowMins < endMins;
    return nowMins >= startMins || nowMins < endMins;
  } catch {
    return false;
  }
}

export function isPushEnabledForType(type: string, prefs: UserPrefs): boolean {
  if (!prefs.push_enabled) return false;
  const key = preferenceKeyForType(type);
  if (!key) return true;
  return prefs[key] !== false;
}

export function actorIdFromRecord(record: Record<string, unknown>): string | null {
  if (typeof record.actor_id === "string") return record.actor_id;
  const payload = (record.payload ?? {}) as Record<string, unknown>;
  const type = record.type as string;
  switch (type) {
    case "follow":
      return (payload.follower_id as string) ?? null;
    case "like":
    case "reaction":
      return (payload.user_id as string) ?? null;
    case "comment":
    case "comment_reply":
      return (payload.author_id as string) ?? null;
    case "message":
    case "group_message":
      return (payload.sender_id as string) ?? null;
    case "match":
      return (payload.matched_user_id as string) ?? null;
    default:
      return null;
  }
}

export function buildPushData(
  record: Record<string, unknown>,
  deepLink: string,
  actorUsername: string | null
): Record<string, unknown> {
  const payload = (record.payload ?? {}) as Record<string, unknown>;
  return {
    ...payload,
    type: record.type,
    notification_id: record.id,
    deep_link: deepLink,
    actor_username: actorUsername,
  };
}

export function retryDelayMinutes(retryCount: number): number {
  switch (retryCount) {
    case 0:
      return 1;
    case 1:
      return 5;
    case 2:
      return 15;
    case 3:
      return 60;
    default:
      return 360;
  }
}
