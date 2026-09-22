import type {
  Message,
  StoryAnalytics,
  StoryQuickReactionEmoji,
  StoryReactionRecord,
  StoryViewerRecord,
} from "@frennix/types";
import {
  canonicalizeStoryReaction,
  parseStoryReactionMessage,
  storyReactionIdempotencyKey,
} from "@frennix/types";
import { createNotification, upsertStoryReactionOwnerNotification } from "./notifications";
import { getOrCreateConversation, sendMessage } from "./messaging";
import { trackStoryEngagementEvent } from "./story-insights";
import { sendStoryTrainInvite } from "./story-train-invites";
import { getFollowingIds } from "./follows";
import { getProfilesByIds } from "./profiles";
import { subscribePostgresChanges } from "./realtime-utils";
import { getSupabase, getSupabaseInitUrl, isSupabaseInitialized } from "./supabase";
import { getErrorMessage, getSupabaseErrorDetails, getTechnicalErrorMessage } from "./profile-utils";
import {
  executeStoryReactionDelivery,
  REACTION_DELIVER_ERROR as SHARED_REACTION_DELIVER_ERROR,
  REACTION_SAVE_ERROR,
} from "./story-reaction-delivery";

export * from "./story-insights";
export * from "./story-train-invites";

/** @deprecated Post-based views — use markDedicatedStoryViewed */
export async function getStoryViewsForViewer(
  viewerId: string,
  storyUserIds: string[]
) {
  if (!storyUserIds.length) return [];

  const { data, error } = await getSupabase()
    .from("story_views")
    .select("story_user_id, last_viewed_post_id, viewed_at")
    .eq("viewer_id", viewerId)
    .in("story_user_id", storyUserIds);

  if (error) throw error;
  return data ?? [];
}

export async function markDedicatedStoryViewed(
  viewerId: string,
  storyId: string,
  slideId: string | null,
  storyOwnerId: string
) {
  if (viewerId === storyOwnerId) return;
  const { assertCanViewStory } = await import("./story-controls");
  await assertCanViewStory(storyId);

  const viewedAt = new Date().toISOString();

  const { error } = await getSupabase().from("story_item_views").upsert(
    {
      story_id: storyId,
      viewer_id: viewerId,
      last_viewed_slide_id: slideId,
      viewed_at: viewedAt,
    },
    { onConflict: "story_id,viewer_id" }
  );

  if (error) throw error;

  if (slideId) {
    const { error: slideError } = await getSupabase().from("story_slide_views").upsert(
      {
        story_id: storyId,
        slide_id: slideId,
        viewer_id: viewerId,
        viewed_at: viewedAt,
      },
      { onConflict: "slide_id,viewer_id" }
    );
    if (slideError) throw slideError;
  }

  await trackStoryEngagementEvent({
    viewerId,
    storyUserId: storyOwnerId,
    storyId,
    eventType: "view",
  }).catch(() => undefined);
}

/** @deprecated Use markDedicatedStoryViewed */
export async function markStoryViewed(
  viewerId: string,
  storyUserId: string,
  postId: string | null
) {
  if (!postId) return;

  const { error } = await getSupabase().from("story_views").upsert(
    {
      viewer_id: viewerId,
      story_user_id: storyUserId,
      last_viewed_post_id: postId,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: "viewer_id,story_user_id" }
  );

  if (error) throw error;

  if (viewerId !== storyUserId) {
    await trackStoryEngagementEvent({
      viewerId,
      storyUserId,
      postId,
      eventType: "view",
    }).catch(() => undefined);
  }
}

const REACTION_DELIVER_ERROR = SHARED_REACTION_DELIVER_ERROR;
const MESSAGE_SEND_ERROR = "Message couldn’t be sent. Try again.";

const storyReactionDeliveries = new Map<string, Promise<unknown>>();

async function runStoryReactionDelivery<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = storyReactionDeliveries.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(() => work());
  const wrapped = run.finally(() => {
    if (storyReactionDeliveries.get(key) === wrapped) {
      storyReactionDeliveries.delete(key);
    }
  });
  storyReactionDeliveries.set(key, wrapped);
  return wrapped;
}

