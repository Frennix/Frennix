import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StoryPrivacy } from "@frennix/types";
import { getStoryPrivacyOption, storyPrivacyChoices } from "@frennix/types";

const LAST_STORY_PRIVACY_KEY = "frennix:last-story-privacy";

const VALID_PRIVACY = new Set<StoryPrivacy>(
  storyPrivacyChoices().map((option) => option.value).concat(["followers", "friends"])
);

export async function readLastStoryPrivacy(): Promise<StoryPrivacy | null> {
  try {
    const value = await AsyncStorage.getItem(LAST_STORY_PRIVACY_KEY);
    if (!value || !VALID_PRIVACY.has(value as StoryPrivacy)) return null;
    return value as StoryPrivacy;
  } catch {
    return null;
  }
}

export async function writeLastStoryPrivacy(privacy: StoryPrivacy): Promise<void> {
  if (!VALID_PRIVACY.has(privacy)) return;
  try {
    await AsyncStorage.setItem(LAST_STORY_PRIVACY_KEY, privacy);
  } catch {
    // Non-critical preference
  }
}

export function describeStoryPrivacy(privacy: StoryPrivacy): string {
  const option = getStoryPrivacyOption(privacy);
  return `${option.label} — ${option.hint}`;
}
