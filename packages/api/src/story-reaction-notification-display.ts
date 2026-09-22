import type { Notification } from "@frennix/types";
import {
  canonicalizeStoryReaction,
  parseStoryReactionMessage,
} from "@frennix/types";
import { storyReactionDedupeKey } from "@frennix/notifications";
import { getSupabaseErrorDetails } from "./profile-utils";
import { getSupabase } from "./supabase";

export const STORY_REACTION_NOTIFICATION_DIAG_KEY = "story_reaction_center_diag";

export type StoryReactionLookupStatus =
  | "succeeded"
  | "no_row"
  | "denied"
  | "error"
  | "mismatch"
  | "skipped";

export type MountedStoryReactionRefs = {
  storyId: string | null;
  storyItemId: string | null;
  actorId: string | null;
  storedReaction: string | null;
  conversationId: string | null;
  messageId: string | null;
  dedupeKey: string | null;
  computedDedupeKey: string | null;
  payloadKeys: string[];
};

export type StoryReactionNotificationDiagnostic = {
  notificationId: string;
  type: string;
  dedupeKey: string | null;
  storedPayloadReaction: string | null;
  storyId: string | null;
  storyItemId: string | null;
  actorId: string | null;
  conversationId: string | null;
  messageId: string | null;
  displayReaction: string | null;
  displaySource: "reaction_dm" | "stored_payload";
  tableLookup: StoryReactionLookupStatus;
  tableReaction: string | null;
  tableError: string | null;
  dmLookup: StoryReactionLookupStatus;
  dmReaction: string | null;
  dmError: string | null;
  mismatches: string[];
  payloadKeys: string[];
};

export type StoryReactionTableProbeRow = {
  story_id: string;
  user_id: string;
  slide_id: string | null;
  reaction: string;
};

export type StoryReactionMessageProbeRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  story_reply_id: string | null;
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function firstPayloadString(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = asNonEmptyString(payload[key]);
    if (value) return value;
  }
  return null;
}

