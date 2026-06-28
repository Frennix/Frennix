export const STORY_REACTIONS = [
  { emoji: "💪", label: "Strong" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "👏", label: "Nice Work" },
  { emoji: "❤️", label: "Like" },
] as const;

export type StoryReactionEmoji = (typeof STORY_REACTIONS)[number]["emoji"];

export interface StoryViewRecord {
  story_user_id: string;
  last_viewed_post_id: string | null;
  viewed_at: string;
}
