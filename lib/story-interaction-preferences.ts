import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StoryQuickReactionEmoji } from "@frennix/types";
import { STORY_QUICK_REACTIONS } from "@frennix/types";

const LAST_STORY_REACTION_KEY = "frennix:last-story-reaction-emoji";

const VALID_EMOJIS = new Set<string>(STORY_QUICK_REACTIONS.map((reaction) => reaction.emoji));

export async function readLastStoryReaction(): Promise<StoryQuickReactionEmoji | null> {
  try {
    const value = await AsyncStorage.getItem(LAST_STORY_REACTION_KEY);
    if (!value || !VALID_EMOJIS.has(value)) return null;
    return value as StoryQuickReactionEmoji;
  } catch {
    return null;
  }
}

export async function writeLastStoryReaction(emoji: StoryQuickReactionEmoji): Promise<void> {
  if (!VALID_EMOJIS.has(emoji)) return;
  try {
    await AsyncStorage.setItem(LAST_STORY_REACTION_KEY, emoji);
  } catch {
    // Non-critical preference
  }
}
