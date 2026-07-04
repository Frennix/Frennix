import type { WorkoutStoryMetrics } from "./workout-story";

/** Who can view a story. Custom lists reserved for future. */
export type StoryPrivacy = "everyone" | "followers" | "friends";

export const STORY_PRIVACY_OPTIONS: Array<{ value: StoryPrivacy; label: string; hint: string }> = [
  { value: "everyone", label: "Everyone", hint: "Anyone on Frennix" },
  { value: "followers", label: "Followers", hint: "People who follow you" },
  { value: "friends", label: "Friends", hint: "Mutual connections" },
];

export type StorySlideMediaType = "photo" | "video" | "text" | "workout";

export type StoryLocationType = "gym" | "park" | "city" | "trail" | "route" | "other";

export const STORY_WORKOUT_TAGS = [
  "Running",
  "Walking",
  "Cycling",
  "Basketball",
  "Swimming",
  "Chest Day",
  "Leg Day",
  "Yoga",
  "CrossFit",
  "Hiking",
  "Soccer",
  "Tennis",
  "Boxing",
  "Rowing",
] as const;

export type StoryWorkoutTag = (typeof STORY_WORKOUT_TAGS)[number];

export const STORY_LOCATION_TYPES: Array<{ value: StoryLocationType; label: string }> = [
  { value: "gym", label: "Gym" },
  { value: "park", label: "Park" },
  { value: "city", label: "City" },
  { value: "trail", label: "Trail" },
  { value: "route", label: "Running Route" },
  { value: "other", label: "Other" },
];

export interface StorySlide {
  id: string;
  story_id: string;
  media_url: string | null;
  media_type: StorySlideMediaType;
  caption: string | null;
  workout_type: string | null;
  workout_data: WorkoutStoryMetrics | null;
  sort_order: number;
  slide_meta?: Record<string, unknown>;
  created_at: string;
}

export interface FrennixStory {
  id: string;
  user_id: string;
  privacy: StoryPrivacy;
  post_id: string | null;
  workout_tag: string | null;
  location_name: string | null;
  location_type: StoryLocationType | null;
  challenge_id: string | null;
  challenge_prompt: string | null;
  created_at: string;
  expires_at: string;
  slides: StorySlide[];
}

export interface StoryViewerRecord {
  viewer_id: string;
  profile: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_online?: boolean | null;
    last_seen_at?: string | null;
  };
  viewed_at: string;
  is_following?: boolean;
  follows_you?: boolean;
}

export interface StoryReactionRecord {
  user_id: string;
  profile: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  reaction: string;
  created_at: string;
}

export interface StoryAnalytics {
  story_id: string;
  views: number;
  reactions: number;
  replies: number;
  challenge_joins: number;
  profile_visits: number;
}

export const STORY_POLL_PRESETS = [
  { id: "chest-or-back", question: "Chest or Back?", options: ["Chest", "Back"] },
  { id: "morning-or-evening", question: "Morning or Evening?", options: ["Morning 🌅", "Evening 🌙"] },
  { id: "cardio-or-weights", question: "Cardio or Weights?", options: ["Cardio", "Weights"] },
  { id: "outdoor-or-gym", question: "Outdoor or Gym?", options: ["Outdoor", "Gym"] },
] as const;

export interface StoryTrainingChallenge {
  id: string;
  story_id: string;
  prompt: string;
  created_at: string;
}

export interface StoryChallengeJoinRecord {
  user_id: string;
  profile: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
  joined_at: string;
}

export interface StoryCountdown {
  id: string;
  story_id: string;
  label: string;
  target_at: string;
  event_id: string | null;
  subscribed?: boolean;
}

export interface StoryQuestion {
  id: string;
  story_id: string;
  question: string;
  answer_count?: number;
  my_answer?: string | null;
}

export interface StoryQuestionAnswer {
  id: string;
  question_id: string;
  user_id: string;
  answer_text: string;
  shared_at: string | null;
  created_at: string;
  profile?: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  };
}

export interface StoryWorkoutCommitment {
  id: string;
  story_id: string;
  commitment_text: string;
  due_at: string | null;
  completed_at: string | null;
}

export type StoryPollPresetId = (typeof STORY_POLL_PRESETS)[number]["id"];

export interface StoryPollOption {
  id: string;
  poll_id: string;
  label: string;
  sort_order: number;
  vote_count?: number;
}

export interface StoryPoll {
  id: string;
  story_id: string;
  question: string;
  options: StoryPollOption[];
  my_vote_option_id?: string | null;
}

export type StoryShareMode = "feed" | "story" | "both";

export const STORY_SHARE_MODE_OPTIONS: Array<{ value: StoryShareMode; label: string; hint: string }> = [
  { value: "feed", label: "Post to Feed", hint: "Share on your home feed only" },
  { value: "story", label: "Add to Story", hint: "24-hour story only" },
  { value: "both", label: "Post to Feed + Story", hint: "Create separate feed and story records" },
];

/** Draft slide before publishing. */
export interface StorySlideDraft {
  localId: string;
  uri: string;
  mimeType: string;
  file?: File;
  durationSeconds?: number | null;
  caption?: string;
  workout_type?: string;
  workout_data?: WorkoutStoryMetrics;
}