async function getStoryReactionPreviewUrl(
  storyId: string,
  slideId?: string | null
): Promise<string | null> {
  if (slideId) {
    const { data, error } = await getSupabase()
      .from("story_slides")
      .select("media_url")
      .eq("id", slideId)
      .maybeSingle();
    if (error) {
      console.warn("[story-reaction] preview lookup failed", getTechnicalErrorMessage(error));
      return null;
    }
    return (data?.media_url as string | null | undefined) ?? null;
  }

  const { data, error } = await getSupabase()
    .from("story_slides")
    .select("media_url")
    .eq("story_id", storyId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[story-reaction] preview lookup failed", getTechnicalErrorMessage(error));
    return null;
  }
  return (data?.media_url as string | null | undefined) ?? null;
}

type StoryReactionMessageRow = Pick<
  Message,
  "id" | "conversation_id" | "content" | "media_url" | "story_reply_id" | "created_at"
>;

async function findStoryReactionMessage(
  conversationId: string,
  viewerId: string,
  storyId: string
): Promise<StoryReactionMessageRow | null> {
  const { data, error } = await getSupabase()
    .from("messages")
    .select("id, conversation_id, content, media_url, story_reply_id, created_at")
    .eq("conversation_id", conversationId)
    .eq("sender_id", viewerId)
    .is("deleted_for_everyone_at", null)
    .like("content", "Reacted % to your story")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  const rows = ((data ?? []) as StoryReactionMessageRow[]).filter((row) =>
    Boolean(parseStoryReactionMessage(row.content))
  );
  return (
    rows.find((row) => row.story_reply_id === storyId) ??
    rows.find((row) => !row.story_reply_id) ??
    null
  );
}

async function bumpConversation(conversationId: string, senderId: string) {
  await getSupabase()
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  const { error } = await getSupabase()
    .from("conversation_user_hides")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", senderId);
  if (error) {
    console.warn("[story-reaction] inbox unhide failed", getTechnicalErrorMessage(error));
  }
}

function logStoryReaction(event: string, extra: Record<string, unknown>) {
  console.info("[story-reaction]", { event, ...extra, t: Date.now() });
}

function isForeignKeyError(error: unknown) {
  const { code, message } = getSupabaseErrorDetails(error);
  return code === "23503" || /foreign key|story_slides/i.test(message);
}

async function upsertStoryReactionRow(row: {
  story_id: string;
  user_id: string;
  slide_id: string | null;
  reaction: StoryQuickReactionEmoji;
}) {
  const write = async (slideId: string | null) =>
    getSupabase()
      .from("story_item_reactions")
      .upsert(
        {
          story_id: row.story_id,
          user_id: row.user_id,
          slide_id: slideId,
          reaction: row.reaction,
        },
        { onConflict: "story_id,user_id" }
      )
      .select("story_id, user_id, slide_id, reaction")
      .single();

  let { data, error } = await write(row.slide_id);
  if (error && row.slide_id && isForeignKeyError(error)) {
    logStoryReaction("reaction-upsert-retry-without-slide", {
      storyId: row.story_id,
      error: getTechnicalErrorMessage(error),
    });
    ({ data, error } = await write(null));
  }

  if (error) {
    const details = getTechnicalErrorMessage(error);
    logStoryReaction("reaction-upsert-supabase-error", {
      storyId: row.story_id,
      emoji: row.reaction,
      error: details,
    });
    throw new Error(details || REACTION_SAVE_ERROR);
  }
  if (!data?.reaction) {
    throw new Error(REACTION_SAVE_ERROR);
  }
  return { reaction: data.reaction as string };
}

function toReplyError(error: unknown): Error {
  const friendly = getErrorMessage(error, MESSAGE_SEND_ERROR);
  if (/commenting is turned off/i.test(friendly)) {
    return new Error(friendly);
  }
  console.error("[story-reply]", getTechnicalErrorMessage(error));
  return new Error(MESSAGE_SEND_ERROR);
}

function isStoryLinkWriteError(error: unknown): boolean {
  const details = getTechnicalErrorMessage(error);
  return /story_reply|can_reply|not allowed|schema cache|column .* does not exist/i.test(details);
}

