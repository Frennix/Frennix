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

/** @deprecated Use StoryPrivacy from dedicated-story.ts for new stories. */
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

const SKIN_TONES = ["🏻", "🏼", "🏽", "🏾", "🏿"] as const;

function withSkinTones(base: string): string[] {
  return [base, ...SKIN_TONES.map((tone) => `${base}${tone}`)];
}

/** Displayed story reactions. Storage uses `key`; UI always shows `emoji`. */
export const STORY_QUICK_REACTIONS = [
  {
    key: "strong",
    emoji: "💪🏾",
    label: "Strong",
    aliases: ["strong", ...withSkinTones("💪")],
  },
  { key: "fire", emoji: "🔥", label: "Fire", aliases: ["fire", "🔥"] },
  {
    key: "applause",
    emoji: "👏",
    label: "Clap",
    aliases: ["applause", ...withSkinTones("👏")],
  },
  { key: "love", emoji: "❤️", label: "Love", aliases: ["love", "❤️", "❤", "♥️"] },
  { key: "eyes", emoji: "👀", label: "Watching", aliases: ["eyes", "👀"] },
  { key: "laugh", emoji: "😂", label: "Laugh", aliases: ["laugh", "😂"] },
  {
    key: "support",
    emoji: "🤝",
    label: "Support",
    aliases: ["support", ...withSkinTones("🤝")],
  },
] as const;

export type StoryQuickReactionKey = (typeof STORY_QUICK_REACTIONS)[number]["key"];
export type StoryQuickReactionEmoji = (typeof STORY_QUICK_REACTIONS)[number]["emoji"];

const STORY_REACTION_BY_KEY = new Map(
  STORY_QUICK_REACTIONS.map((reaction) => [reaction.key, reaction])
);

const STORY_REACTION_ALIAS_TO_KEY = new Map<string, StoryQuickReactionKey>();
for (const reaction of STORY_QUICK_REACTIONS) {
  STORY_REACTION_ALIAS_TO_KEY.set(reaction.key, reaction.key);
  STORY_REACTION_ALIAS_TO_KEY.set(reaction.emoji, reaction.key);
  for (const alias of reaction.aliases) {
    STORY_REACTION_ALIAS_TO_KEY.set(alias, reaction.key);
  }
}

function stripVariationSelector(value: string) {
  return value.replace(/\uFE0F/g, "");
}

/** Map any displayed glyph, skin-tone variant, or stored key to the canonical reaction. */
export function canonicalizeStoryReaction(input: string | null | undefined): {
  key: StoryQuickReactionKey;
  emoji: StoryQuickReactionEmoji;
  label: string;
} | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const key =
    STORY_REACTION_ALIAS_TO_KEY.get(trimmed) ??
    STORY_REACTION_ALIAS_TO_KEY.get(stripVariationSelector(trimmed));
  if (!key) return null;
  const reaction = STORY_REACTION_BY_KEY.get(key);
  if (!reaction) return null;
  return { key: reaction.key, emoji: reaction.emoji, label: reaction.label };
}

export function isStoryQuickReactionEmoji(value: string | null | undefined): value is StoryQuickReactionEmoji {
  return canonicalizeStoryReaction(value) !== null;
}

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
  story_id: string;
  /** @deprecated Use story_id */
  post_id?: string;
  views: number;
  replies: number;
  reactions: number;
  train_invites: number;
  profile_visits: number;
  new_followers: number;
  challenges: number;
}

export type StoryHighlightCategory =
  | "personal_records"
  | "running"
  | "gym"
  | "challenges"
  | "nutrition"
  | "recovery"
  | "race_day"
  | "custom";

export const STORY_HIGHLIGHT_PRESETS: Array<{ category: StoryHighlightCategory; title: string }> = [
  { category: "personal_records", title: "PRs" },
  { category: "running", title: "Runs" },
  { category: "gym", title: "Gym Sessions" },
  { category: "challenges", title: "Challenges" },
  { category: "nutrition", title: "Nutrition" },
  { category: "recovery", title: "Recovery" },
  { category: "race_day", title: "Events" },
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
