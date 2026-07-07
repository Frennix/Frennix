// Edge Function: unified notification dispatch — Web Push + Expo for ALL types.
// Phase 3: platform delivery layer; engine rows created by create_notification().

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import {
  actorIdFromRecord,
  buildPushData,
  DEFAULT_PREFS,
  isInQuietHours,
  isPushEnabledForType,
  MESSAGE_GROUPING_WINDOW_MS,
  retryDelayMinutes,
  type DeliveryStatus,
  type UserPrefs,
} from "./platform.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type SubscriptionRow = {
  id: string;
  channel: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
};

async function logDelivery(
  supabase: ReturnType<typeof createClient>,
  input: {
    notification_id: string;
    channel: string;
    status: DeliveryStatus;
    skip_reason?: string | null;
    error_message?: string | null;
    subscription_id?: string | null;
    idempotency_key?: string | null;
    sent_at?: string | null;
    retry_count?: number;
    next_retry_at?: string | null;
  }
) {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .insert({
      notification_id: input.notification_id,
      channel: input.channel,
      status: input.status,
      skip_reason: input.skip_reason ?? null,
      error_message: input.error_message ?? null,
      subscription_id: input.subscription_id ?? null,
      idempotency_key: input.idempotency_key ?? null,
      sent_at: input.sent_at ?? null,
      retry_count: input.retry_count ?? 0,
      next_retry_at: input.next_retry_at ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error) console.warn("[send-push] delivery log failed", error.message);
  return data?.id as string | undefined;
}

async function isWebPushFlagEnabled(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("evaluate_feature_flag_for_user", {
    p_key: "web_push_notifications",
    p_user_id: userId,
  });
  if (error) {
    console.warn("[send-push] feature flag check failed", error.message);
    return false;
  }
  return data === true;
}

async function shouldGroupMessagePush(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>
): Promise<boolean> {
  if (record.type !== "message" && record.type !== "group_message") return false;

  const payload = (record.payload ?? {}) as Record<string, unknown>;
  const conversationId = payload.conversation_id as string | undefined;
  const actorId = (record.actor_id as string | undefined) ?? actorIdFromRecord(record);
  if (!conversationId || !actorId) return false;

  const since = new Date(Date.now() - MESSAGE_GROUPING_WINDOW_MS).toISOString();

  const { data: recentNotifications } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", record.user_id as string)
    .in("type", ["message", "group_message"])
    .eq("actor_id", actorId)
    .filter("payload->>conversation_id", "eq", conversationId)
    .neq("id", record.id as string)
    .gte("created_at", since)
    .limit(5);

  if (!recentNotifications?.length) return false;

  const ids = recentNotifications.map((row) => row.id as string);
  const { count } = await supabase
    .from("notification_deliveries")
    .select("id", { count: "exact", head: true })
    .in("notification_id", ids)
    .eq("status", "sent")
    .in("channel", ["web_push", "expo"]);

  return (count ?? 0) > 0;
}

function configureWebPush() {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const subject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@frennix.app";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

async function sendWebPush(
  subscription: SubscriptionRow,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  if (!subscription.p256dh || !subscription.auth) {
    return { ok: false, error: "missing_subscription_keys" };
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify({ title, body, data })
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function dispatchExpo(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>,
  title: string,
  body: string,
  deepLink: string,
  pushData: Record<string, unknown>,
  unreadCount: number
): Promise<boolean> {
  const { data: subscriptions } = await supabase
    .from("notification_subscriptions")
    .select("id, endpoint, channel")
    .eq("user_id", record.user_id as string)
    .eq("enabled", true)
    .eq("channel", "expo");

  let pushTokens = (subscriptions ?? []).map((s) => ({
    token: s.endpoint as string,
    subscriptionId: s.id as string,
  }));

  if (!pushTokens.length) {
    const { data: legacyTokens } = await supabase
      .from("push_tokens")
      .select("expo_token")
      .eq("user_id", record.user_id as string)
      .in("platform", ["ios", "android"]);

    pushTokens = (legacyTokens ?? []).map((t) => ({
      token: t.expo_token as string,
      subscriptionId: null as string | null,
    }));
  }

  if (!pushTokens.length) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("push_token")
      .eq("id", record.user_id as string)
      .single();

    if (profile?.push_token) {
      pushTokens = [{ token: profile.push_token as string, subscriptionId: null }];
    }
  }

  if (!pushTokens.length) {
    await logDelivery(supabase, {
      notification_id: record.id as string,
      channel: "expo",
      status: "skipped",
      skip_reason: "no_subscription",
    });
    return false;
  }

  const pushResponse = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(
      pushTokens.map((entry) => ({
        to: entry.token,
        title,
        body,
        sound: "default",
        badge: unreadCount,
        priority: "high",
        channelId: "default",
        data: pushData,
      }))
    ),
  });

  const pushResult = await pushResponse.json().catch(() => null);
  const sentAt = new Date().toISOString();
  let anySent = false;

  if (pushResult && typeof pushResult === "object" && "data" in pushResult) {
    const tickets = (pushResult as {
      data: Array<{ status: string; details?: { error?: string } }>;
    }).data;

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const entry = pushTokens[i];
      const idempotencyKey = `${record.id}:expo:${entry?.token ?? i}`;

      if (ticket?.status === "ok") {
        anySent = true;
        await logDelivery(supabase, {
          notification_id: record.id as string,
          channel: "expo",
          status: "sent",
          subscription_id: entry?.subscriptionId,
          idempotency_key: idempotencyKey,
          sent_at: sentAt,
        });
      } else {
        const deliveryId = await logDelivery(supabase, {
          notification_id: record.id as string,
          channel: "expo",
          status: "failed",
          subscription_id: entry?.subscriptionId,
          idempotency_key: idempotencyKey,
          error_message: ticket?.details?.error ?? ticket?.status ?? "unknown_error",
          next_retry_at: new Date(Date.now() + retryDelayMinutes(0) * 60_000).toISOString(),
        });

        if (deliveryId) {
          await supabase.rpc("schedule_notification_delivery_retry", {
            p_delivery_id: deliveryId,
            p_error_message: ticket?.details?.error ?? ticket?.status,
          });
        }

        if (
          entry?.token &&
          ticket?.status === "error" &&
          ticket.details?.error === "DeviceNotRegistered"
        ) {
          await supabase.from("push_tokens").delete().eq("expo_token", entry.token);
          await supabase
            .from("notification_subscriptions")
            .delete()
            .eq("channel", "expo")
            .eq("endpoint", entry.token);
        }
      }
    }
  } else {
    await logDelivery(supabase, {
      notification_id: record.id as string,
      channel: "expo",
      status: "failed",
      error_message: "expo_push_invalid_response",
    });
  }

  return anySent;
}

