import { entityAction, type EntityActionDefinition } from "@/lib/entity-actions";

export const COMMENT_OWNER_ACTIONS: EntityActionDefinition[] = [
  entityAction("edit", "Edit Comment"),
  entityAction("delete", "Delete Comment", { tone: "danger" }),
  entityAction("share", "Share Comment"),
  entityAction("copy_link", "Copy Link"),
];

export const COMMENT_VIEWER_ACTIONS: EntityActionDefinition[] = [
  entityAction("share", "Share Comment"),
  entityAction("copy_link", "Copy Link"),
  entityAction("report", "Report Comment"),
  entityAction("block", "Block User"),
];

export function commentActionsForRole(isOwner: boolean): EntityActionDefinition[] {
  return isOwner ? COMMENT_OWNER_ACTIONS : COMMENT_VIEWER_ACTIONS;
}
