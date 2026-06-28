export const STORY_REACTIONS = [
  { emoji: "💪", label: "Strong Work" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "👏", label: "Nice Work" },
  { emoji: "❤️", label: "Like" },
] as const;

/** @deprecated Use STORY_QUICK_REACTIONS from workout-story */
export type StoryReactionEmoji = (typeof STORY_REACTIONS)[number]["emoji"];

export interface StoryViewRecord {
  story_user_id: string;
  last_viewed_post_id: string | null;
  viewed_at: string;
}
