const ACTIVITY_EMOJIS: Record<string, string> = {
  running: "🏃",
  cycling: "🚴",
  weightlifting: "🏋️",
  yoga: "🧘",
  swimming: "🏊",
  football: "🏈",
  soccer: "⚽",
  basketball: "🏀",
  crossfit: "💪",
  hiking: "🥾",
  martial_arts: "🥋",
  other: "🏅",
};

function capitalizeWords(value: string) {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatWorkoutTypeLabel(workoutType: string) {
  return capitalizeWords(workoutType.replace(/_/g, " "));
}

export function workoutTypeEmoji(workoutType: string) {
  return ACTIVITY_EMOJIS[workoutType] ?? "🏅";
}

export function formatPostSubtitle(workoutType: string | null | undefined, createdAt: string) {
  const time = formatRelativeTime(createdAt);
  if (!workoutType) return time;
  const emoji = workoutTypeEmoji(workoutType);
  const label = formatWorkoutTypeLabel(workoutType);
  return `${emoji} ${label} • ${time}`;
}

const POST_KIND_LABELS: Record<string, string> = {
  photo: "Workout photo",
  video: "Workout video",
  workout_update: "Progress update",
  text: "Update",
};

export function formatPostKindLabel(postType: string) {
  return POST_KIND_LABELS[postType] ?? "Post";
}

export function formatFeedPostMeta(
  post: {
    post_type: string;
    workout_type?: string | null;
    created_at: string;
    challenge_id?: string | null;
    group_id?: string | null;
    event_id?: string | null;
    shared_post_id?: string | null;
  },
  isShared?: boolean
) {
  if (isShared) return `Shared a post · ${formatRelativeTime(post.created_at)}`;

  const time = formatRelativeTime(post.created_at);
  const kind = post.challenge_id ? "Achievement" : formatPostKindLabel(post.post_type);

  if (post.workout_type) {
    const emoji = workoutTypeEmoji(post.workout_type);
    const label = formatWorkoutTypeLabel(post.workout_type);
    return `${kind} · ${emoji} ${label} · ${time}`;
  }

  if (post.group_id) return `${kind} · Group · ${time}`;
  if (post.event_id) return `${kind} · Event · ${time}`;

  return `${kind} · ${time}`;
}

export function formatEngagementSummary(post: {
  like_count?: number;
  comment_count?: number;
  reactions?: { emoji: string; count: number }[];
}) {
  const parts: string[] = [];
  const likeCount = post.like_count ?? 0;
  const reactionTotal = (post.reactions ?? []).reduce((sum, reaction) => sum + reaction.count, 0);

  if (likeCount > 0) {
    parts.push(`${likeCount} ${likeCount === 1 ? "like" : "likes"}`);
  }
  if (reactionTotal > 0) {
    parts.push(`${reactionTotal} ${reactionTotal === 1 ? "reaction" : "reactions"}`);
  }
  if ((post.comment_count ?? 0) > 0) {
    parts.push(`${post.comment_count} ${post.comment_count === 1 ? "comment" : "comments"}`);
  }

  return parts.join(" · ");
}

export function formatReactionSummary(reactions: { emoji: string; count: number }[] = []) {
  return reactions
    .filter((reaction) => reaction.count > 0)
    .map((reaction) => `${reaction.emoji} ${reaction.count}`)
    .join("  ");
}

export function formatStreakBadgeLabel(streak: number) {
  if (streak <= 0) return "No streak";
  return `${streak} day${streak === 1 ? "" : "s"} streak`;
}

export function formatLastWorkoutLabel(
  lastWorkout: {
    created_at: string;
    workout_type?: string | null;
    post_type: string;
  } | null
) {
  if (!lastWorkout) return "No workout posted yet";

  const time = formatRelativeTime(lastWorkout.created_at);
  if (lastWorkout.workout_type) {
    const emoji = workoutTypeEmoji(lastWorkout.workout_type);
    const label = formatWorkoutTypeLabel(lastWorkout.workout_type);
    return `${emoji} ${label} · ${time}`;
  }

  if (lastWorkout.post_type === "video") return `Workout video · ${time}`;
  if (lastWorkout.post_type === "photo") return `Workout photo · ${time}`;
  return `Progress update · ${time}`;
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isYesterday(date: Date, now: Date) {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameCalendarDay(date, yesterday);
}

/** Relative timestamp in the user's local time zone. */
export function formatRelativeTime(isoDate: string, now = new Date()): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHour = Math.floor(diffMs / 3_600_000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  if (isSameCalendarDay(date, now)) return `${diffHour}h ago`;
  if (isYesterday(date, now)) return "Yesterday";

  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}
