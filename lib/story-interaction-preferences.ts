import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StoryQuickReactionEmoji } from "@frennix/types";
import { canonicalizeStoryReaction } from "@frennix/types";

const LAST_STORY_REACTION_KEY = "frennix:last-story-reaction-emoji";

export async function readLastStoryReaction(): Promise<StoryQuickReactionEmoji | null> {
  try {
    const value = await AsyncStorage.getItem(LAST_STORY_REACTION_KEY);
    return canonicalizeStoryReaction(value)?.emoji ?? null;
  } catch {
    return null;
  }
}

export async function writeLastStoryReaction(emoji: StoryQuickReactionEmoji): Promise<void> {
  const canonical = canonicalizeStoryReaction(emoji);
  if (!canonical) return;
  try {
    await AsyncStorage.setItem(LAST_STORY_REACTION_KEY, canonical.emoji);
  } catch {
    // Non-critical preference
  }
}
