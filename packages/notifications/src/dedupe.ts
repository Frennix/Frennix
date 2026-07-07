/**
 * Idempotency keys for notification rows — prevents duplicate in-app notifications.
 * Push dedupe uses notification_id + subscription_id separately in delivery layer.
 */

export function messageDedupeKey(messageId: string, recipientId: string): string {
  return `message:${messageId}:${recipientId}`;
}

export function likeDedupeKey(postId: string, actorId: string): string {
  return `like:${postId}:${actorId}`;
}

export function reactionDedupeKey(postId: string, actorId: string, emoji: string): string {
  return `reaction:${postId}:${actorId}:${emoji}`;
}

export function commentDedupeKey(commentId: string, recipientId: string): string {
  return `comment:${commentId}:${recipientId}`;
}

export function followDedupeKey(followerId: string, followingId: string): string {
  return `follow:${followerId}:${followingId}`;
}

export function matchDedupeKey(matchId: string, userId: string): string {
  return `match:${matchId}:${userId}`;
}

export function eventReminderDedupeKey(eventId: string, userId: string, window: string): string {
  return `event_reminder:${eventId}:${userId}:${window}`;
}

export function systemAnnouncementDedupeKey(announcementId: string, userId: string): string {
  return `system:${announcementId}:${userId}`;
}

export function scheduledReminderDedupeKey(type: string, entityId: string, userId: string, slot: string): string {
  return `${type}:${entityId}:${userId}:${slot}`;
}