export async function getViewerStoryReaction(
  viewerId: string,
  storyId: string
): Promise<string | null> {
  if (!viewerId || !storyId) return null;
  const { data, error } = await getSupabase()
    .from("story_item_reactions")
    .select("reaction")
    .eq("story_id", storyId)
    .eq("user_id", viewerId)
    .maybeSingle();
  if (error) {
    console.warn("[story-reaction] load failed", getTechnicalErrorMessage(error));
    return null;
  }
  return (data?.reaction as string | undefined) ?? null;
}

export async function sendDedicatedStoryReaction(
  viewerId: string,
  storyOwnerId: string,
  storyId: string,
  emoji: StoryQuickReactionEmoji,
  slideId?: string | null,
  requestId: number = Date.now(),
  onStage?: (stage: string, status: "pending" | "ok" | "fail", detail?: string) => void
) {
  if (!storyId) throw new Error(REACTION_DELIVER_ERROR);
  if (viewerId === storyOwnerId) {
    throw new Error("You cannot react to your own story");
  }

  const canonical = canonicalizeStoryReaction(emoji);
  if (!canonical) {
    logStoryReaction("unsupported-emoji", { requestId, emoji });
    throw new Error(REACTION_DELIVER_ERROR);
  }

  logStoryReaction("request-started", {
    requestId,
    viewerId,
    storyOwnerId,
    storyId,
    slideId: slideId ?? null,
    emoji: canonical.emoji,
    supabaseReady: isSupabaseInitialized(),
    supabaseHost: getSupabaseInitUrl(),
  });

  const deliveryKey = storyReactionIdempotencyKey(viewerId, storyId);
  onStage?.("reaction write", "pending");
  onStage?.("conversation", "pending");
  onStage?.("message write", "pending");
  onStage?.("owner notify", "pending");
  const result = await runStoryReactionDelivery(deliveryKey, async () =>
    executeStoryReactionDelivery(
      {
        requestId,
        viewerId,
        storyOwnerId,
        storyId,
        slideId,
        emoji: canonical.emoji,
      },
      {
        getExistingReaction: getViewerStoryReaction,
        upsertReaction: async (row) => {
          try {
            const { assertCanViewStory } = await import("./story-controls");
            await assertCanViewStory(row.story_id);
          } catch (error) {
            console.warn(
              "[story-reaction] visibility check failed",
              { requestId, error: getTechnicalErrorMessage(error) }
            );
          }
          const saved = await upsertStoryReactionRow(row);
          await trackStoryEngagementEvent({
            viewerId,
            storyUserId: storyOwnerId,
            storyId,
            eventType: "reaction",
            metadata: { emoji: row.reaction },
          }).catch(() => undefined);
          return saved;
        },
        getOrCreateConversation,
        findExistingMessage: findStoryReactionMessage,
        updateExistingMessage: async (input) => {
          const { data, error } = await getSupabase()
            .from("messages")
            .update({
              content: input.content,
              media_url: input.mediaUrl,
              story_reply_id: input.storyReplyId,
              read_at: null,
            })
            .eq("id", input.id)
            .eq("sender_id", input.senderId)
            .select("id, conversation_id")
            .single();
          if (error) throw new Error(getTechnicalErrorMessage(error));
          if (!data) throw new Error(REACTION_DELIVER_ERROR);
          await bumpConversation(data.conversation_id as string, input.senderId);
          return { id: data.id as string, conversation_id: data.conversation_id as string };
        },
        sendMessage: async (input) => {
          const message = await sendMessage(
            input.conversationId,
            input.senderId,
            input.content,
            input.mediaUrl,
            input.postId,
            input.replyToMessageId,
            input.storyReplyId
          );
          return { id: message.id, conversation_id: message.conversation_id };
        },
        getPreviewUrl: getStoryReactionPreviewUrl,
        isStoryLinkWriteError,
        notifyOwner: async (input) => {
          onStage?.("owner notify", "pending");
          return upsertStoryReactionOwnerNotification({
            ownerId: input.ownerId,
            actorId: input.actorId,
            storyId: input.storyId,
            slideId: input.slideId,
            emoji: input.emoji,
            previousEmoji: input.previousEmoji,
            conversationId: input.conversationId,
            messageId: input.messageId,
          });
        },
        log: (event, extra) => {
          logStoryReaction(event, extra);
          if (event === "reaction-upsert-started") onStage?.("reaction write", "pending");
          if (event === "reaction-upserted") onStage?.("reaction write", "ok", extra.upserted === false ? "already saved" : "upserted");
          if (event === "reaction-upsert-failed" || event === "reaction-upsert-supabase-error") {
            onStage?.("reaction write", "fail", String(extra.error ?? "upsert failed"));
          }
          if (event === "conversation-ready") onStage?.("conversation", "ok");
          if (event === "conversation-failed") onStage?.("conversation", "fail", String(extra.error ?? "conversation failed"));
          if (event === "message-inserted" || event === "message-updated" || event === "message-reused") {
            onStage?.("message write", "ok", event.replace("message-", ""));
          }
          if (event === "message-insert-failed") {
            onStage?.("message write", "fail", String(extra.error ?? "message insert failed"));
          }
          if (event === "owner-notified") {
            onStage?.("owner notify", "ok", String(extra.notifyAction ?? "notified"));
          }
          if (event === "owner-notify-failed") {
            onStage?.("owner notify", "fail", String(extra.error ?? "owner notify failed"));
          }
        },
      }
    )
  );

  logStoryReaction("request-succeeded", {
    requestId: result.requestId,
    storyId,
    conversationId: result.conversationId,
    messageId: result.messageId,
    emoji: result.emoji,
    upserted: result.upserted,
    messageAction: result.messageAction,
    notifyAction: result.notifyAction,
    notificationId: result.notificationId,
  });

  return result.emoji;
}

