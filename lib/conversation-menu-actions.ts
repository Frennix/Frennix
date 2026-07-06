import { entityAction, type EntityActionDefinition } from "@/lib/entity-actions";
import type { Conversation } from "@frennix/types";

export const MAX_PINNED_CONVERSATIONS = 3;
export const MAX_FAVORITE_TRAINING_PARTNERS = 5;

/** Inbox management: pin, read state, mute, archive, delete. */
export function buildConversationInboxMenuActions(
  conversation: Conversation
): EntityActionDefinition[] {
  const actions: EntityActionDefinition[] = [];

  if (conversation.is_pinned) {
    actions.push(entityAction("unpin", "Unpin Conversation"));
  } else {
    actions.push(entityAction("pin", "Pin Conversation"));
  }

  actions.push(
    entityAction("mark_read", "Mark as Read"),
    entityAction("mark_unread", "Mark as Unread")
  );

  if (conversation.is_muted) {
    actions.push(entityAction("unmute", "Unmute Notifications"));
  } else {
    actions.push(entityAction("mute", "Mute Notifications"));
  }

  actions.push(
    entityAction("hide", "Archive Conversation"),
    entityAction("delete", "Delete Conversation", { tone: "danger" })
  );

  return actions;
}

/** Favorite partner row menu — unfavorite plus inbox actions. */
export function buildFavoritePartnerConversationMenuActions(
  conversation: Conversation
): EntityActionDefinition[] {
  return [
    entityAction("unfavorite", "Remove from Favorite Training Partners"),
    ...buildConversationInboxMenuActions(conversation),
  ];
}

/** @deprecated Use buildConversationInboxMenuActions — kept for verify script compatibility. */
export function buildConversationMenuActions(
  conversation: Conversation
): EntityActionDefinition[] {
  return buildConversationInboxMenuActions(conversation);
}

export function buildMessageMenuActions(isOwn: boolean): EntityActionDefinition[] {
  const actions: EntityActionDefinition[] = [
    entityAction("reply", "Reply"),
    entityAction("copy", "Copy"),
    entityAction("react", "React"),
    entityAction("delete_for_me", "Delete for me", { tone: "danger" }),
  ];

  if (isOwn) {
    actions.push(
      entityAction("delete_for_everyone", "Delete for everyone", { tone: "danger" })
    );
  }

  return actions;
}
