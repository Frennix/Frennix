import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { AppState, Linking, Platform } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import { getUnreadNotificationCount, removePushTokens, savePushToken, type PushPlatform } from "@frennix/api";
import { handlePushNotificationOpen } from "@/lib/notification-navigation";
import { logMatchmakingError } from "@/lib/matchmaking-observability";

const isNative = Platform.OS !== "web";

export type PushPermissionStatus = "granted" | "denied" | "undetermined" | "unavailable";

export type PushReceivedHandler = (data: Record<string, unknown>) => void;

if (isNative) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function getExpoProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
}

function resolvePlatform(): PushPlatform | null {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return null;
}

function asPushType(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function getPushNotificationData(
  notification: Notifications.Notification
): Record<string, unknown> {
  return (notification.request.content.data ?? {}) as Record<string, unknown>;
}

export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  if (!isNative) return "unavailable";

  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

export async function requestPushPermission(): Promise<PushPermissionStatus> {
  if (!isNative) return "unavailable";

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return "granted";
  if (existing === "denied") return "denied";

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

export async function openSystemNotificationSettings(): Promise<boolean> {
  if (!isNative) return false;

  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

export function invalidateQueriesForPushNotification(
  queryClient: QueryClient,
  userId: string,
  data: Record<string, unknown>
) {
  if (!userId) return;

  const type = asPushType(data.type);

  queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
  queryClient.invalidateQueries({ queryKey: ["unread-notifications", userId] });

  if (type === "match") {
    queryClient.invalidateQueries({ queryKey: ["training-matches", userId] });
  }

  if (type === "trainer_connection_request" || type === "trainer_connection_accepted") {
    queryClient.invalidateQueries({ queryKey: ["trainer-connections", userId] });
  }

  if (type === "message") {
    queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    queryClient.invalidateQueries({ queryKey: ["unread-messages", userId] });
  }

  void getUnreadNotificationCount(userId)
    .then((count) => syncNotificationBadgeCount(count))
    .catch(() => undefined);
}

export async function registerForPushNotifications(userId: string) {
  if (!isNative) return null;

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
    logMatchmakingError("push_registration", error, { userId, platform });
    return null;
  }

  await savePushToken(userId, token, platform);
  return token;
}

export async function unregisterPushNotifications(userId: string) {
  await removePushTokens(userId);

  if (isNative) {
    await Notifications.setBadgeCountAsync(0).catch(() => undefined);
  }
}

export async function syncNotificationBadgeCount(count: number) {
  if (!isNative) return;
  await Notifications.setBadgeCountAsync(Math.max(0, count)).catch(() => undefined);
}

export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
  userId: string
) {
  const data = getPushNotificationData(response.notification);
  void handlePushNotificationOpen(data, userId);
}

export function setupNotificationListeners(userId: string, onReceived?: PushReceivedHandler) {
  if (!isNative) {
    return () => undefined;
  }

  const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
    onReceived?.(getPushNotificationData(notification));
  });

  const responseSub = Notifications.addNotificationResponseReceivedListener((response) =>
    handleNotificationResponse(response, userId)
  );

  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) handleNotificationResponse(response, userId);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

export function setupPushRegistration(userId: string) {
  if (!isNative) {
    return () => undefined;
  }

  void registerForPushNotifications(userId);

  const subscription = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      void registerForPushNotifications(userId);
    }
  });

  return () => subscription.remove();
}
