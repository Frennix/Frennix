import { entityAction, type EntityActionDefinition } from "@/lib/entity-actions";

export const GROUP_OWNER_ACTIONS: EntityActionDefinition[] = [
  entityAction("edit", "Edit Group"),
  entityAction("delete", "Delete Group", { tone: "danger" }),
  entityAction("share", "Share Group"),
  entityAction("copy_link", "Copy Link"),
  entityAction("view_participants", "View Members"),
  entityAction("view_analytics", "View Analytics", { placeholder: true }),
];

export const GROUP_VIEWER_ACTIONS: EntityActionDefinition[] = [
  entityAction("share", "Share Group"),
  entityAction("copy_link", "Copy Link"),
  entityAction("report", "Report Group"),
  entityAction("block", "Block User"),
];

export function groupActionsForRole(isOwner: boolean): EntityActionDefinition[] {
  return isOwner ? GROUP_OWNER_ACTIONS : GROUP_VIEWER_ACTIONS;
}
