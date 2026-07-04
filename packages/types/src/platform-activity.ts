/**
 * Canonical activity types for the Platform Activity Engine.
 * Every meaningful Frennix action publishes one of these — no parallel tracking systems.
 */
export type PlatformActivityType =
  | "workout_completed"
  | "workout_scheduled"
  | "workout_rescheduled"
  | "workout_cancelled"
  | "workout_missed"
  | "story_posted"
  | "story_viewed"
  | "story_reacted"
  | "story_replied"
  | "story_commitment_completed"
  | "feed_post_created"
  | "feed_post_liked"
  | "feed_post_commented"
  | "challenge_joined"
  | "challenge_completed"
  | "event_created"
  | "event_joined"
  | "event_attended"
  | "match_created"
  | "training_partner_favorited"
  | "message_sent"
  | "workout_invite_sent"
  | "workout_invite_accepted"
  | "workout_invite_declined"
  | "workout_invite_maybe_later"
  | "achievement_earned"
  | "partner_workout_completed"
  | "run_club_participation"
  | "group_workout_completed"
  | "coaching_session_completed"
  | "positive_interaction"
  | "helped_beginner";

/** Known source domains — maps to originating table or feature area. */
export type PlatformActivitySourceType =
  | "training_calendar_items"
  | "training_session_invites"
  | "posts"
  | "stories"
  | "story_item_views"
  | "story_reactions"
  | "story_workout_commitments"
  | "events"
  | "event_attendees"
  | "challenges"
  | "challenge_participants"
  | "matches"
  | "conversations"
  | "messages"
  | "likes"
  | "comments"
  | "user_achievements"
  | "profiles";

export interface PlatformActivityEvent {
  id: string;
  user_id: string;
  activity_type: PlatformActivityType;
  source_type: PlatformActivitySourceType | string | null;
  source_id: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
}

export interface PublishPlatformActivityInput {
  userId: string;
  activityType: PlatformActivityType;
  sourceType?: PlatformActivitySourceType | string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

export interface PlatformActivityStreamOptions {
  rangeStart?: string;
  rangeEnd?: string;
  activityTypes?: PlatformActivityType[];
  limit?: number;
}

/** Aggregated counts for achievement engine and insights. */
export interface PlatformActivityCounts {
  workout_completed: number;
  workout_scheduled: number;
  event_joined: number;
  event_attended: number;
  event_created: number;
  challenge_joined: number;
  challenge_completed: number;
  partner_workout_completed: number;
  story_commitment_completed: number;
  run_club_participation: number;
  match_created: number;
  achievement_earned: number;
}