async function dispatchWebPush(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>,
  title: string,
  body: string,
  pushData: Record<string, unknown>
): Promise<boolean> {
  const webPushReady = configureWebPush();
  if (!webPushReady) {
    await logDelivery(supabase, {
      notification_id: record.id as string,
      channel: "web_push",
      status: "skipped",
      skip_reason: "vapid_not_configured",
    });
    return false;
  }

  const { data: subscriptions } = await supabase
    .from("notification_subscriptions")
    .select("id, endpoint, channel, p256dh, auth")
    .eq("user_id", record.user_id as string)
    .eq("enabled", true)
    .eq("channel", "web_push");

  if (!subscriptions?.length) {
    await logDelivery(supabase, {
      notification_id: record.id as string,
      channel: "web_push",
      status: "skipped",
      skip_reason: "no_subscription",
    });
    return false;
  }

  const sentAt = new Date().toISOString();
  let anySent = false;

  for (const sub of subscriptions as SubscriptionRow[]) {
    const idempotencyKey = `${record.id}:web_push:${sub.endpoint}`;
    const result = await sendWebPush(sub, title, body, pushData);

    if (result.ok) {
      anySent = true;
      await logDelivery(supabase, {
        notification_id: record.id as string,
        channel: "web_push",
        status: "sent",
        subscription_id: sub.id,
        idempotency_key: idempotencyKey,
        sent_at: sentAt,
      });
    } else {
      const deliveryId = await logDelivery(supabase, {
        notification_id: record.id as string,
        channel: "web_push",
        status: "failed",
        subscription_id: sub.id,
        idempotency_key: idempotencyKey,
        error_message: result.error ?? "web_push_failed",
        next_retry_at: new Date(Date.now() + retryDelayMinutes(0) * 60_000).toISOString(),
      });

      if (deliveryId) {
        await supabase.rpc("schedule_notification_delivery_retry", {
          p_delivery_id: deliveryId,
          p_error_message: result.error,
        });
      }

      if (result.error?.includes("410") || result.error?.includes("expired")) {
        await supabase.from("notification_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return anySent;
}

export async function dispatchNotificationRecord(
  supabase: ReturnType<typeof createClient>,
  record: Record<string, unknown>
) {
  if (!record?.user_id || !record?.id) {
    return { ok: true, skipped: true };
  }

  const { data: prefRow } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", record.user_id as string)
    .maybeSingle();

  const prefs: UserPrefs = { ...DEFAULT_PREFS, ...(prefRow ?? {}) };
  const type = record.type as string;

  if (!isPushEnabledForType(type, prefs)) {
    await logDelivery(supabase, {
      notification_id: record.id as string,
      channel: "platform",
      status: "skipped",
      skip_reason: "preference_off",
    });
    return { ok: true, skipped: "disabled" };
  }

  if (isInQuietHours(prefs)) {
    await logDelivery(supabase, {
      notification_id: record.id as string,
      channel: "platform",
      status: "skipped",
      skip_reason: "quiet_hours",
    });
    return { ok: true, skipped: "quiet_hours" };
  }

  const payload = (record.payload ?? {}) as Record<string, unknown>;

  if (type === "message" || type === "group_message") {
    const conversationId = payload.conversation_id as string | undefined;
    if (conversationId) {
      const { data: mutedPref } = await supabase
        .from("conversation_user_preferences")
        .select("muted_at")
        .eq("user_id", record.user_id as string)
        .eq("conversation_id", conversationId)
        .maybeSingle();

      if (mutedPref?.muted_at) {
        await logDelivery(supabase, {
          notification_id: record.id as string,
          channel: "platform",
          status: "skipped",
          skip_reason: "muted",
        });
        return { ok: true, skipped: "muted" };
      }
    }

    const grouped = await shouldGroupMessagePush(supabase, record);
    if (grouped) {
      await logDelivery(supabase, {
        notification_id: record.id as string,
        channel: "platform",
        status: "skipped",
        skip_reason: "grouped",
      });
      return { ok: true, skipped: "grouped" };
    }
  }

  const title =
    typeof record.title === "string" && record.title.trim() ? record.title : "Frennix";
  const body =
    typeof record.body === "string" && record.body.trim()
      ? record.body
      : "You have a new notification";
  const deepLink =
    typeof record.deep_link === "string" && record.deep_link.startsWith("/")
      ? record.deep_link
      : "/notifications";

  const actorId = actorIdFromRecord(record);
  let actorUsername: string | null = null;
  if (actorId) {
    const { data: actor } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", actorId)
      .maybeSingle();
    if (actor?.username) actorUsername = actor.username;
  }

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", record.user_id as string)
    .is("read_at", null)
    .is("deleted_at", null);

  const pushData = {
    ...buildPushData(record, deepLink, actorUsername),
    badge_count: unreadCount ?? 1,
  };

  const webPushEnabled = await isWebPushFlagEnabled(supabase, record.user_id as string);
  let anySent = false;

  if (webPushEnabled) {
    anySent = (await dispatchWebPush(supabase, record, title, body, pushData)) || anySent;
  }

  anySent = (await dispatchExpo(supabase, record, title, body, deepLink, pushData, unreadCount ?? 1)) || anySent;

  if (anySent) {
    const sentAt = new Date().toISOString();
    await supabase
      .from("notifications")
      .update({ delivered_at: sentAt })
      .eq("id", record.id as string)
      .is("delivered_at", null);
  }

  return { ok: true, anySent, webPushEnabled };
}
