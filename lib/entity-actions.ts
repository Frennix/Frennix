/**
 * Shared ownership action framework for all Frennix content types.
 * Each entity defines its menu in lib/{entity}-actions.ts and wires handlers
 * in lib/use{Entity}Actions.tsx.
 */

export type EntityActionId =
  | "edit"
  | "delete"
  | "share"
  | "copy_link"
  | "report"
  | "block"
  | "view_participants"
  | "view_analytics"
  | "close_early"
  | "cancel"
  | "invite"
  | "duplicate";

export type EntityActionTone = "default" | "danger" | "muted";

export interface EntityActionDefinition {
  id: EntityActionId;
  label: string;
  tone?: EntityActionTone;
  /** Shown but triggers a "coming soon" message when selected */
  placeholder?: boolean;
}

export function entityAction(
  id: EntityActionId,
  label: string,
  options?: { tone?: EntityActionTone; placeholder?: boolean }
): EntityActionDefinition {
  return { id, label, ...options };
}

export function excludeActions(
  actions: EntityActionDefinition[],
  ids: EntityActionId[]
): EntityActionDefinition[] {
  const excluded = new Set(ids);
  return actions.filter((action) => !excluded.has(action.id));
}

/** Standard owner menu items — extend per entity with extras (participants, invite, etc.) */
export const STANDARD_OWNER_CORE: EntityActionDefinition[] = [
  entityAction("edit", "Edit"),
  entityAction("delete", "Delete", { tone: "danger" }),
  entityAction("share", "Share"),
  entityAction("copy_link", "Copy Link"),
];

/** Standard viewer menu items */
export const STANDARD_VIEWER_CORE: EntityActionDefinition[] = [
  entityAction("share", "Share"),
  entityAction("copy_link", "Copy Link"),
  entityAction("report", "Report"),
  entityAction("block", "Block"),
];

export function findActionDefinition(
  actions: EntityActionDefinition[],
  actionId: EntityActionId
): EntityActionDefinition | undefined {
  return actions.find((action) => action.id === actionId);
}

export function isPlaceholderAction(
  actions: EntityActionDefinition[],
  actionId: EntityActionId
): boolean {
  return findActionDefinition(actions, actionId)?.placeholder === true;
}
