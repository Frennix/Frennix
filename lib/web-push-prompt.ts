import AsyncStorage from "@react-native-async-storage/async-storage";

const PROMPT_DISMISSED_KEY = "@frennix/web_push_prompt_dismissed";

export async function wasWebPushPromptDismissed(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PROMPT_DISMISSED_KEY);
  return value === "1";
}

export async function markWebPushPromptDismissed(): Promise<void> {
  await AsyncStorage.setItem(PROMPT_DISMISSED_KEY, "1");
}
