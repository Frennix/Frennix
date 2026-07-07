import { useEffect } from "react";
import { Platform } from "react-native";
import type { QueryClient } from "@tanstack/react-query";
import { getUnreadNotificationCount, recordNotificationEngagement } from "@frennix/api";
import { syncAppBadgeCount } from "@/lib/badge-sync";
import { invalidateQueriesForPushNotification } from "@/lib/notifications";
import { handlePushNotificationOpen } from "@/lib/notification-navigation";

function asNotificationId(data: Record<string, unknown>): string | undefined {
  const value = data.notification_id;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asBadgeCount(data: Record<string, unknown>): number | undefined {
  const value = data.badge_count;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Web-only: service worker messages for push received + notification click. */
export function WebPushListener({
  userId,
  queryClient,
}: {
  userId: string;
  queryClient: QueryClient;
}) {
  useEffect(() => {
    if (Platform.OS !== "web" || !userId || typeof navigator === "undefined") return;

    const onMessage = (event: MessageEvent) => {
      const payload = event.data as {
        type?: string;
        data?: Record<string, unknown>;
      } | null;
      if (!payload?.type || !payload.data) return;

      if (payload.type === "PUSH_RECEIVED") {
        invalidateQueriesForPushNotification(queryClient, userId, payload.data);
        const badge = asBadgeCount(payload.data);
        if (badge !== undefined) {
          void syncAppBadgeCount(badge);
        } else {
          void getUnreadNotificationCount(userId)
            .then((count) => syncAppBadgeCount(count))
            .catch(() => undefined);
        }
        const notificationId = asNotificationId(payload.data);
        if (notificationId) {
          void recordNotificationEngagement(notificationId, "opened").catch(() => undefined);
        }
        return;
      }

      if (payload.type === "NOTIFICATION_CLICK") {
        invalidateQueriesForPushNotification(queryClient, userId, payload.data);
        void handlePushNotificationOpen(payload.data, userId);

        const notificationId = asNotificationId(payload.data);
        if (notificationId) {
          void recordNotificationEngagement(notificationId, "clicked").catch(() => undefined);
        }
      }
    };

    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, [queryClient, userId]);

  return null;
}
