import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { getSupabase } from "@frennix/api";
import { handlePushNotificationOpen } from "@/lib/notification-navigation";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function getExpoProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
}

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
      name: "Frennix",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#22C55E",
    });
  }

  const projectId = getExpoProjectId();
  const tokenData = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();
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

  await getSupabase().from("profiles").update({ push_token: token }).eq("id", userId);

  return token;
}

export async function unregisterPushNotifications(userId: string) {
  await getSupabase().from("push_tokens").delete().eq("user_id", userId);
  await getSupabase().from("profiles").update({ push_token: null }).eq("id", userId);

  if (Platform.OS !== "web") {
    await Notifications.setBadgeCountAsync(0).catch(() => undefined);
  }
}

export async function syncNotificationBadgeCount(count: number) {
  if (Platform.OS === "web") return;
  await Notifications.setBadgeCountAsync(Math.max(0, count)).catch(() => undefined);
}

export function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as Record<string, unknown>;
  void handlePushNotificationOpen(data);
}

export function setupNotificationListeners(onReceived?: () => void) {
  const receivedSub = Notifications.addNotificationReceivedListener(() => {
    onReceived?.();
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) handleNotificationResponse(response);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}
