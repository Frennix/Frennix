import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { router } from "expo-router";
import { getSupabase } from "@frennix/api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(userId: string) {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;
  const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";

  await getSupabase().from("push_tokens").upsert(
    {
      user_id: userId,
      expo_token: token,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,expo_token" }
  );

  // Keep legacy column in sync for edge function fallback
  await getSupabase().from("profiles").update({ push_token: token }).eq("id", userId);

  return token;
}

export function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as Record<string, unknown>;
  const type = data?.type as string | undefined;

  if (type === "message" && data.conversation_id) {
    router.push(`/chat/${data.conversation_id}`);
    return;
  }
  if (data.post_id) {
    router.push(`/post/${data.post_id}`);
    return;
  }
  if (data.follower_id) {
    router.push("/notifications");
    return;
  }
  router.push("/notifications");
}

export function setupNotificationListeners() {
  const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
  return () => sub.remove();
}
