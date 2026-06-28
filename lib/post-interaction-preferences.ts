import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PostInteractionActionId } from "@/lib/post-interaction-actions";

const LAST_REACTION_KEY = "frennix:last-post-reaction-action";

const REACTION_ACTION_IDS = new Set<PostInteractionActionId>([
  "like",
  "strong_work",
  "reaction_fire",
  "reaction_nice_work",
]);

export function isStoredReactionAction(id: PostInteractionActionId): boolean {
  return REACTION_ACTION_IDS.has(id);
}

export async function readLastReactionAction(): Promise<PostInteractionActionId | null> {
  try {
    const value = await AsyncStorage.getItem(LAST_REACTION_KEY);
    if (!value || !REACTION_ACTION_IDS.has(value as PostInteractionActionId)) return null;
    return value as PostInteractionActionId;
  } catch {
    return null;
  }
}

export async function writeLastReactionAction(id: PostInteractionActionId): Promise<void> {
  if (!REACTION_ACTION_IDS.has(id)) return;
  try {
    await AsyncStorage.setItem(LAST_REACTION_KEY, id);
  } catch {
    // Non-critical preference
  }
}
