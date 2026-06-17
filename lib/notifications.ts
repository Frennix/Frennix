import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { AppState, Platform } from "react-native";
import { removePushTokens, savePushToken, type PushPlatform } from "@frennix/api";
import { handlePushNotificationOpen } from "@/lib/notification-navigation";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getExpoProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
}

function resolvePlatform(): PushPlatform | null {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return null;
}

export async function registerForPushNotifications(userId: string) {
  const platform = resolvePlatform();
  if (!platform) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
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
  let token: string;
  try {
    const tokenData = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    token = tokenData.data;
  } catch (error) {
    console.warn("[push] Failed to get Expo push token", error);
    return null;
  }

  await savePushToken(userId, token, platform);
  return token;
}

export async function unregisterPushNotifications(userId: string) {
  await removePushTokens(userId);

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

export function setupPushRegistration(userId: string) {
  void registerForPushNotifications(userId);

  const subscription = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      void registerForPushNotifications(userId);
    }
  });

  return () => subscription.remove();
}
