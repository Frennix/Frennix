import type {
  StoryAnalytics,
  StoryQuickReactionEmoji,
  StoryReactionRecord,
  StoryViewerRecord,
} from "@frennix/types";
import { createNotification } from "./notifications";
import { getOrCreateConversation, sendMessage } from "./messaging";
import { trackStoryEngagementEvent } from "./story-insights";
import { sendStoryTrainInvite } from "./story-train-invites";
import { getFollowingIds } from "./follows";
import { getProfilesByIds } from "./profiles";
import { subscribePostgresChanges } from "./realtime-utils";
import { getSupabase } from "./supabase";

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

export async function sendDedicatedStoryReaction(
  viewerId: string,
  storyOwnerId: string,
  storyId: string,
  emoji: StoryQuickReactionEmoji,
  slideId?: string | null
) {
  if (viewerId === storyOwnerId) return;

  const { error } = await getSupabase().from("story_item_reactions").upsert(
    {
      story_id: storyId,
      user_id: viewerId,
      slide_id: slideId ?? null,
      reaction: emoji,
    },
    { onConflict: "story_id,user_id" }
  );

  if (error) throw error;

  await trackStoryEngagementEvent({
    viewerId,
    storyUserId: storyOwnerId,
    storyId,
    eventType: "reaction",
    metadata: { emoji },
  }).catch(() => undefined);

  await createNotification({
    user_id: storyOwnerId,
    type: "story_reaction",
    payload: {
      story_id: storyId,
      reactor_id: viewerId,
      reaction: emoji,
    },
  }).catch(() => undefined);
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

  const conversationId = await getOrCreateConversation(viewerId, storyOwnerId);
  const message = await sendMessage(conversationId, viewerId, trimmed, null, null, null, storyId);

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

async function mapStoryViewerRows(
  storyOwnerId: string,
  rows: Array<{ viewer_id: string; viewed_at: string }>
): Promise<StoryViewerRecord[]> {
  if (!rows.length) return [];

  const viewerIds = rows.map((row) => row.viewer_id as string);

  const [profiles, followingIds, { data: followerRows }] = await Promise.all([
    getProfilesByIds(viewerIds),
    getFollowingIds(storyOwnerId),
    getSupabase().from("follows").select("follower_id").eq("following_id", storyOwnerId),
  ]);

  const followingSet = new Set(followingIds);
  const followsYouSet = new Set((followerRows ?? []).map((row) => row.follower_id as string));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return rows.map((row) => {
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

export async function getStoryViewerCount(
  storyOwnerId: string,
  storyId: string,
  slideId?: string | null
): Promise<number> {
  const table = slideId ? "story_slide_views" : "story_item_views";
  let query = getSupabase()
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("story_id", storyId)
    .neq("viewer_id", storyOwnerId);

  if (slideId) {
    query = query.eq("slide_id", slideId);
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
  const table = slideId ? "story_slide_views" : "story_item_views";

  let query = getSupabase()
    .from(table)
    .select("viewer_id, viewed_at")
    .eq("story_id", storyId)
    .neq("viewer_id", storyOwnerId)
    .order("viewed_at", { ascending: false });

  if (slideId) {
    query = query.eq("slide_id", slideId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return mapStoryViewerRows(storyOwnerId, (data ?? []) as Array<{ viewer_id: string; viewed_at: string }>);
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
    (() => {
      let query = getSupabase()
        .from("story_item_views")
        .select("*", { count: "exact", head: true })
        .eq("story_id", storyId);
      if (storyOwnerId) query = query.neq("viewer_id", storyOwnerId);
      return query;
    })(),
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

  return {
    story_id: storyId,
    views: viewsResult.count ?? 0,
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
