import {
  entityAction,
  type EntityActionDefinition,
} from "@/lib/entity-actions";

export const POST_OWNER_ACTIONS: EntityActionDefinition[] = [
  entityAction("edit", "Edit Post"),
  entityAction("delete", "Delete Post", { tone: "danger" }),
  entityAction("share", "Share Post"),
  entityAction("copy_link", "Copy Link"),
];

export const POST_VIEWER_ACTIONS: EntityActionDefinition[] = [
  entityAction("share", "Share Post"),
  entityAction("copy_link", "Copy Link"),
  entityAction("report", "Report Post"),
  entityAction("block", "Block User"),
];

export function postActionsForRole(isOwner: boolean): EntityActionDefinition[] {
  return isOwner ? POST_OWNER_ACTIONS : POST_VIEWER_ACTIONS;
}
