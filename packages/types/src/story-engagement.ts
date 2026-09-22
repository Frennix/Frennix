export const STORY_REACTION_MESSAGE_PATTERN = /^Reacted (.+) to your story$/;

export function storyReactionIdempotencyKey(
  viewerId: string,
  storyId: string,
  slideId?: string | null
) {
  return `${viewerId}:${storyId}:${slideId ?? "story"}`;
}

export function formatStoryReactionMessageContent(emoji: string) {
  return `Reacted ${emoji} to your story`;
}

export function parseStoryReactionMessage(content: string | null | undefined) {
  const match = content?.trim().match(STORY_REACTION_MESSAGE_PATTERN);
  if (!match?.[1]) return null;
  return { emoji: match[1] };
}

function possessiveName(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.toLowerCase() === "their") return "their";
  return /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
}

export function formatStoryReactionDisplay(input: {
  emoji: string;
  isOwn: boolean;
  senderName?: string | null;
  ownerName?: string | null;
}) {
  if (input.isOwn) {
    return `You reacted ${input.emoji} to ${possessiveName(input.ownerName ?? "their")} story`;
  }
  const sender = input.senderName?.trim() || "Someone";
  return `${sender} reacted ${input.emoji} to your story`;
}

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
