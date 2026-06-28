import type { StoryReactionEmoji, StoryViewRecord } from "@frennix/types";
import { getOrCreateConversation, sendMessage } from "./messaging";
import { getSupabase } from "./supabase";

export async function getStoryViewsForViewer(
  viewerId: string,
  storyUserIds: string[]
): Promise<StoryViewRecord[]> {
  if (!storyUserIds.length) return [];

  const { data, error } = await getSupabase()
    .from("story_views")
    .select("story_user_id, last_viewed_post_id, viewed_at")
    .eq("viewer_id", viewerId)
    .in("story_user_id", storyUserIds);

  if (error) throw error;
  return (data ?? []) as StoryViewRecord[];
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
}

export async function sendStoryReaction(
  viewerId: string,
  storyUserId: string,
  postId: string,
  emoji: StoryReactionEmoji
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
}

export async function sendStoryReply(
  viewerId: string,
  storyUserId: string,
  replyText: string
) {
  const trimmed = replyText.trim();
  if (!trimmed) throw new Error("Reply cannot be empty");
  if (viewerId === storyUserId) throw new Error("You cannot reply to your own story");

  const conversationId = await getOrCreateConversation(viewerId, storyUserId);
  return sendMessage(conversationId, viewerId, `Replied to your workout story: ${trimmed}`);
}

export async function sendStoryChallenge(
  viewerId: string,
  storyUserId: string,
  message: string
) {
  if (viewerId === storyUserId) return;

  const conversationId = await getOrCreateConversation(viewerId, storyUserId);
  return sendMessage(conversationId, viewerId, message);
}

export async function sendStoryInviteToTrain(viewerId: string, storyUserId: string) {
  if (viewerId === storyUserId) return;

  const conversationId = await getOrCreateConversation(viewerId, storyUserId);
  return sendMessage(
    conversationId,
    viewerId,
    "Saw your workout story — want to train together? Let's plan a session! 💪"
  );
}
