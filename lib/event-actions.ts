import {
  entityAction,
  excludeActions,
  type EntityActionDefinition,
} from "@/lib/entity-actions";

export const EVENT_OWNER_ACTIONS: EntityActionDefinition[] = [
  entityAction("edit", "Edit Event"),
  entityAction("cancel", "Cancel Event", { tone: "danger" }),
  entityAction("share", "Share Event"),
  entityAction("copy_link", "Copy Link"),
  entityAction("view_participants", "View Attendees"),
  entityAction("view_analytics", "View Analytics", { placeholder: true }),
  entityAction("invite", "Invite Athletes"),
];

export const EVENT_VIEWER_ACTIONS: EntityActionDefinition[] = [
  entityAction("share", "Share Event"),
  entityAction("copy_link", "Copy Link"),
  entityAction("report", "Report Event"),
  entityAction("block", "Block User"),
];

export function eventActionsForRole(
  isOwner: boolean,
  event?: { status: string } | null
): EntityActionDefinition[] {
  const actions = isOwner ? EVENT_OWNER_ACTIONS : EVENT_VIEWER_ACTIONS;
  if (isOwner && event?.status === "cancelled") {
    return excludeActions(actions, ["cancel", "invite", "edit"]);
  }
  return actions;
}
