import type { NotificationCopy, NotificationCopyInput } from "./types";
import type { ExtendedNotificationType } from "./types";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function buildNotificationCopy(input: NotificationCopyInput): NotificationCopy {
  const { type, actorName, payload } = input;
  const actor = actorName.trim() || "Someone";

  switch (type as ExtendedNotificationType) {
    case "message":
    case "group_message": {
      const preview = asString(payload.preview);
      if (payload.from_training_match === true) {
        return {
          title: "Training partner message",
          body: preview ? `${actor}: ${preview}` : `${actor} sent you a message`,
        };
      }
      if (payload.from_trainer_connection === true) {
        return {
          title: "Coach message",
          body: preview ? `${actor}: ${preview}` : `${actor} sent you a message`,
        };
      }
      return {
        title: "New message",
        body: preview ? `${actor}: ${preview}` : `${actor} sent you a message`,
      };
    }
    case "like":
      return { title: "New like", body: `${actor} liked your post` };
    case "reaction": {
      const emoji = asString(payload.emoji) ?? "😊";
      return { title: "New reaction", body: `${actor} reacted ${emoji} to your post` };
    }
    case "comment":
      return { title: "New comment", body: `${actor} commented on your post` };
    case "comment_reply":
      return { title: "New reply", body: `${actor} replied to your comment` };
    case "mention":
      return { title: "Mention", body: `${actor} mentioned you` };
    case "follow":
      return { title: "New follower", body: `${actor} started following you` };
    case "friend_request":
      return { title: "Friend request", body: `${actor} sent you a friend request` };
    case "match":
      return {
        title: "New Training Match",
        body: `You and ${actor} are ready to train together.`,
      };
    case "event_invite": {
      const title = asString(payload.event_title);
      return {
        title: "Event invitation",
        body: title ? `${actor} invited you to "${title}"` : `${actor} invited you to a workout event`,
      };
    }
    case "event_join": {
      const title = asString(payload.event_title);
      return {
        title: "Event join",
        body: title ? `${actor} joined your event "${title}"` : `${actor} joined your workout event`,
      };
    }
    case "event_reminder":
    case "workout_reminder":
    case "training_session_reminder": {
      const title = asString(payload.event_title) ?? asString(payload.session_title);
      return {
        title: "Training reminder",
        body: title ? `Upcoming workout: ${title}` : "You have a workout coming up",
      };
    }
    case "training_session_invite": {
      const title = asString(payload.session_title);
      return {
        title: "Training invite",
        body: title ? `${actor} invited you to "${title}"` : `${actor} invited you to train`,
      };
    }
    case "training_session_accepted": {
      const title = asString(payload.session_title);
      return {
        title: "Invite accepted",
        body: title ? `${actor} accepted "${title}"` : `${actor} accepted your training invite`,
      };
    }
    case "challenge_invite": {
      const title = asString(payload.challenge_title);
      return {
        title: "Challenge invitation",
        body: title ? `${actor} invited you to join "${title}"` : `${actor} invited you to join a challenge`,
      };
    }
    case "challenge_join": {
      const title = asString(payload.challenge_title);
      return {
        title: "Challenge join",
        body: title ? `${actor} joined your challenge "${title}"` : `${actor} joined your challenge`,
      };
    }
    case "challenge_progress":
      return { title: "Challenge update", body: `${actor} made progress on a challenge` };
    case "post_share":
      return { title: "Post shared", body: `${actor} shared your post` };
    case "story_reaction": {
      const emoji = asString(payload.reaction) ?? "❤️";
      return { title: "Story reaction", body: `${actor} reacted ${emoji} to your story` };
    }
    case "story_reply": {
      const preview = asString(payload.preview);
      return {
        title: "Story reply",
        body: preview ? `${actor} replied to your story: ${preview}` : `${actor} replied to your story`,
      };
    }
    case "story_mention":
      return { title: "Story mention", body: `${actor} mentioned you in a story` };
    case "story_challenge_join":
      return { title: "Story challenge", body: `${actor} joined your story challenge` };
    case "trainer_connection_request":
      return { title: "Coaching request", body: `${actor} requested to connect for coaching` };
    case "trainer_connection_accepted":
      return { title: "Coaching request accepted", body: `${actor} accepted your coaching request` };
    case "system_announcement":
      return {
        title: asString(payload.title) ?? "Frennix",
        body: asString(payload.body) ?? "You have a new announcement",
      };
    case "app_update":
      return { title: "Update available", body: "A new version of Frennix is ready" };
    case "ai_coach":
      return { title: "Coach insight", body: asString(payload.body) ?? `${actor} has coaching feedback for you` };
    case "nutrition_reminder":
      return { title: "Nutrition reminder", body: asString(payload.body) ?? "Log your nutrition today" };
    case "habit_reminder":
      return { title: "Habit reminder", body: asString(payload.body) ?? "Keep your habit streak going" };
    case "achievement_badge":
      return { title: "Achievement unlocked", body: asString(payload.body) ?? "You earned a new badge" };
    case "daily_streak_reminder":
      return { title: "Streak reminder", body: asString(payload.body) ?? "Don't break your workout streak" };
    case "weekly_recap":
      return { title: "Weekly recap", body: asString(payload.body) ?? "Your weekly fitness summary is ready" };
    case "monthly_progress_summary":
      return { title: "Monthly progress", body: asString(payload.body) ?? "Your monthly progress summary is ready" };
    case "coach_notification":
      return { title: "Coach update", body: asString(payload.body) ?? `${actor} sent you a coaching update` };
    case "run_club_announcement": {
      const title = asString(payload.club_title) ?? asString(payload.title);
      return {
        title: "Run club update",
        body: title ? `${title}: ${asString(payload.body) ?? "New announcement"}` : "New run club announcement",
      };
    }
    case "referral_reward":
      return { title: "Referral reward", body: asString(payload.body) ?? "You earned a referral reward" };
    case "marketing":
      return {
        title: asString(payload.title) ?? "Frennix",
        body: asString(payload.body) ?? "New update from Frennix",
      };
    case "group_message": {
      const preview = asString(payload.preview);
      const groupName = asString(payload.group_name);
      return {
        title: groupName ? `Message in ${groupName}` : "Group message",
        body: preview ? `${actor}: ${preview}` : `${actor} sent a group message`,
      };
    }
    default:
      return { title: "Frennix", body: "New activity on Frennix" };
  }
}

/** Collapsed push copy for rapid messages from the same sender. */
export function buildGroupedMessageCopy(actorName: string, count: number): NotificationCopy {
  const actor = actorName.trim() || "Someone";
  if (count <= 1) {
    return { title: "New message", body: `${actor} sent you a message` };
  }
  return {
    title: "New messages",
    body: `${actor} sent ${count} new messages.`,
  };
}