export function safeMountedNotificationPayload(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

export function extractMountedStoryReactionRefs(
  notification: Notification
): MountedStoryReactionRefs {
  const payload = safeMountedNotificationPayload(notification.payload);
  const storyId = firstPayloadString(payload, ["story_id", "storyId"]);
  const storyItemId = firstPayloadString(payload, [
    "story_item_id",
    "slide_id",
    "slideId",
    "storyItemId",
  ]);
  const actorId =
    asNonEmptyString(notification.actor_id) ??
    firstPayloadString(payload, ["reactor_id", "actor_id", "user_id", "viewer_id"]);
  const storedReaction = firstPayloadString(payload, ["reaction", "emoji"]);
  const conversationId = firstPayloadString(payload, ["conversation_id", "conversationId"]);
  const messageId = firstPayloadString(payload, ["message_id", "messageId"]);
  const computedDedupeKey =
    storyId && actorId ? storyReactionDedupeKey(storyId, actorId) : null;

  return {
    storyId,
    storyItemId,
    actorId,
    storedReaction,
    conversationId,
    messageId,
    dedupeKey: asNonEmptyString(notification.dedupe_key) ?? computedDedupeKey,
    computedDedupeKey,
    payloadKeys: Object.keys(payload).sort(),
  };
}

export function classifyStoryReactionLookupError(
  error: unknown
): { status: Exclude<StoryReactionLookupStatus, "succeeded" | "no_row" | "mismatch" | "skipped">; message: string } {
  const details = getSupabaseErrorDetails(error);
  const text = `${details.code ?? ""} ${details.message} ${details.details ?? ""} ${details.hint ?? ""}`;
  const denied =
    details.code === "42501" ||
    /permission denied|row-level security|rls|policy|not authorized/i.test(text);
  return {
    status: denied ? "denied" : "error",
    message: details.message,
  };
}

export function collectMountedStoryReactionMismatches(input: {
  refs: MountedStoryReactionRefs;
  tableRow?: StoryReactionTableProbeRow | null;
  dmRow?: StoryReactionMessageProbeRow | null;
}): string[] {
  const mismatches: string[] = [];
  const { refs, tableRow, dmRow } = input;

  if (refs.dedupeKey && refs.computedDedupeKey && refs.dedupeKey !== refs.computedDedupeKey) {
    mismatches.push(`dedupe_key ${refs.dedupeKey} != computed ${refs.computedDedupeKey}`);
  }
  if (tableRow) {
    if (refs.storyId && tableRow.story_id !== refs.storyId) {
      mismatches.push(`table.story_id ${tableRow.story_id} != payload.story_id ${refs.storyId}`);
    }
    if (refs.actorId && tableRow.user_id !== refs.actorId) {
      mismatches.push(`table.user_id ${tableRow.user_id} != actor ${refs.actorId}`);
    }
    if (refs.storyItemId && tableRow.slide_id && tableRow.slide_id !== refs.storyItemId) {
      mismatches.push(
        `table.slide_id ${tableRow.slide_id} != payload.story_item_id ${refs.storyItemId}`
      );
    }
  }
  if (dmRow) {
    if (refs.conversationId && dmRow.conversation_id !== refs.conversationId) {
      mismatches.push(
        `dm.conversation_id ${dmRow.conversation_id} != payload.conversation_id ${refs.conversationId}`
      );
    }
    if (refs.actorId && dmRow.sender_id !== refs.actorId) {
      mismatches.push(`dm.sender_id ${dmRow.sender_id} != actor ${refs.actorId}`);
    }
    if (refs.storyId && dmRow.story_reply_id && dmRow.story_reply_id !== refs.storyId) {
      mismatches.push(
        `dm.story_reply_id ${dmRow.story_reply_id} != payload.story_id ${refs.storyId}`
      );
    }
  }
  return mismatches;
}

export function attachStoryReactionNotificationDiagnostic(
  notification: Notification,
  diagnostic: StoryReactionNotificationDiagnostic
): Notification {
  const metadata =
    notification.metadata && typeof notification.metadata === "object" && !Array.isArray(notification.metadata)
      ? notification.metadata
      : {};
  return {
    ...notification,
    metadata: {
      ...metadata,
      [STORY_REACTION_NOTIFICATION_DIAG_KEY]: diagnostic,
    },
  };
}

export function getStoryReactionNotificationDiagnostic(
  notification: Notification
): StoryReactionNotificationDiagnostic | null {
  const metadata = notification.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const diagnostic = metadata[STORY_REACTION_NOTIFICATION_DIAG_KEY];
  if (!diagnostic || typeof diagnostic !== "object") return null;
  return diagnostic as StoryReactionNotificationDiagnostic;
}

export function formatStoryReactionNotificationDiagnostic(
  diagnostic: StoryReactionNotificationDiagnostic
): string {
  return [
    `id ${diagnostic.notificationId.slice(0, 8)}  type ${diagnostic.type}`,
    `dedupe ${diagnostic.dedupeKey ?? "none"}`,
    `stored ${diagnostic.storedPayloadReaction ?? "none"}  display ${diagnostic.displayReaction ?? "none"}  via ${diagnostic.displaySource}`,
    `story ${diagnostic.storyId ?? "none"}  item ${diagnostic.storyItemId ?? "none"}`,
    `actor ${diagnostic.actorId ?? "none"}`,
    `table ${diagnostic.tableLookup}${diagnostic.tableReaction ? ` ${diagnostic.tableReaction}` : ""}${diagnostic.tableError ? ` ${diagnostic.tableError}` : ""}`,
    `dm ${diagnostic.dmLookup}${diagnostic.dmReaction ? ` ${diagnostic.dmReaction}` : ""}${diagnostic.dmError ? ` ${diagnostic.dmError}` : ""}`,
    diagnostic.mismatches.length ? `mismatch ${diagnostic.mismatches.join(" | ")}` : "mismatch none",
  ].join("\n");
}

export function applyMountedStoryReactionFromReadableSource(input: {
  notification: Notification;
  tableRow?: StoryReactionTableProbeRow | null;
  tableStatus: StoryReactionLookupStatus;
  tableError?: string | null;
  dmRow?: StoryReactionMessageProbeRow | null;
  dmStatus: StoryReactionLookupStatus;
  dmError?: string | null;
}): { notification: Notification; diagnostic: StoryReactionNotificationDiagnostic } {
  const refs = extractMountedStoryReactionRefs(input.notification);
  const dmReaction = input.dmRow
    ? parseStoryReactionMessage(input.dmRow.content)?.emoji ?? null
    : null;
  const tableReaction = input.tableRow?.reaction
    ? canonicalizeStoryReaction(input.tableRow.reaction)?.emoji ?? input.tableRow.reaction
    : null;
  const displayReaction = dmReaction ?? refs.storedReaction;
  const displaySource = dmReaction ? "reaction_dm" : "stored_payload";
  const mismatches = collectMountedStoryReactionMismatches({
    refs,
    tableRow: input.tableRow,
    dmRow: input.dmRow,
  });

  const diagnostic: StoryReactionNotificationDiagnostic = {
    notificationId: input.notification.id,
    type: input.notification.type,
    dedupeKey: refs.dedupeKey,
    storedPayloadReaction: refs.storedReaction,
    storyId: refs.storyId,
    storyItemId: refs.storyItemId,
    actorId: refs.actorId,
    conversationId: refs.conversationId,
    messageId: refs.messageId,
    displayReaction,
    displaySource,
    tableLookup: input.tableStatus,
    tableReaction,
    tableError: input.tableError ?? null,
    dmLookup: input.dmStatus,
    dmReaction,
    dmError: input.dmError ?? null,
    mismatches,
    payloadKeys: refs.payloadKeys,
  };

  let next = input.notification;
  if (displayReaction && displayReaction !== refs.storedReaction) {
    const payload = {
      ...safeMountedNotificationPayload(input.notification.payload),
      reaction: displayReaction,
    };
    next = { ...input.notification, payload };
  }

  return {
    notification: attachStoryReactionNotificationDiagnostic(next, diagnostic),
    diagnostic,
  };
}

function uniqueStrings(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function findTableRow(
  rows: StoryReactionTableProbeRow[],
  refs: MountedStoryReactionRefs
): StoryReactionTableProbeRow | null {
  return (
    rows.find((row) => row.story_id === refs.storyId && row.user_id === refs.actorId) ??
    rows.find(
      (row) =>
        Boolean(refs.storyItemId) &&
        row.slide_id === refs.storyItemId &&
        row.user_id === refs.actorId
    ) ??
    null
  );
}

function findDmRow(
  rows: StoryReactionMessageProbeRow[],
  refs: MountedStoryReactionRefs
): StoryReactionMessageProbeRow | null {
  return (
    rows.find((row) => Boolean(refs.messageId) && row.id === refs.messageId) ??
    rows.find(
      (row) =>
        Boolean(refs.conversationId) &&
        Boolean(refs.actorId) &&
        row.conversation_id === refs.conversationId &&
        row.sender_id === refs.actorId &&
        row.story_reply_id === refs.storyId
    ) ??
    rows.find(
      (row) =>
        Boolean(refs.conversationId) &&
        Boolean(refs.actorId) &&
        row.conversation_id === refs.conversationId &&
        row.sender_id === refs.actorId &&
        !row.story_reply_id
    ) ??
    null
  );
}

async function probeStoryItemReactions(
  storyIds: string[]
): Promise<{
  rows: StoryReactionTableProbeRow[];
  status: StoryReactionLookupStatus;
  error: string | null;
}> {
  if (!storyIds.length) {
    return { rows: [], status: "skipped", error: null };
  }

  const { data, error } = await getSupabase()
    .from("story_item_reactions")
    .select("story_id, user_id, slide_id, reaction")
    .in("story_id", storyIds);

  if (error) {
    const classified = classifyStoryReactionLookupError(error);
    console.info("[notifications-center] story_item_reactions lookup", {
      status: classified.status,
      error: classified.message,
      storyIds,
    });
    return { rows: [], status: classified.status, error: classified.message };
  }

  const rows = (data ?? []) as StoryReactionTableProbeRow[];
  return {
    rows,
    status: rows.length ? "succeeded" : "no_row",
    error: null,
  };
}

async function probeReadableReactionMessages(input: {
  messageIds: string[];
  conversationIds: string[];
  actorIds: string[];
}): Promise<{
  rows: StoryReactionMessageProbeRow[];
  status: StoryReactionLookupStatus;
  error: string | null;
}> {
  const rows: StoryReactionMessageProbeRow[] = [];
  let status: StoryReactionLookupStatus = "skipped";
  let lookupError: string | null = null;

  if (input.messageIds.length) {
    const byId = await getSupabase()
      .from("messages")
      .select("id, conversation_id, sender_id, content, story_reply_id")
      .in("id", input.messageIds)
      .is("deleted_for_everyone_at", null);
    if (byId.error) {
      const classified = classifyStoryReactionLookupError(byId.error);
      console.info("[notifications-center] reaction dm lookup by id", {
        status: classified.status,
        error: classified.message,
        messageIds: input.messageIds,
      });
      return { rows: [], status: classified.status, error: classified.message };
    }
    rows.push(...((byId.data ?? []) as StoryReactionMessageProbeRow[]));
    status = rows.length ? "succeeded" : "no_row";
  }

  const haveAllIds = input.messageIds.length > 0 && rows.length === input.messageIds.length;
  if (
    !haveAllIds &&
    input.conversationIds.length &&
    input.actorIds.length
  ) {
    const fallback = await getSupabase()
      .from("messages")
      .select("id, conversation_id, sender_id, content, story_reply_id")
      .in("conversation_id", input.conversationIds)
      .in("sender_id", input.actorIds)
      .is("deleted_for_everyone_at", null)
      .like("content", "Reacted % to your story")
      .order("created_at", { ascending: false })
      .limit(50);
    if (fallback.error) {
      const classified = classifyStoryReactionLookupError(fallback.error);
      lookupError = classified.message;
      if (status === "skipped" || status === "no_row") {
        status = classified.status;
      }
      console.info("[notifications-center] reaction dm fallback lookup", {
        status: classified.status,
        error: classified.message,
      });
    } else {
      const seen = new Set(rows.map((row) => row.id));
      for (const row of (fallback.data ?? []) as StoryReactionMessageProbeRow[]) {
        if (!seen.has(row.id)) {
          rows.push(row);
          seen.add(row.id);
        }
      }
      if (rows.length) status = "succeeded";
      else if (status === "skipped") status = "no_row";
    }
  }

  return { rows, status, error: lookupError };
}

/**
 * Owner Notifications Center overlay.
 *
 * The stored notification payload is not updated when the viewer changes emoji:
 * create_notification ON CONFLICT DO NOTHING, and the viewer cannot UPDATE the
 * owner's notifications row. The owner-readable current source is the existing
 * reaction DM. story_item_reactions is probed only for diagnostics.
 */
export async function overlayMountedStoryReactionNotifications(
  notifications: Notification[]
): Promise<Notification[]> {
  const targets = notifications.filter((notification) => notification.type === "story_reaction");
  if (!targets.length) return notifications;

  const extracted = targets.map((notification) => ({
    notification,
    refs: extractMountedStoryReactionRefs(notification),
  }));

  const [tableProbe, dmProbe] = await Promise.all([
    probeStoryItemReactions(uniqueStrings(extracted.map((item) => item.refs.storyId))),
    probeReadableReactionMessages({
      messageIds: uniqueStrings(extracted.map((item) => item.refs.messageId)),
      conversationIds: uniqueStrings(extracted.map((item) => item.refs.conversationId)),
      actorIds: uniqueStrings(extracted.map((item) => item.refs.actorId)),
    }),
  ]);

  return notifications.map((notification) => {
    if (notification.type !== "story_reaction") return notification;

    const refs = extractMountedStoryReactionRefs(notification);
    const tableRow = findTableRow(tableProbe.rows, refs);
    const dmRow = findDmRow(dmProbe.rows, refs);

    let tableStatus = tableProbe.status;
    if (tableStatus === "succeeded" && !tableRow) {
      tableStatus = tableProbe.rows.length ? "mismatch" : "no_row";
    }

    let dmStatus = dmProbe.status;
    if (dmRow) {
      dmStatus = "succeeded";
    } else if (dmStatus === "succeeded") {
      dmStatus = "mismatch";
    }

    const resolved = applyMountedStoryReactionFromReadableSource({
      notification,
      tableRow,
      tableStatus,
      tableError: tableProbe.error,
      dmRow,
      dmStatus,
      dmError: dmProbe.error,
    });

    console.info("[notifications-center] story_reaction render", {
      notificationId: resolved.diagnostic.notificationId,
      type: resolved.diagnostic.type,
      dedupeKey: resolved.diagnostic.dedupeKey,
      storedPayloadReaction: resolved.diagnostic.storedPayloadReaction,
      storyId: resolved.diagnostic.storyId,
      storyItemId: resolved.diagnostic.storyItemId,
      actorId: resolved.diagnostic.actorId,
      displayReaction: resolved.diagnostic.displayReaction,
      displaySource: resolved.diagnostic.displaySource,
      tableLookup: resolved.diagnostic.tableLookup,
      dmLookup: resolved.diagnostic.dmLookup,
      mismatches: resolved.diagnostic.mismatches,
    });

    return resolved.notification;
  });
}