/** @deprecated Use sendDedicatedStoryReaction */
export async function sendStoryQuickReaction(
  viewerId: string,
  storyUserId: string,
  postId: string,
  emoji: StoryQuickReactionEmoji
) {
  if (viewerId === storyUserId) return;

  const { error } = await getSupabase().from("story_reactions").upsert(
    {
      viewer_id: viewerId,
      story_user_id: storyUserId,
      post_id: postId,
      emoji,
    },
    { onConflict: "viewer_id,post_id" }
  );

  if (error) throw error;

  await trackStoryEngagementEvent({
    viewerId,
    storyUserId,
    postId,
    eventType: "reaction",
    metadata: { emoji },
  }).catch(() => undefined);
}

export async function sendStoryReaction(
  viewerId: string,
  storyUserId: string,
  storyIdOrPostId: string,
  emoji: StoryQuickReactionEmoji,
  options?: { isDedicated?: boolean; slideId?: string | null }
) {
  if (options?.isDedicated) {
    return sendDedicatedStoryReaction(viewerId, storyUserId, storyIdOrPostId, emoji, options.slideId);
  }
  return sendStoryQuickReaction(viewerId, storyUserId, storyIdOrPostId, emoji);
}

export async function sendDedicatedStoryReply(
  viewerId: string,
  storyOwnerId: string,
  replyText: string,
  storyId: string
) {
  const trimmed = replyText.trim();
  if (!trimmed) throw new Error("Reply cannot be empty");
  if (viewerId === storyOwnerId) throw new Error("You cannot reply to your own story");
  if (!storyId) throw new Error(MESSAGE_SEND_ERROR);

  try {
    const { assertCanReplyToStory } = await import("./story-controls");
    await assertCanReplyToStory(storyId);
  } catch (error) {
    const friendly = getErrorMessage(error, MESSAGE_SEND_ERROR);
    if (/commenting is turned off/i.test(friendly)) {
      throw new Error(friendly);
    }
    // Keep the already-loaded story visible. A visibility reload error must
    // not block the DM if the viewer can already see this story.
    console.warn("[story-reply] visibility check failed", getTechnicalErrorMessage(error));
  }

  let conversationId: string;
  try {
    conversationId = await getOrCreateConversation(viewerId, storyOwnerId);
  } catch (error) {
    throw toReplyError(error);
  }

  let message;
  try {
    message = await sendMessage(conversationId, viewerId, trimmed, null, null, null, storyId);
  } catch (error) {
    if (isStoryLinkWriteError(error)) {
      console.warn("[story-reply] retrying without story_reply_id", getTechnicalErrorMessage(error));
      try {
        message = await sendMessage(conversationId, viewerId, trimmed);
      } catch (retryError) {
        throw toReplyError(retryError);
      }
    } else {
      throw toReplyError(error);
    }
  }

  await trackStoryEngagementEvent({
    viewerId,
    storyUserId: storyOwnerId,
    storyId,
    eventType: "reply",
  }).catch(() => undefined);

  await createNotification({
    user_id: storyOwnerId,
    type: "story_reply",
    payload: {
      story_id: storyId,
      replier_id: viewerId,
      conversation_id: conversationId,
      preview: trimmed.slice(0, 120),
    },
  }).catch(() => undefined);

  return message;
}

