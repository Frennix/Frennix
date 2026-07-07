import type { ExtendedNotificationType } from "./types";

/** Platform catalog — every type uses create_notification() + unified dispatch. */
export type NotificationTypeCatalogEntry = {
  type: ExtendedNotificationType;
  label: string;
  /** Future types may ship before UI triggers exist. */
  status: "live" | "engine_ready";
};

export const NOTIFICATION_TYPE_CATALOG: NotificationTypeCatalogEntry[] = [
  { type: "message", label: "Direct messages", status: "live" },
  { type: "group_message", label: "Group messages", status: "engine_ready" },
  { type: "like", label: "Likes", status: "live" },
  { type: "reaction", label: "Workout reactions", status: "live" },
  { type: "comment", label: "Comments", status: "live" },
  { type: "comment_reply", label: "Replies", status: "live" },
  { type: "mention", label: "Mentions", status: "engine_ready" },
  { type: "follow", label: "New followers", status: "live" },
  { type: "friend_request", label: "Friend requests", status: "engine_ready" },
  { type: "match", label: "Match notifications", status: "live" },
  { type: "story_reaction", label: "Story likes", status: "live" },
  { type: "story_reply", label: "Story replies", status: "live" },
  { type: "story_mention", label: "Story mentions", status: "live" },
  { type: "story_challenge_join", label: "Story challenge joins", status: "live" },
  { type: "story_train_invite", label: "Story train invites", status: "live" },
  { type: "event_invite", label: "Event invitations", status: "live" },
  { type: "event_reminder", label: "Event reminders", status: "engine_ready" },
  { type: "event_join", label: "Event joins", status: "live" },
  { type: "training_session_invite", label: "Training session invites", status: "live" },
  { type: "training_session_accepted", label: "Training session accepted", status: "live" },
  { type: "training_session_reminder", label: "Training reminders", status: "engine_ready" },
  { type: "workout_reminder", label: "Workout reminders", status: "engine_ready" },
  { type: "group_invite", label: "Group invites", status: "live" },
  { type: "challenge_invite", label: "Challenge invites", status: "live" },
  { type: "challenge_join", label: "Challenge joins", status: "live" },
  { type: "challenge_progress", label: "Challenge updates", status: "engine_ready" },
  { type: "challenge_reminder", label: "Challenge reminders", status: "engine_ready" },
  { type: "post_share", label: "Post shares", status: "live" },
  { type: "trainer_connection_request", label: "Coach notifications", status: "live" },
  { type: "trainer_connection_accepted", label: "Coach accepted", status: "live" },
  { type: "coach_notification", label: "Coach notifications", status: "engine_ready" },
  { type: "run_club_announcement", label: "Run club announcements", status: "engine_ready" },
  { type: "referral_reward", label: "Referral rewards", status: "engine_ready" },
  { type: "achievement_badge", label: "Achievement badges", status: "engine_ready" },
  { type: "system_announcement", label: "System announcements", status: "engine_ready" },
  { type: "app_update", label: "App updates", status: "engine_ready" },
  { type: "marketing", label: "Marketing", status: "engine_ready" },
  { type: "ai_coach", label: "AI notifications", status: "engine_ready" },
  { type: "nutrition_reminder", label: "Nutrition reminders", status: "engine_ready" },
  { type: "habit_reminder", label: "Habit reminders", status: "engine_ready" },
  { type: "daily_streak_reminder", label: "Streak reminders", status: "engine_ready" },
  { type: "weekly_recap", label: "Weekly recap", status: "engine_ready" },
  { type: "monthly_progress_summary", label: "Monthly progress", status: "engine_ready" },
];

export const ALL_NOTIFICATION_TYPES = NOTIFICATION_TYPE_CATALOG.map((e) => e.type);

export const MESSAGE_GROUPING_WINDOW_MS = 45_000;
