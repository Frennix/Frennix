import { entityAction, type EntityActionDefinition } from "@/lib/entity-actions";

export const PROFILE_OWNER_ACTIONS: EntityActionDefinition[] = [
  entityAction("edit", "Edit Profile"),
  entityAction("share", "Share Profile"),
  entityAction("copy_link", "Copy Link"),
];

export const PROFILE_VIEWER_ACTIONS: EntityActionDefinition[] = [
  entityAction("share", "Share Profile"),
  entityAction("copy_link", "Copy Link"),
  entityAction("report", "Report Profile"),
  entityAction("block", "Block User"),
];

export function profileActionsForRole(isOwner: boolean): EntityActionDefinition[] {
  return isOwner ? PROFILE_OWNER_ACTIONS : PROFILE_VIEWER_ACTIONS;
}