export async function sendStoryReply(
  viewerId: string,
  storyUserId: string,
  replyText: string,
  storyIdOrPostId?: string | null,
  options?: { isDedicated?: boolean }
) {
  if (options?.isDedicated && storyIdOrPostId) {
    return sendDedicatedStoryReply(viewerId, storyUserId, replyText, storyIdOrPostId);
  }

  const trimmed = replyText.trim();
  if (!trimmed) throw new Error("Reply cannot be empty");
  if (viewerId === storyUserId) throw new Error("You cannot reply to your own story");

  const conversationId = await getOrCreateConversation(viewerId, storyUserId);
  const message = await sendMessage(
    conversationId,
    viewerId,
    `Replied to your Story: ${trimmed}`
  );

  if (storyIdOrPostId) {
    await trackStoryEngagementEvent({
      viewerId,
      storyUserId,
      postId: storyIdOrPostId,
      eventType: "reply",
    }).catch(() => undefined);
  }

  return message;
}

export async function joinStoryChallenge(
  viewerId: string,
  storyOwnerId: string,
  storyId: string,
  challengeId?: string | null,
  trainingChallengeId?: string | null
) {
  if (viewerId === storyOwnerId) return;

  const { error } = await getSupabase().from("story_challenge_joins").insert({
    story_id: storyId,
    challenge_id: challengeId ?? null,
    story_training_challenge_id: trainingChallengeId ?? null,
    user_id: viewerId,
  });

  if (error) throw error;

  await trackStoryEngagementEvent({
    viewerId,
    storyUserId: storyOwnerId,
    storyId,
    eventType: "challenge",
  }).catch(() => undefined);

  await createNotification({
    user_id: storyOwnerId,
    type: "story_challenge_join",
    payload: {
      story_id: storyId,
      challenge_id: challengeId,
      joiner_id: viewerId,
    },
  }).catch(() => undefined);
}

export async function sendStoryChallenge(
  viewerId: string,
  storyUserId: string,
  message: string,
  storyIdOrPostId?: string | null,
  options?: { isDedicated?: boolean }
) {
  if (viewerId === storyUserId) return;

  const conversationId = await getOrCreateConversation(viewerId, storyUserId);
  const result = await sendMessage(conversationId, viewerId, message);

  if (storyIdOrPostId) {
    await trackStoryEngagementEvent({
      viewerId,
      storyUserId,
      storyId: options?.isDedicated ? storyIdOrPostId : undefined,
      postId: options?.isDedicated ? undefined : storyIdOrPostId,
      eventType: "challenge",
    }).catch(() => undefined);
  }

  return result;
}

export async function sendStoryInviteToTrain(
  viewerId: string,
  storyUserId: string,
  postId?: string | null
) {
  return sendStoryTrainInvite(viewerId, storyUserId, postId ?? null);
}

export async function trackStoryProfileVisit(
  viewerId: string,
  storyUserId: string,
  storyIdOrPostId: string | null,
  options?: { isDedicated?: boolean }
) {
  if (!storyIdOrPostId || viewerId === storyUserId) return;
  await trackStoryEngagementEvent({
    viewerId,
    storyUserId,
    storyId: options?.isDedicated ? storyIdOrPostId : undefined,
    postId: options?.isDedicated ? undefined : storyIdOrPostId,
    eventType: "profile_visit",
  }).catch(() => undefined);
}

