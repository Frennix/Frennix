import { router } from "expo-router";
import type { Notification } from "@frennix/types";
import { getOrCreateConversation, markNotificationRead, safeNotificationPayload } from "@frennix/api";
import { pushScreen } from "@/lib/press-utils";

export type NotificationNavResult =
  | { ok: true }
  | { ok: false; message: string };

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function pushHref(href: string): NotificationNavResult {
  try {
    pushScreen(href);
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not open that screen. Try again." };
  }
}

function actorProfileHref(notification: Notification): string | undefined {
  const username = asString(notification.actor?.username);
  if (username) return `/user/${username}`;
  return undefined;
}

function postHref(payload: Record<string, unknown>): string | undefined {
  const postId = asString(payload.post_id);
  if (!postId) return undefined;

  const commentId = asString(payload.comment_id) ?? asString(payload.parent_id);
  if (commentId) {
    return `/post/${postId}?commentId=${encodeURIComponent(commentId)}`;
  }

  return `/post/${postId}`;
}

async function openTrainingMatchDestination(
  notification: Notification,
  userId: string
): Promise<NotificationNavResult> {
  const payload = safeNotificationPayload(notification.payload);
  const partnerId =
    asString(payload.matched_user_id) ?? notification.actor?.id ?? undefined;

  if (partnerId) {
    try {
      const conversationId = await getOrCreateConversation(userId, partnerId);
      return pushHref(`/chat/${conversationId}`);
    } catch {
      return pushHref("/matching/matches");
    }
  }

  return pushHref("/matching/matches");
}

export async function openNotificationTargetAsync(
  notification: Notification,
  userId: string
): Promise<NotificationNavResult> {
  const { type } = notification;
  const payload = safeNotificationPayload(notification.payload);

  if (type === "match") {
    return openTrainingMatchDestination(notification, userId);
  }

  if (type === "trainer_connection_request" || type === "trainer_connection_accepted") {
    return pushHref("/trainers/connections");
  }

  if (type === "message") {
    const conversationId = asString(payload.conversation_id);
    if (conversationId) return pushHref(`/chat/${conversationId}`);
    return { ok: false, message: "This message conversation is no longer available." };
  }

  return openNotificationTarget(notification);
}

export function openNotificationTarget(notification: Notification): NotificationNavResult {
  const { type } = notification;
  const payload = safeNotificationPayload(notification.payload);

  if (type === "message") {
    const conversationId = asString(payload.conversation_id);
    if (conversationId) return pushHref(`/chat/${conversationId}`);
    return { ok: false, message: "This message conversation is no longer available." };
  }

  if (type === "post_share") {
    if (payload.destination === "message") {
      const conversationId = asString(payload.conversation_id);
      if (conversationId) return pushHref(`/chat/${conversationId}`);
      return { ok: false, message: "This shared post message is no longer available." };
    }

    const postTarget = postHref(payload);
    if (postTarget) return pushHref(postTarget);

    const groupId = asString(payload.group_id);
    if (groupId) return pushHref(`/group/${groupId}`);

    const challengeId = asString(payload.challenge_id);
    if (challengeId) return pushHref(`/challenge/${challengeId}`);

    return { ok: false, message: "This shared post is no longer available." };
  }

  if (type === "like" || type === "reaction" || type === "comment" || type === "comment_reply") {
    const postTarget = postHref(payload);
    if (postTarget) return pushHref(postTarget);
    return { ok: false, message: "This post is no longer available." };
  }

  if (type === "match") {
    return pushHref("/matching/matches");
  }

  if (type === "trainer_connection_request" || type === "trainer_connection_accepted") {
    return pushHref("/trainers/connections");
  }

  if (type === "follow") {
    const profileHref = actorProfileHref(notification);
    if (profileHref) return pushHref(profileHref);
    return { ok: false, message: "This profile is no longer available." };
  }

  if (type === "event_join" || type === "event_invite") {
    const eventId = asString(payload.event_id);
    if (eventId) return pushHref(`/event/${eventId}`);
    return { ok: false, message: "This event is no longer available." };
  }

  if (type === "challenge_join" || type === "challenge_reminder") {
    const challengeId = asString(payload.challenge_id);
    if (challengeId) return pushHref(`/challenge/${challengeId}`);
    return { ok: false, message: "This challenge is no longer available." };
  }

  if (type === "group_invite") {
    const groupId = asString(payload.group_id);
    if (groupId) return pushHref(`/group/${groupId}`);
    return { ok: false, message: "This group is no longer available." };
  }

  const fallbackPost = postHref(payload);
  if (fallbackPost) return pushHref(fallbackPost);

  const fallbackProfile = actorProfileHref(notification);
  if (fallbackProfile) return pushHref(fallbackProfile);

  return { ok: false, message: "This notification is no longer available." };
}

