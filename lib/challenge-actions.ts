import {
  entityAction,
  excludeActions,
  type EntityActionDefinition,
} from "@/lib/entity-actions";

export const CHALLENGE_OWNER_ACTIONS: EntityActionDefinition[] = [
  entityAction("edit", "Edit Challenge"),
  entityAction("delete", "Delete Challenge", { tone: "danger" }),
  entityAction("share", "Share Challenge"),
  entityAction("copy_link", "Copy Link"),
  entityAction("duplicate", "Duplicate Challenge", { placeholder: true }),
  entityAction("view_participants", "View Participants"),
  entityAction("close_early", "Close Challenge Early"),
];

export const CHALLENGE_VIEWER_ACTIONS: EntityActionDefinition[] = [
  entityAction("share", "Share Challenge"),
  entityAction("copy_link", "Copy Link"),
  entityAction("report", "Report Challenge"),
  entityAction("block", "Block User"),
];

export function isChallengeClosed(challenge: { end_date: string }) {
  return new Date(challenge.end_date).getTime() <= Date.now();
}

export function challengeActionsForRole(
  isOwner: boolean,
  challenge?: { end_date: string } | null
): EntityActionDefinition[] {
  const actions = isOwner ? CHALLENGE_OWNER_ACTIONS : CHALLENGE_VIEWER_ACTIONS;
  if (isOwner && challenge && isChallengeClosed(challenge)) {
    return excludeActions(actions, ["close_early"]);
  }
  return actions;
}