export async function trackStoryFollowFromStory(
  viewerId: string,
  storyUserId: string,
  storyIdOrPostId: string | null,
  options?: { isDedicated?: boolean }
) {
  if (!storyIdOrPostId || viewerId === storyUserId) return;
  await trackStoryEngagementEvent({
    viewerId,
    storyUserId,
    storyId: options?.isDedicated ? storyIdOrPostId : undefined,
    postId: options?.isDedicated ? undefined : storyIdOrPostId,
    eventType: "follow",
  }).catch(() => undefined);
}

export async function sendStoryEventInvite(
  viewerId: string,
  storyOwnerId: string,
  storyId: string
) {
  if (viewerId === storyOwnerId) return;

  const conversationId = await getOrCreateConversation(viewerId, storyOwnerId);
  const message = await sendMessage(
    conversationId,
    viewerId,
    "I'd love to invite you to a workout event! Want to join me? 📅"
  );

  await trackStoryEngagementEvent({
    viewerId,
    storyUserId: storyOwnerId,
    storyId,
    eventType: "challenge",
    metadata: { kind: "event_invite" },
  }).catch(() => undefined);

  return message;
}

function excludeOwnerViewerRows<T extends { viewer_id: string }>(
  rows: T[],
  storyOwnerId: string | null
): T[] {
  if (!storyOwnerId) return rows;
  return rows.filter((row) => row.viewer_id !== storyOwnerId);
}

async function mapStoryViewerRows(
  storyOwnerId: string | null,
  rows: Array<{ viewer_id: string; viewed_at: string }>
): Promise<StoryViewerRecord[]> {
  const filteredRows = excludeOwnerViewerRows(rows, storyOwnerId);
  if (!filteredRows.length) return [];

  const viewerIds = filteredRows.map((row) => row.viewer_id as string);

  const ownerId = storyOwnerId ?? "";
  const [profiles, followingIds, { data: followerRows }] = await Promise.all([
    getProfilesByIds(viewerIds),
    ownerId ? getFollowingIds(ownerId) : Promise.resolve([]),
    ownerId
      ? getSupabase().from("follows").select("follower_id").eq("following_id", ownerId)
      : Promise.resolve({ data: [] as Array<{ follower_id: string }> }),
  ]);

  const followingSet = new Set(followingIds ?? []);
  const followsYouSet = new Set((followerRows ?? []).map((row) => row.follower_id as string));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return filteredRows.map((row) => {
    const viewerId = row.viewer_id as string;
    const profile = profileById.get(viewerId);
    return {
      viewer_id: viewerId,
      profile: {
        id: profile?.id ?? viewerId,
        username: profile?.username ?? "athlete",
        display_name: profile?.display_name ?? "Athlete",
        avatar_url: profile?.avatar_url ?? null,
        is_online: profile?.is_online ?? null,
        last_seen_at: profile?.last_seen_at ?? null,
      },
      viewed_at: row.viewed_at as string,
      is_following: followingSet.has(viewerId),
      follows_you: followsYouSet.has(viewerId),
    };
  });
}

async function resolveStoryOwnerId(
  storyId: string,
  hintedOwnerId?: string | null
): Promise<string | null> {
  const ownerFromStory = await getStoryOwnerId(storyId);
  return ownerFromStory ?? hintedOwnerId ?? null;
}

