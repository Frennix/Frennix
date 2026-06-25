import type { ProfileAchievement, ProfileStats } from "@frennix/types";

export function computeProfileAchievements(stats: ProfileStats): ProfileAchievement[] {
  const badges: ProfileAchievement[] = [];

  if (stats.posts >= 1) {
    badges.push({
      id: "first_post",
      emoji: "🌟",
      label: "First rep",
      description: "Shared your first workout update",
    });
  }
  if (stats.workoutStreak >= 3) {
    badges.push({
      id: "streak_3",
      emoji: "🔥",
      label: "On fire",
      description: "3-day workout streak",
    });
  }
  if (stats.workoutStreak >= 7) {
    badges.push({
      id: "streak_7",
      emoji: "💪",
      label: "Week warrior",
      description: "7-day workout streak",
    });
  }
  if (stats.workoutStreak >= 30) {
    badges.push({
      id: "streak_30",
      emoji: "👑",
      label: "Streak legend",
      description: "30-day workout streak",
    });
  }
  if (stats.posts >= 10) {
    badges.push({
      id: "posts_10",
      emoji: "📸",
      label: "Content creator",
      description: "10+ workouts shared",
    });
  }
  if (stats.followers >= 10) {
    badges.push({
      id: "followers_10",
      emoji: "👥",
      label: "Community",
      description: "10+ followers",
    });
  }
  if (stats.eventsJoined >= 3) {
    badges.push({
      id: "events_3",
      emoji: "🏅",
      label: "Event regular",
      description: "Joined 3+ workout events",
    });
  }
  if (stats.posts >= 25) {
    badges.push({
      id: "posts_25",
      emoji: "⚡",
      label: "Elite athlete",
      description: "25+ workouts logged",
    });
  }

  return badges;
}
