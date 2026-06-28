/** Extensible workout metrics — manual, wearable, and map-ready. */
export interface WorkoutStoryMetrics {
  duration_seconds?: number | null;
  distance_meters?: number | null;
  calories?: number | null;
  pace_seconds_per_km?: number | null;
  elevation_meters?: number | null;
  source?: string | null;
  route_polyline?: string | null;
  location_shared?: boolean;
  extra?: Record<string, unknown>;
}

export type WorkoutStoryMilestoneKind =
  | "first_workout"
  | "streak_7"
  | "streak_30"
  | "personal_record"
  | "goal_completed"
  | "workout_100";

export interface WorkoutStoryMilestone {
  id: string;
  emoji: string;
  label: string;
  kind: WorkoutStoryMilestoneKind;
}

export type StoryAudience = "public" | "followers" | "friends" | "private";

export const STORY_AUDIENCE_OPTIONS: Array<{ value: StoryAudience; label: string; hint: string }> = [
  { value: "public", label: "Public", hint: "Anyone on Frennix" },
  { value: "followers", label: "Followers", hint: "People who follow you" },
  { value: "friends", label: "Friends", hint: "Mutual connections" },
  { value: "private", label: "Private", hint: "Only you" },
];

/** Future-ready slide metadata — music, maps, wearables, AI (not all rendered yet). */
export interface WorkoutStorySlideMeta {
  musicTrackId?: string | null;
  routeMap?: {
    polyline?: string;
    distance_meters?: number;
    pace_seconds_per_km?: number;
    elevation_meters?: number;
    location_shared?: boolean;
  } | null;
  wearable?: {
    provider?: "apple_watch" | "garmin" | "fitbit" | "samsung_health" | "whoop" | "oura" | "strava" | string;
    payload?: Record<string, unknown>;
  } | null;
  aiSummary?: string | null;
}

export const STORY_QUICK_REACTIONS = [
  { emoji: "💪", label: "Strong Work" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "👏", label: "Nice Work" },
  { emoji: "❤️", label: "Like" },
] as const;

export type StoryQuickReactionEmoji = (typeof STORY_QUICK_REACTIONS)[number]["emoji"];

export const STORY_CHALLENGE_RESPONSES = [
  { key: "accepted", label: "Challenge Accepted", message: "Challenge Accepted! Let's go 🔥" },
  { key: "join", label: "I'll Join", message: "I'll Join your next workout! 💪" },
  { key: "train", label: "Let's Train", message: "Let's Train together soon! 🏋️" },
  { key: "rematch", label: "Rematch", message: "Rematch soon? I'm in! 💪" },
  { key: "tomorrow", label: "See You Tomorrow", message: "See You Tomorrow for a workout! 🌅" },
] as const;

export type StoryChallengeKey = (typeof STORY_CHALLENGE_RESPONSES)[number]["key"];

export type StoryEngagementEventType =
  | "view"
  | "reaction"
  | "reply"
  | "challenge"
  | "train_invite"
  | "profile_visit"
  | "follow";

export interface StoryInsights {
  post_id: string;
  views: number;
  replies: number;
  reactions: number;
  train_invites: number;
  profile_visits: number;
  new_followers: number;
  challenges: number;
}

export type StoryHighlightCategory =
  | "running"
  | "gym"
  | "basketball"
  | "hiking"
  | "personal_records"
  | "race_day"
  | "transformations"
  | "challenges"
  | "custom";

export const STORY_HIGHLIGHT_PRESETS: Array<{ category: StoryHighlightCategory; title: string }> = [
  { category: "running", title: "Running" },
  { category: "gym", title: "Gym" },
  { category: "basketball", title: "Basketball" },
  { category: "hiking", title: "Hiking" },
  { category: "personal_records", title: "Personal Records" },
  { category: "race_day", title: "Race Day" },
  { category: "transformations", title: "Transformations" },
  { category: "challenges", title: "Challenges" },
];

export const STORY_DAILY_MOTIVATIONS = [
  "Complete today's workout to keep your streak alive.",
  "Invite someone to train today.",
  "Share today's workout with your community.",
  "Your next story starts with one rep.",
  "Show up today — your community is watching.",
] as const;

export type StoryTrainInviteStatus = "pending" | "accepted" | "suggest_day" | "declined";

export interface StoryTrainInvite {
  id: string;
  inviter_id: string;
  invitee_id: string;
  post_id: string | null;
  status: StoryTrainInviteStatus;
  created_at: string;
  responded_at: string | null;
}
