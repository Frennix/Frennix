import AsyncStorage from "@react-native-async-storage/async-storage";

const SEEN_KEY = "frennix:whats-new-launch-prompt-seen";

export async function getSeenWhatsNewLaunchPromptVersion(): Promise<string | null> {
  return AsyncStorage.getItem(SEEN_KEY);
}

export async function setSeenWhatsNewLaunchPromptVersion(version: string): Promise<void> {
  await AsyncStorage.setItem(SEEN_KEY, version);
}
