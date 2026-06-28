import type { StoryEngagementEventType, StoryInsights } from "@frennix/types";
import { getSupabase } from "./supabase";

export async function trackStoryEngagementEvent(input: {
  viewerId: string;
  storyUserId: string;
  postId: string | null;
  eventType: StoryEngagementEventType;
  metadata?: Record<string, unknown>;
}) {
  if (!input.postId) return;
  if (input.viewerId === input.storyUserId && input.eventType !== "view") return;

  const { error } = await getSupabase().from("story_engagement_events").insert({
    viewer_id: input.viewerId,
    story_user_id: input.storyUserId,
    post_id: input.postId,
    event_type: input.eventType,
    metadata: input.metadata ?? {},
  });

  if (error) throw error;
}

export async function getStoryInsights(
  storyUserId: string,
  postId: string
): Promise<StoryInsights> {
  const { data, error } = await getSupabase()
    .from("story_engagement_events")
    .select("event_type")
    .eq("story_user_id", storyUserId)
    .eq("post_id", postId);

  if (error) throw error;

  const counts: StoryInsights = {
    post_id: postId,
    views: 0,
    replies: 0,
    reactions: 0,
    train_invites: 0,
    profile_visits: 0,
    new_followers: 0,
    challenges: 0,
  };

  for (const row of data ?? []) {
    switch (row.event_type as StoryEngagementEventType) {
      case "view":
        counts.views += 1;
        break;
      case "reply":
        counts.replies += 1;
        break;
      case "reaction":
        counts.reactions += 1;
        break;
      case "train_invite":
        counts.train_invites += 1;
        break;
      case "profile_visit":
        counts.profile_visits += 1;
        break;
      case "follow":
        counts.new_followers += 1;
        break;
      case "challenge":
        counts.challenges += 1;
        break;
      default:
        break;
    }
  }

  const { count: viewCount } = await getSupabase()
    .from("story_views")
    .select("*", { count: "exact", head: true })
    .eq("story_user_id", storyUserId)
    .eq("last_viewed_post_id", postId);

  if (viewCount != null) counts.views = Math.max(counts.views, viewCount);

  return counts;
}
