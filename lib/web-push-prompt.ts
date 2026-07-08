import AsyncStorage from "@react-native-async-storage/async-storage";

const PROMPT_DISMISSED_KEY = "@frennix/web_push_prompt_dismissed";
const PERMISSION_DENIED_KEY = "@frennix/web_push_permission_denied";

export async function wasWebPushPromptDismissed(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PROMPT_DISMISSED_KEY);
  return value === "1";
}

export async function markWebPushPromptDismissed(): Promise<void> {
  await AsyncStorage.setItem(PROMPT_DISMISSED_KEY, "1");
}

export async function wasWebPushPermissionDenied(): Promise<boolean> {
  const value = await AsyncStorage.getItem(PERMISSION_DENIED_KEY);
  return value === "1";
}

export async function markWebPushPermissionDenied(): Promise<void> {
  await AsyncStorage.setItem(PERMISSION_DENIED_KEY, "1");
}

export async function clearWebPushPermissionDenied(): Promise<void> {
  await AsyncStorage.removeItem(PERMISSION_DENIED_KEY);
}
