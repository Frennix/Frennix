import type { Conversation } from "@frennix/types";

function inboxRowSignature(conversation: Conversation): string {
  const last = conversation.last_message;
  return [
    conversation.id,
    conversation.updated_at,
    conversation.unread_count ?? 0,
    conversation.is_pinned ? 1 : 0,
    conversation.pinned_at ?? "",
    conversation.is_favorite ? 1 : 0,
    conversation.favorited_at ?? "",
    conversation.is_muted ? 1 : 0,
    conversation.marked_unread ? 1 : 0,
    conversation.other_participant?.display_name ?? "",
    conversation.other_participant?.avatar_url ?? "",
    conversation.other_participant?.is_online ? 1 : 0,
    conversation.other_participant?.last_seen_at ?? "",
    last?.id ?? "",
    last?.content ?? "",
    last?.created_at ?? "",
    last?.deleted_for_everyone_at ?? "",
    last?.media_url ?? "",
    last?.post_id ?? "",
  ].join("|");
}

/** Preserve row object identity when a background refresh returns unchanged data. */
export function mergeInboxConversations(
  previous: Conversation[] | undefined,
  incoming: Conversation[]
): Conversation[] {
  if (!previous?.length) return incoming;

  const previousById = new Map(previous.map((conversation) => [conversation.id, conversation]));
  let reusedCount = 0;

  const merged = incoming.map((conversation) => {
    const existing = previousById.get(conversation.id);
    if (!existing) return conversation;
    if (inboxRowSignature(existing) === inboxRowSignature(conversation)) {
      reusedCount += 1;
      return existing;
    }
    return conversation;
  });

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.info("[messaging-perf] mergeInboxConversations", {
      incoming: incoming.length,
      reusedRows: reusedCount,
      updatedRows: incoming.length - reusedCount,
    });
  }

  return merged;
}
