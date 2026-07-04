export type AchievementCategory =
  | "workout"
  | "streak"
  | "event"
  | "challenge"
  | "partner"
  | "community"
  | "consistency"
  | "run_club"
  | "coaching";

export interface AchievementDefinition {
  key: string;
  label: string;
  emoji: string;
  description: string;
  category: AchievementCategory;
  sort_order: number;
  is_active: boolean;
}

export interface UserAchievement {
  user_id: string;
  achievement_key: string;
  unlocked_at: string;
  source_event_id: string | null;
  definition?: AchievementDefinition;
}

/** Display shape shared with profile UI. */
export interface ProfileAchievementDisplay {
  id: string;
  emoji: string;
  label: string;
  description: string;
  unlocked_at?: string;
}

/** @deprecated Use PlatformActivityCounts from platform-activity types */
export type { PlatformActivityCounts as ActivityEventCounts } from "./platform-activity";
