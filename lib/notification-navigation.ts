import { router } from "expo-router";
import type { Notification } from "@frennix/types";
import { markNotificationRead } from "@frennix/api";

export function openNotificationTarget(notification: Notification) {
  const { type, payload, actor } = notification;

  if (type === "message" && payload.conversation_id) {
    router.push(`/chat/${payload.conversation_id as string}`);
    return;
  }

  if (type === "post_share") {
    if (payload.destination === "message" && payload.conversation_id) {
      router.push(`/chat/${payload.conversation_id as string}`);
      return;
    }
    if (payload.post_id) {
      router.push(`/post/${payload.post_id as string}`);
      return;
    }
  }

  if (
    (type === "like" ||
      type === "reaction" ||
      type === "comment" ||
      type === "comment_reply") &&
    payload.post_id
  ) {
    router.push(`/post/${payload.post_id as string}`);
    return;
  }

  if (type === "match" && actor?.username) {
    router.push(`/user/${actor.username}`);
    return;
  }

  if (type === "follow" && actor?.username) {
    router.push(`/user/${actor.username}`);
    return;
  }

  if (type === "event_join" && payload.event_id) {
    router.push(`/event/${payload.event_id as string}`);
    return;
  }

  if (type === "challenge_join" && payload.challenge_id) {
    router.push(`/challenge/${payload.challenge_id as string}`);
    return;
  }

  if (payload.post_id) {
    router.push(`/post/${payload.post_id as string}`);
    return;
  }

  router.push("/notifications");
}

export function openNotificationFromPushData(data: Record<string, unknown>) {
  const type = data.type as string | undefined;
  const actorUsername = data.actor_username as string | undefined;

  if (type === "message" && data.conversation_id) {
    router.push(`/chat/${data.conversation_id as string}`);
    return;
  }

  if (type === "post_share") {
    if (data.destination === "message" && data.conversation_id) {
      router.push(`/chat/${data.conversation_id as string}`);
      return;
    }
    if (data.post_id) {
      router.push(`/post/${data.post_id as string}`);
      return;
    }
  }

  if (
    data.post_id &&
    (type === "like" ||
      type === "reaction" ||
      type === "comment" ||
      type === "comment_reply" ||
      type === "post_share")
  ) {
    router.push(`/post/${data.post_id as string}`);
    return;
  }

  if (type === "event_join" && data.event_id) {
    router.push(`/event/${data.event_id as string}`);
    return;
  }

  if (type === "challenge_join" && data.challenge_id) {
    router.push(`/challenge/${data.challenge_id as string}`);
    return;
  }

  if ((type === "follow" || type === "match") && actorUsername) {
    router.push(`/user/${actorUsername}`);
    return;
  }

  router.push("/notifications");
}

export async function handlePushNotificationOpen(data: Record<string, unknown>) {
  const notificationId = data.notification_id as string | undefined;
  if (notificationId) {
    try {
      await markNotificationRead(notificationId);
    } catch {
      // Non-blocking — navigation still proceeds
    }
  }
  openNotificationFromPushData(data);
}
