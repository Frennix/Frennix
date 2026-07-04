import type { ProfileAchievement, ProfileStats } from "@frennix/types";
import { getProfileAchievementDisplays } from "./achievement-engine";

/**
 * @deprecated Use getProfileAchievementDisplays(userId) — reads from unified activity ledger.
 * Kept as offline fallback when DB tables are unavailable.
 */
export function computeProfileAchievements(stats: ProfileStats): ProfileAchievement[] {
  const badges: ProfileAchievement[] = [];

  if (stats.workoutStreak >= 1 || stats.posts >= 1) {
    badges.push({
      id: "first_workout",
      emoji: "🌟",
      label: "First workout",
      description: "Logged your first workout",
    });
  }
  if (stats.workoutStreak >= 3) {
    badges.push({
      id: "streak_3",
      emoji: "🔥",
      label: "3-day streak",
      description: "3-day workout streak",
    });
  }
  if (stats.workoutStreak >= 7) {
    badges.push({
      id: "streak_7",
      emoji: "🔥",
      label: "Week warrior",
      description: "7-day workout streak",
    });
  }
  if (stats.workoutStreak >= 30) {
    badges.push({
      id: "streak_30",
      emoji: "🔥",
      label: "Streak legend",
      description: "30-day workout streak",
    });
  }
  if (stats.posts >= 10) {
    badges.push({
      id: "workouts_10",
      emoji: "💪",
      label: "10 workouts",
      description: "Completed 10 workouts",
    });
  }
  if (stats.posts >= 25) {
    badges.push({
      id: "workouts_25",
      emoji: "⚡",
      label: "25 workouts",
      description: "Completed 25 workouts",
    });
  }
  if (stats.eventsJoined >= 1) {
    badges.push({
      id: "first_event",
      emoji: "📅",
      label: "First event",
      description: "Attended your first community event",
    });
  }
  if (stats.eventsJoined >= 5) {
    badges.push({
      id: "events_5",
      emoji: "🏅",
      label: "Event regular",
      description: "Attended 5 community events",
    });
  }

  return badges;
}

export { getProfileAchievementDisplays, evaluateUserAchievements, getUserAchievements } from "./achievement-engine";
