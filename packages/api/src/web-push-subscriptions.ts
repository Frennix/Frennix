import { formatSupabaseError } from "./profile-utils";
import { getSupabase } from "./supabase";

export type NotificationEngagementEvent = "opened" | "clicked" | "dismissed";

export async function upsertWebPushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  deviceLabel?: string;
}): Promise<string | null> {
  const { data, error } = await getSupabase().rpc("upsert_web_push_subscription", {
    p_endpoint: input.endpoint,
    p_p256dh: input.p256dh,
    p_auth: input.auth,
    p_user_agent: input.userAgent ?? null,
    p_device_label: input.deviceLabel ?? null,
  });

  if (error) throw formatSupabaseError(error, "Failed to save web push subscription");
  return (data as string | null) ?? null;
}

export async function removeWebPushSubscription(endpoint: string): Promise<void> {
  const { error } = await getSupabase().rpc("remove_web_push_subscription", {
    p_endpoint: endpoint,
  });
  if (error) throw formatSupabaseError(error, "Failed to remove web push subscription");
}

export async function recordNotificationEngagement(
  notificationId: string,
  event: NotificationEngagementEvent,
  deliveryId?: string
): Promise<void> {
  const { error } = await getSupabase().rpc("record_notification_engagement", {
    p_notification_id: notificationId,
    p_event: event,
    p_delivery_id: deliveryId ?? null,
  });
  if (error) throw formatSupabaseError(error, "Failed to record notification engagement");
}

export async function sendWebPushTestNotification(): Promise<string | null> {
  const { data, error } = await getSupabase().rpc("send_web_push_test_notification");
  if (error) throw formatSupabaseError(error, "Failed to send test push notification");
  return (data as string | null) ?? null;
}