export async function openNotificationFromPushDataAsync(
  data: Record<string, unknown>,
  userId: string
): Promise<NotificationNavResult> {
  const type = asString(data.type);
  const payload = safeNotificationPayload(data);

  if (type === "match") {
    const partnerId = asString(data.matched_user_id) ?? asString(payload.matched_user_id);
    if (partnerId) {
      try {
        const conversationId = await getOrCreateConversation(userId, partnerId);
        return pushHref(`/chat/${conversationId}`);
      } catch {
        return pushHref("/matching/matches");
      }
    }
    return pushHref("/matching/matches");
  }

  if (type === "trainer_connection_request" || type === "trainer_connection_accepted") {
    return pushHref("/trainers/connections");
  }

  if (type === "message") {
    const conversationId = asString(data.conversation_id) ?? asString(payload.conversation_id);
    if (conversationId) return pushHref(`/chat/${conversationId}`);
    return { ok: false, message: "This message conversation is no longer available." };
  }

  return openNotificationFromPushData(data);
}

export function openNotificationFromPushData(data: Record<string, unknown>): NotificationNavResult {
  const type = asString(data.type);
  const actorUsername = asString(data.actor_username);
  const payload = safeNotificationPayload(data);

  if (type === "message") {
    const conversationId = asString(data.conversation_id) ?? asString(payload.conversation_id);
    if (conversationId) return pushHref(`/chat/${conversationId}`);
    return { ok: false, message: "This message conversation is no longer available." };
  }

  if (type === "post_share") {
    if (data.destination === "message" || payload.destination === "message") {
      const conversationId = asString(data.conversation_id) ?? asString(payload.conversation_id);
      if (conversationId) return pushHref(`/chat/${conversationId}`);
      return { ok: false, message: "This shared post message is no longer available." };
    }

    const postId = asString(data.post_id) ?? asString(payload.post_id);
    if (postId) return pushHref(`/post/${postId}`);
    return { ok: false, message: "This shared post is no longer available." };
  }

  const postId = asString(data.post_id) ?? asString(payload.post_id);
  if (
    postId &&
    (type === "like" ||
      type === "reaction" ||
      type === "comment" ||
      type === "comment_reply" ||
      type === "post_share")
  ) {
    return pushHref(`/post/${postId}`);
  }

  if (type === "event_join" || type === "event_invite") {
    const eventId = asString(data.event_id) ?? asString(payload.event_id);
    if (eventId) return pushHref(`/event/${eventId}`);
    return { ok: false, message: "This event is no longer available." };
  }

  if (type === "challenge_join" || type === "challenge_reminder") {
    const challengeId = asString(data.challenge_id) ?? asString(payload.challenge_id);
    if (challengeId) return pushHref(`/challenge/${challengeId}`);
    return { ok: false, message: "This challenge is no longer available." };
  }

  if (type === "group_invite") {
    const groupId = asString(data.group_id) ?? asString(payload.group_id);
    if (groupId) return pushHref(`/group/${groupId}`);
    return { ok: false, message: "This group is no longer available." };
  }

  if (type === "match") {
    return pushHref("/matching/matches");
  }

  if (type === "trainer_connection_request" || type === "trainer_connection_accepted") {
    return pushHref("/trainers/connections");
  }

  if (type === "follow" && actorUsername) {
    return pushHref(`/user/${actorUsername}`);
  }

  return { ok: false, message: "This notification is no longer available." };
}

export async function handlePushNotificationOpen(
  data: Record<string, unknown>,
  userId: string
) {
  const notificationId = asString(data.notification_id);
  if (notificationId) {
    try {
      await markNotificationRead(notificationId);
    } catch {
      // Non-blocking — navigation still proceeds
    }
  }

  const result = await openNotificationFromPushDataAsync(data, userId);
  if (!result.ok) {
    router.push("/notifications");
  }
}
