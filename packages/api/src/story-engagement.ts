import type { StoryQuickReactionEmoji } from "@frennix/types";
import { getOrCreateConversation, sendMessage } from "./messaging";
import { trackStoryEngagementEvent } from "./story-insights";
import { sendStoryTrainInvite } from "./story-train-invites";
import { getSupabase } from "./supabase";

export * from "./story-insights";
export * from "./story-train-invites";

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

/** @deprecated Use sendStoryQuickReaction */
export async function sendStoryReaction(
  viewerId: string,
  storyUserId: string,
  postId: string,
  emoji: StoryQuickReactionEmoji
) {
  return sendStoryQuickReaction(viewerId, storyUserId, postId, emoji);
}

export async function sendStoryReply(
  viewerId: string,
  storyUserId: string,
  replyText: string,
  postId?: string | null
) {
  const trimmed = replyText.trim();
  if (!trimmed) throw new Error("Reply cannot be empty");
  if (viewerId === storyUserId) throw new Error("You cannot reply to your own story");

  const conversationId = await getOrCreateConversation(viewerId, storyUserId);
  const message = await sendMessage(
    conversationId,
    viewerId,
    `Replied to your workout story: ${trimmed}`
  );

  if (postId) {
    await trackStoryEngagementEvent({
      viewerId,
      storyUserId,
      postId,
      eventType: "reply",
    }).catch(() => undefined);
  }

  return message;
}

export async function sendStoryChallenge(
  viewerId: string,
  storyUserId: string,
  message: string,
  postId?: string | null
) {
  if (viewerId === storyUserId) return;

  const conversationId = await getOrCreateConversation(viewerId, storyUserId);
  const result = await sendMessage(conversationId, viewerId, message);

  if (postId) {
    await trackStoryEngagementEvent({
      viewerId,
      storyUserId,
      postId,
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
  postId: string | null
) {
  if (!postId || viewerId === storyUserId) return;
  await trackStoryEngagementEvent({
    viewerId,
    storyUserId,
    postId,
    eventType: "profile_visit",
  }).catch(() => undefined);
}

export async function trackStoryFollowFromStory(
  viewerId: string,
  storyUserId: string,
  postId: string | null
) {
  if (!postId || viewerId === storyUserId) return;
  await trackStoryEngagementEvent({
    viewerId,
    storyUserId,
    postId,
    eventType: "follow",
  }).catch(() => undefined);
}
