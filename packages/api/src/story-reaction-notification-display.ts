import type { Notification } from "@frennix/types";
import { parseStoryReactionMessage } from "@frennix/types";
import { storyReactionDedupeKey } from "@frennix/notifications";
import { getSupabase } from "./supabase";

export type MountedStoryReactionRefs = {
  storyId: string | null;
  storyItemId: string | null;
  actorId: string | null;
  storedReaction: string | null;
  conversationId: string | null;
  messageId: string | null;
  dedupeKey: string | null;
  computedDedupeKey: string | null;
  payloadKeys: string[];
};

export type StoryReactionMessageProbeRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  story_reply_id: string | null;
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function firstPayloadString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asNonEmptyString(payload[key]);
    if (value) return value;
  }
  return null;
}

export function safeMountedNotificationPayload(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

export function extractMountedStoryReactionRefs(
  notification: Notification
): MountedStoryReactionRefs {
  const payload = safeMountedNotificationPayload(notification.payload);
  const storyId = firstPayloadString(payload, ["story_id", "storyId"]);
  const storyItemId = firstPayloadString(payload, [
    "story_item_id",
    "slide_id",
    "slideId",
    "storyItemId",
  ]);
  const actorId =
    asNonEmptyString(notification.actor_id) ??
    firstPayloadString(payload, ["reactor_id", "actor_id", "user_id", "viewer_id"]);
  const storedReaction = firstPayloadString(payload, ["reaction", "emoji"]);
  const conversationId = firstPayloadString(payload, ["conversation_id", "conversationId"]);
  const messageId = firstPayloadString(payload, ["message_id", "messageId"]);
  const computedDedupeKey =
    storyId && actorId ? storyReactionDedupeKey(storyId, actorId) : null;

  return {
    storyId,
    storyItemId,
    actorId,
    storedReaction,
    conversationId,
    messageId,
    dedupeKey: asNonEmptyString(notification.dedupe_key) ?? computedDedupeKey,
    computedDedupeKey,
    payloadKeys: Object.keys(payload).sort(),
  };
}

export function applyMountedStoryReactionFromReadableSource(input: {
  notification: Notification;
  dmRow?: StoryReactionMessageProbeRow | null;
}): Notification {
  const refs = extractMountedStoryReactionRefs(input.notification);
  const dmReaction = input.dmRow
    ? parseStoryReactionMessage(input.dmRow.content)?.emoji ?? null
    : null;
  const displayReaction = dmReaction ?? refs.storedReaction;
  if (!displayReaction || displayReaction === refs.storedReaction) {
    return input.notification;
  }
  return {
    ...input.notification,
    payload: {
      ...safeMountedNotificationPayload(input.notification.payload),
      reaction: displayReaction,
    },
  };
}

function uniqueStrings(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function findDmRow(
  rows: StoryReactionMessageProbeRow[],
  refs: MountedStoryReactionRefs
): StoryReactionMessageProbeRow | null {
  return (
    rows.find((row) => Boolean(refs.messageId) && row.id === refs.messageId) ??
    rows.find(
      (row) =>
        Boolean(refs.conversationId) &&
        Boolean(refs.actorId) &&
        row.conversation_id === refs.conversationId &&
        row.sender_id === refs.actorId &&
        row.story_reply_id === refs.storyId
    ) ??
    rows.find(
      (row) =>
        Boolean(refs.conversationId) &&
        Boolean(refs.actorId) &&
        row.conversation_id === refs.conversationId &&
        row.sender_id === refs.actorId &&
        !row.story_reply_id
    ) ??
    null
  );
}

async function loadReadableReactionMessages(input: {
  messageIds: string[];
  conversationIds: string[];
  actorIds: string[];
}): Promise<StoryReactionMessageProbeRow[]> {
  const rows: StoryReactionMessageProbeRow[] = [];

  if (input.messageIds.length) {
    const byId = await getSupabase()
      .from("messages")
      .select("id, conversation_id, sender_id, content, story_reply_id")
      .in("id", input.messageIds)
      .is("deleted_for_everyone_at", null);
    if (!byId.error && byId.data?.length) {
      rows.push(...(byId.data as StoryReactionMessageProbeRow[]));
    }
  }

  const haveAllIds = input.messageIds.length > 0 && rows.length === input.messageIds.length;
  if (haveAllIds || !input.conversationIds.length || !input.actorIds.length) {
    return rows;
  }

  const fallback = await getSupabase()
    .from("messages")
    .select("id, conversation_id, sender_id, content, story_reply_id")
    .in("conversation_id", input.conversationIds)
    .in("sender_id", input.actorIds)
    .is("deleted_for_everyone_at", null)
    .like("content", "Reacted % to your story")
    .order("created_at", { ascending: false })
    .limit(50);
  if (fallback.error || !fallback.data?.length) return rows;

  const seen = new Set(rows.map((row) => row.id));
  for (const row of fallback.data as StoryReactionMessageProbeRow[]) {
    if (!seen.has(row.id)) {
      rows.push(row);
      seen.add(row.id);
    }
  }
  return rows;
}

/**
 * Owner Notifications Center overlay.
 *
 * The stored notification payload is not updated when the viewer changes emoji.
 * The owner-readable current source is the existing reaction DM.
 */
export async function overlayMountedStoryReactionNotifications(
  notifications: Notification[]
): Promise<Notification[]> {
  const targets = notifications.filter((notification) => notification.type === "story_reaction");
  if (!targets.length) return notifications;

  const extracted = targets.map((notification) => ({
    notification,
    refs: extractMountedStoryReactionRefs(notification),
  }));
  const dmRows = await loadReadableReactionMessages({
    messageIds: uniqueStrings(extracted.map((item) => item.refs.messageId)),
    conversationIds: uniqueStrings(extracted.map((item) => item.refs.conversationId)),
    actorIds: uniqueStrings(extracted.map((item) => item.refs.actorId)),
  });

  return notifications.map((notification) => {
    if (notification.type !== "story_reaction") return notification;
    return applyMountedStoryReactionFromReadableSource({
      notification,
      dmRow: findDmRow(dmRows, extractMountedStoryReactionRefs(notification)),
    });
  });
}
