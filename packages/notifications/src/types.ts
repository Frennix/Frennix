import type { NotificationType } from "@frennix/types";

/** Filter tabs in Notification Center. */
export type NotificationCategory = "messages" | "social" | "events" | "challenges" | "system";

/** Delivery channel adapters — engine stays constant; only these change per platform. */
export type NotificationDeliveryChannel = "web_push" | "expo" | "apns" | "fcm" | "email";

export type NotificationDeliveryStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "failed"
  | "skipped"
  | "grouped";

export type NotificationSkipReason =
  | "preference_off"
  | "push_disabled"
  | "quiet_hours"
  | "muted"
  | "no_subscription"
  | "dedupe"
  | "rate_limited"
  | "validation_failed"
  | "blocked";

/** Entity referenced by a notification row. */
export type NotificationEntityType =
  | "conversation"
  | "post"
  | "comment"
  | "profile"
  | "event"
  | "challenge"
  | "story"
  | "announcement"
  | "system";

export type NotificationCopyInput = {
  type: NotificationType;
  actorName: string;
  payload: Record<string, unknown>;
};

export type NotificationCopy = {
  title: string;
  body: string;
};

export type DeepLinkInput = {
  type: NotificationType;
  payload: Record<string, unknown>;
  actorUsername?: string | null;
};

/** Future notification types — same TEXT column, no schema migration required. */
export const FUTURE_NOTIFICATION_TYPES = [
  "ai_coach",
  "nutrition_reminder",
  "workout_reminder",
  "habit_reminder",
  "achievement_badge",
  "daily_streak_reminder",
  "weekly_recap",
  "monthly_progress_summary",
  "friend_request",
  "mention",
  "challenge_progress",
  "system_announcement",
  "app_update",
  "event_reminder",
  "group_message",
  "referral_reward",
  "run_club_announcement",
  "coach_notification",
  "marketing",
] as const;

export type FutureNotificationType = (typeof FUTURE_NOTIFICATION_TYPES)[number];

export type ExtendedNotificationType = NotificationType | FutureNotificationType;
