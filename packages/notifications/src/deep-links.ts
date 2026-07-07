import type { DeepLinkInput } from "./types";
import type { ExtendedNotificationType } from "./types";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function encodeQueryParam(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Single source of truth for in-app and push deep links.
 * Never returns "/" except for system types without a specific target.
 */
export function buildDeepLink(input: DeepLinkInput): string {
  const { type, payload, actorUsername } = input;

  switch (type as ExtendedNotificationType) {
    case "message":
    case "group_message":
    case "story_reply": {
      const conversationId = asString(payload.conversation_id);
      return conversationId ? `/chat/${conversationId}` : "/notifications";
    }
    case "comment":
    case "comment_reply":
    case "mention": {
      const postId = asString(payload.post_id);
      if (!postId) return "/notifications";
      const commentId = asString(payload.comment_id) ?? asString(payload.parent_id);
      return commentId
        ? `/post/${postId}?commentId=${encodeQueryParam(commentId)}`
        : `/post/${postId}`;
    }
    case "like":
    case "reaction":
    case "post_share": {
      const postId = asString(payload.post_id);
      return postId ? `/post/${postId}` : "/notifications";
    }
    case "follow":
    case "friend_request": {
      const username = actorUsername ?? asString(payload.username);
      return username ? `/user/${username}` : "/notifications";
    }
    case "match": {
      const conversationId = asString(payload.conversation_id);
      if (conversationId) return `/chat/${conversationId}`;
      return "/matching/matches";
    }
    case "event_join":
    case "event_invite":
    case "event_reminder":
    case "training_session_invite":
    case "training_session_accepted":
    case "training_session_reminder":
    case "workout_reminder": {
      const eventId = asString(payload.event_id) ?? asString(payload.session_id);
      return eventId ? `/event/${eventId}` : "/(tabs)/events";
    }
    case "challenge_join":
    case "challenge_invite":
    case "challenge_reminder":
    case "challenge_progress": {
      const challengeId = asString(payload.challenge_id);
      return challengeId ? `/challenge/${challengeId}` : "/(tabs)/discover";
    }
    case "story_reaction":
    case "story_mention":
    case "story_challenge_join":
    case "story_train_invite": {
      const storyId = asString(payload.story_id);
      const username = actorUsername ?? asString(payload.username);
      if (storyId && username) return `/user/${username}?storyId=${encodeQueryParam(storyId)}`;
      if (username) return `/user/${username}`;
      return "/notifications";
    }
    case "trainer_connection_request":
    case "trainer_connection_accepted":
    case "coach_notification":
      return "/trainers/connections";
    case "run_club_announcement": {
      const clubId = asString(payload.club_id) ?? asString(payload.group_id);
      return clubId ? `/group/${clubId}` : "/(tabs)/discover";
    }
    case "referral_reward":
      return "/invite-friends";
    case "marketing":
      return asString(payload.deep_link) ?? "/notifications";
    case "group_invite": {
      const groupId = asString(payload.group_id);
      return groupId ? `/group/${groupId}` : "/(tabs)/discover";
    }
    case "app_update":
      return "/whats-new";
    case "system_announcement":
    case "ai_coach":
    case "nutrition_reminder":
    case "habit_reminder":
    case "achievement_badge":
    case "daily_streak_reminder":
    case "weekly_recap":
    case "monthly_progress_summary":
      return asString(payload.deep_link) ?? "/notifications";
    default:
      return "/notifications";
  }
}

export function assertSafeDeepLink(deepLink: string): boolean {
  if (!deepLink.startsWith("/")) return false;
  if (deepLink.includes("://")) return false;
  return true;
}
