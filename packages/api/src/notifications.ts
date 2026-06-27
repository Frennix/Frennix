import type { Notification, NotificationType, Profile } from "@frennix/types";
import { getBlockedIds } from "./moderation";
import { getProfilesByIds } from "./profiles";
import { getSupabase } from "./supabase";

const NOTIFICATIONS_LIMIT = 50;

export function safeNotificationPayload(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

export function notificationActorId(notification: Notification): string | null {
  const { type } = notification;
  const payload = safeNotificationPayload(notification.payload);
  switch (type) {
    case "follow":
      return (payload.follower_id as string) ?? null;
    case "like":
      return (payload.user_id as string) ?? null;
    case "reaction":
      return (payload.user_id as string) ?? null;
    case "comment":
      return (payload.author_id as string) ?? null;
    case "comment_reply":
      return (payload.author_id as string) ?? null;
    case "message":
      return (payload.sender_id as string) ?? null;
    case "match":
      return (payload.matched_user_id as string) ?? null;
    case "trainer_connection_request":
      return (payload.client_id as string) ?? null;
    case "trainer_connection_accepted":
      return (payload.trainer_id as string) ?? null;
    case "event_join":
      return (payload.user_id as string) ?? null;
    case "event_invite":
      return (payload.inviter_id as string) ?? null;
    case "challenge_join":
      return (payload.user_id as string) ?? null;
    case "challenge_invite":
      return (payload.inviter_id as string) ?? null;
    case "post_share":
      return (payload.sharer_id as string) ?? null;
    default:
      return null;
  }
}

export type NotificationDisplay = {
  headline: string;
  detail: string;
};

export function buildNotificationDisplay(
  notification: Notification,
  actorName = "Someone"
): NotificationDisplay {
  const payload = safeNotificationPayload(notification.payload);

  switch (notification.type) {
    case "match":
      return {
        headline: "New Training Match",
        detail: `You and ${actorName} are ready to train together.`,
      };
    case "trainer_connection_request":
      return {
        headline: "New coaching request",
        detail: `${actorName} requested to connect for coaching.`,
      };
    case "trainer_connection_accepted":
      return {
        headline: "Coaching request accepted",
        detail: `${actorName} accepted your coaching request.`,
      };
    case "message": {
      const preview = payload.preview as string | undefined;
      if (payload.from_trainer_connection === true) {
        return {
          headline: "Coach message",
          detail: preview ? `${actorName}: ${preview}` : `New message from coach ${actorName}`,
        };
      }
      if (payload.from_training_match === true) {
        return {
          headline: "Training partner message",
          detail: preview ? `${actorName}: ${preview}` : `New message from ${actorName}`,
        };
      }
      return {
        headline: "New message",
        detail: preview ? `${actorName}: ${preview}` : `${actorName} sent you a message`,
      };
    }
    case "like":
      return { headline: "New like", detail: `${actorName} liked your post` };
    case "reaction": {
      const emoji = (payload.emoji as string) ?? "😊";
      return { headline: "New reaction", detail: `${actorName} reacted ${emoji} to your post` };
    }
    case "comment":
      return { headline: "New comment", detail: `${actorName} commented on your post` };
    case "comment_reply":
      return { headline: "New reply", detail: `${actorName} replied to your comment` };
    case "follow":
      return { headline: "New follower", detail: `${actorName} started following you` };
    case "challenge_reminder":
      return { headline: "Challenge reminder", detail: "Your challenge is coming up" };
    case "challenge_join":
      return { headline: "Challenge join", detail: `${actorName} joined your challenge` };
    case "challenge_invite": {
      const title = payload.challenge_title as string | undefined;
      const username = payload.inviter_username as string | undefined;
      const who = username ? `@${username}` : actorName;
      return {
        headline: "Challenge invitation",
        detail: title
          ? `${who} invited you to join "${title}".`
          : `${who} invited you to join a challenge.`,
      };
    }
    case "group_invite":
      return { headline: "Group invite", detail: `${actorName} invited you to a group` };
    case "event_join": {
      const title = payload.event_title as string | undefined;
      return {
        headline: "Event join",
        detail: title
          ? `${actorName} joined your event "${title}"`
          : `${actorName} joined your workout event`,
      };
    }
    case "event_invite": {
      const title = payload.event_title as string | undefined;
      return {
        headline: "Event invitation",
        detail: title
          ? `${actorName} invited you to "${title}"`
          : `${actorName} invited you to a workout event`,
      };
    }
    case "post_share": {
      const dest = payload.destination as string | undefined;
      const destName = payload.destination_name as string | undefined;
      if (dest === "message") {
        return { headline: "Post shared", detail: `${actorName} shared your post in a message` };
      }
      if (destName) {
        return { headline: "Post shared", detail: `${actorName} shared your post in ${destName}` };
      }
      return { headline: "Post shared", detail: `${actorName} shared your post` };
    }
    default:
      return { headline: "Frennix", detail: "New activity on Frennix" };
  }
}

export function notificationText(notification: Notification, actorName = "Someone"): string {
  const display = buildNotificationDisplay(notification, actorName);
  return `${display.headline} — ${display.detail}`;
}

export function buildNotificationRowText(notification: Notification): string {
  try {
    return notificationText(notification, getNotificationActorName(notification.actor));
  } catch {
    return "New activity on Frennix";
  }
}

async function enrichNotifications(notifications: Notification[]): Promise<Notification[]> {
  if (!notifications.length) return [];

  const actorIds = notifications
    .map(notificationActorId)
    .filter((id): id is string => Boolean(id));

  const profiles = await getProfilesByIds(actorIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return notifications.map((notification) => {
    const actorId = notificationActorId(notification);
    return {
      ...notification,
      actor: actorId ? profileById.get(actorId) : undefined,
    };
  });
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await getSupabase()
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(NOTIFICATIONS_LIMIT);

  if (error) throw error;

  const blockedIds = new Set(await getBlockedIds(userId));
  const filtered = ((data ?? []) as Notification[]).filter((notification) => {
    const actorId = notificationActorId(notification);
    return !actorId || !blockedIds.has(actorId);
  });

  return enrichNotifications(filtered);
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(id: string) {
  const { error } = await getSupabase()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await getSupabase()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);

  if (error) throw error;
}

export async function createNotification(input: {
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
}) {
  const { error } = await getSupabase().from("notifications").insert(input);
  if (error) throw error;
}

export function subscribeToNotifications(
  userId: string,
  handlers: {
    onInsert?: (notification: Notification) => void;
    onUpdate?: (notification: Notification) => void;
  }
) {
  return getSupabase()
    .channel(`notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => handlers.onInsert?.(payload.new as Notification)
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => handlers.onUpdate?.(payload.new as Notification)
    )
    .subscribe();
}

export function getNotificationActorName(actor?: Profile | null) {
  return actor?.display_name ?? "Someone";
}