/** Unique viewer count for one story slide — story_slide_views is the display source of truth. */
export async function getStoryViewerCount(
  storyOwnerId: string,
  storyId: string,
  slideId?: string | null
): Promise<number> {
  if (!slideId) return 0;

  const ownerId = await resolveStoryOwnerId(storyId, storyOwnerId);
  let query = getSupabase()
    .from("story_slide_views")
    .select("*", { count: "exact", head: true })
    .eq("story_id", storyId)
    .eq("slide_id", slideId);

  if (ownerId) {
    query = query.neq("viewer_id", ownerId);
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function getStoryViewers(
  storyOwnerId: string,
  storyId: string,
  options?: { slideId?: string | null }
): Promise<StoryViewerRecord[]> {
  const slideId = options?.slideId ?? null;
  if (!slideId) return [];

  const ownerId = await resolveStoryOwnerId(storyId, storyOwnerId);

  const { data, error } = await getSupabase()
    .from("story_slide_views")
    .select("viewer_id, viewed_at")
    .eq("story_id", storyId)
    .eq("slide_id", slideId)
    .order("viewed_at", { ascending: false });

  if (error) throw error;

  const rows = excludeOwnerViewerRows(
    (data ?? []) as Array<{ viewer_id: string; viewed_at: string }>,
    ownerId
  );

  return mapStoryViewerRows(ownerId, rows);
}

export async function getStoryReactions(
  storyOwnerId: string,
  storyId: string
): Promise<StoryReactionRecord[]> {
  const { data, error } = await getSupabase()
    .from("story_item_reactions")
    .select("user_id, reaction, created_at")
    .eq("story_id", storyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];

  const userIds = data.map((row) => row.user_id as string);
  const profiles = await getProfilesByIds(userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return data.map((row) => {
    const profile = profileById.get(row.user_id as string);
    return {
      user_id: row.user_id as string,
      profile: {
        id: profile?.id ?? (row.user_id as string),
        username: profile?.username ?? "athlete",
        display_name: profile?.display_name ?? "Athlete",
        avatar_url: profile?.avatar_url ?? null,
      },
      reaction: row.reaction as string,
      created_at: row.created_at as string,
    };
  });
}

async function getStoryOwnerId(storyId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("stories")
    .select("user_id")
    .eq("id", storyId)
    .maybeSingle();
  if (error) throw error;
  return (data?.user_id as string | undefined) ?? null;
}

export async function getDedicatedStoryAnalytics(storyId: string): Promise<StoryAnalytics> {
  const storyOwnerId = await getStoryOwnerId(storyId);

  const [viewsResult, reactionsResult, repliesResult, joinsResult, profileVisitsResult] =
    await Promise.all([
    getSupabase().from("story_slide_views").select("viewer_id").eq("story_id", storyId),
    getSupabase()
      .from("story_item_reactions")
      .select("*", { count: "exact", head: true })
      .eq("story_id", storyId),
    getSupabase()
      .from("story_engagement_events")
      .select("*", { count: "exact", head: true })
      .eq("story_id", storyId)
      .eq("event_type", "reply"),
    getSupabase()
      .from("story_challenge_joins")
      .select("*", { count: "exact", head: true })
      .eq("story_id", storyId),
    getSupabase()
      .from("story_engagement_events")
      .select("*", { count: "exact", head: true })
      .eq("story_id", storyId)
      .eq("event_type", "profile_visit"),
  ]);

  const uniqueViewers = new Set<string>();
  for (const row of viewsResult.data ?? []) {
    const viewerId = row.viewer_id as string;
    if (!viewerId || (storyOwnerId && viewerId === storyOwnerId)) continue;
    uniqueViewers.add(viewerId);
  }

  return {
    story_id: storyId,
    views: uniqueViewers.size,
    reactions: reactionsResult.count ?? 0,
    replies: repliesResult.count ?? 0,
    challenge_joins: joinsResult.count ?? 0,
    profile_visits: profileVisitsResult.count ?? 0,
  };
}

/** Live viewer list updates for story owners. */
export function subscribeStoryViewers(
  storyId: string,
  onChange: () => void
): { unsubscribe: () => void } {
  const subscription = subscribePostgresChanges("story-viewers", storyId, [
    {
      config: {
        event: "*",
        schema: "public",
        table: "story_item_views",
        filter: `story_id=eq.${storyId}`,
      },
      callback: () => onChange(),
    },
    {
      config: {
        event: "*",
        schema: "public",
        table: "story_slide_views",
        filter: `story_id=eq.${storyId}`,
      },
      callback: () => onChange(),
    },
  ]);

  return { unsubscribe: subscription.unsubscribe };
}
