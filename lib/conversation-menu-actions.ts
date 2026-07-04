import { entityAction, type EntityActionDefinition } from "@/lib/entity-actions";
import type { Conversation } from "@frennix/types";

export const MAX_PINNED_CONVERSATIONS = 3;
export const MAX_FAVORITE_TRAINING_PARTNERS = 5;

export function buildConversationMenuActions(
  conversation: Conversation
): EntityActionDefinition[] {
  const actions: EntityActionDefinition[] = [];

  if (conversation.is_favorite) {
    actions.push(entityAction("unfavorite", "Remove from Favorite Training Partners"));
  } else {
    actions.push(
      entityAction("favorite", "Add to Favorite Training Partners")
    );
  }

  actions.push(
    entityAction("hide", "Hide Conversation"),
    entityAction("delete", "Delete Conversation", { tone: "danger" }),
    conversation.is_muted
      ? entityAction("unmute", "Unmute Notifications")
      : entityAction("mute", "Mute Notifications"),
    entityAction("mark_unread", "Mark as Unread")
  );

  if (conversation.is_pinned) {
    actions.push(entityAction("unpin", "Unpin Conversation"));
  } else {
    actions.push(entityAction("pin", "Pin Conversation"));
  }

  return actions;
}

export function buildMessageMenuActions(isOwn: boolean): EntityActionDefinition[] {
  const actions: EntityActionDefinition[] = [
    entityAction("reply", "Reply"),
    entityAction("copy", "Copy"),
    entityAction("react", "React"),
  ];

  if (isOwn) {
    actions.push(entityAction("delete", "Delete Message", { tone: "danger" }));
  }

  return actions;
}
