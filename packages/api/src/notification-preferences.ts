import type { UserNotificationPreferenceKey, UserNotificationPreferences } from "@frennix/types";
import { DEFAULT_USER_NOTIFICATION_PREFERENCES } from "@frennix/types";
import { USER_NOTIFICATION_CATEGORIES } from "@frennix/notifications";
import { getSupabase } from "./supabase";
import { formatSupabaseError } from "./profile-utils";

type PreferenceRow = UserNotificationPreferences & { user_id: string; updated_at?: string };

const PREFERENCE_SELECT =
  "push_enabled, messages, likes, comments, replies, mentions, followers, matches, events, challenges, stories, run_clubs, groups, system_announcements, marketing, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone";

function rowToPreferences(row: Partial<PreferenceRow> | null | undefined): UserNotificationPreferences {
  return {
    ...DEFAULT_USER_NOTIFICATION_PREFERENCES,
    ...(row ?? {}),
  };
}

export async function getUserNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferences> {
  const { data, error } = await getSupabase()
    .from("notification_preferences")
    .select(PREFERENCE_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw formatSupabaseError(error, "Failed to load notification settings");

  if (!data) {
    const { data: inserted, error: insertError } = await getSupabase()
      .from("notification_preferences")
      .insert({ user_id: userId })
      .select(PREFERENCE_SELECT)
      .single();

    if (insertError) throw formatSupabaseError(insertError, "Failed to initialize notification settings");
    return rowToPreferences(inserted as PreferenceRow);
  }

  return rowToPreferences(data as PreferenceRow);
}

export async function updateUserNotificationPreference(
  userId: string,
  key: UserNotificationPreferenceKey,
  value: boolean | string
): Promise<UserNotificationPreferences> {
  const current = await getUserNotificationPreferences(userId);
  const next = { ...current, [key]: value };

  const { data, error } = await getSupabase()
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        ...next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select(PREFERENCE_SELECT)
    .single();

  if (error) throw formatSupabaseError(error, "Failed to update notification settings");
  return rowToPreferences(data as PreferenceRow);
}

/** Toggle a user-facing category (may update multiple preference columns). */
export async function updateUserNotificationCategory(
  userId: string,
  categoryId: string,
  enabled: boolean
): Promise<UserNotificationPreferences> {
  const category = USER_NOTIFICATION_CATEGORIES.find((item) => item.id === categoryId);
  if (!category) throw new Error("Unknown notification category");

  let prefs = await getUserNotificationPreferences(userId);
  for (const key of category.preferenceKeys) {
    prefs = { ...prefs, [key]: enabled };
  }

  const { data, error } = await getSupabase()
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        ...prefs,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select(PREFERENCE_SELECT)
    .single();

  if (error) throw formatSupabaseError(error, "Failed to update notification category");
  return rowToPreferences(data as PreferenceRow);
}

export function isCategoryEnabled(
  prefs: UserNotificationPreferences,
  categoryId: string
): boolean {
  const category = USER_NOTIFICATION_CATEGORIES.find((item) => item.id === categoryId);
  if (!category) return true;
  return category.preferenceKeys.every((key) => prefs[key] !== false);
}

/** Founder-facing 12 categories for settings UI. */
export { USER_NOTIFICATION_CATEGORIES };

/** @deprecated Use USER_NOTIFICATION_CATEGORIES */
export const USER_NOTIFICATION_SETTING_ITEMS: {
  key: Exclude<
    UserNotificationPreferenceKey,
    "push_enabled" | "quiet_hours_enabled" | "quiet_hours_start" | "quiet_hours_end" | "timezone"
  >;
  title: string;
  description: string;
}[] = USER_NOTIFICATION_CATEGORIES.flatMap((category) =>
  category.preferenceKeys.map((key) => ({
    key,
    title: category.title,
    description: category.description,
  }))
);

// Legacy bridge — keep until all clients use UserNotificationPreferences
import type { NotificationPreferenceKey, NotificationPreferences } from "@frennix/types";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@frennix/types";

export function normalizeNotificationPreferences(
  raw: Partial<NotificationPreferences> | null | undefined
): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(raw ?? {}),
  };
}

export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  const prefs = await getUserNotificationPreferences(userId);
  return {
    follow: prefs.followers,
    like: prefs.likes,
    comment: prefs.comments,
    comment_reply: prefs.replies,
    message: prefs.messages,
    match: prefs.matches,
    trainer_connection_request: prefs.matches,
    trainer_connection_accepted: prefs.matches,
    event_join: prefs.events,
    event_invite: prefs.events,
    challenge_join: prefs.challenges,
    challenge_invite: prefs.challenges,
    post_share: prefs.likes,
  };
}

export async function updateNotificationPreference(
  userId: string,
  key: NotificationPreferenceKey,
  enabled: boolean
): Promise<NotificationPreferences> {
  const map: Partial<Record<NotificationPreferenceKey, UserNotificationPreferenceKey>> = {
    follow: "followers",
    like: "likes",
    comment: "comments",
    comment_reply: "replies",
    message: "messages",
    match: "matches",
    trainer_connection_request: "matches",
    trainer_connection_accepted: "matches",
    event_join: "events",
    event_invite: "events",
    challenge_join: "challenges",
    challenge_invite: "challenges",
    post_share: "likes",
  };
  const nextKey = map[key];
  if (!nextKey) throw new Error("Unknown notification preference");
  await updateUserNotificationPreference(userId, nextKey, enabled);
  return getNotificationPreferences(userId);
}

export const NOTIFICATION_SETTING_ITEMS: {
  key: NotificationPreferenceKey;
  title: string;
  description: string;
}[] = [
  { key: "follow", title: "New followers", description: "When someone follows you" },
  { key: "like", title: "Likes & reactions", description: "When someone likes or reacts to your post" },
  { key: "comment", title: "Comments", description: "When someone comments on your post" },
  { key: "comment_reply", title: "Comment replies", description: "When someone replies to your comment" },
  { key: "message", title: "Messages", description: "Direct messages, including from training partners" },
  {
    key: "match",
    title: "Training matches",
    description: "When you and another athlete connect as training partners",
  },
  {
    key: "trainer_connection_request",
    title: "Coaching requests",
    description: "When an athlete requests to connect for coaching",
  },
  {
    key: "trainer_connection_accepted",
    title: "Coaching request accepted",
    description: "When a trainer accepts your coaching request",
  },
  { key: "event_invite", title: "Event invitations", description: "When someone invites you to a workout event" },
  { key: "event_join", title: "Event joins", description: "When someone joins your workout event" },
  { key: "challenge_join", title: "Challenge joins", description: "When someone joins your challenge" },
  {
    key: "challenge_invite",
    title: "Challenge invitations",
    description: "When someone invites you to join a challenge",
  },
  { key: "post_share", title: "Post shares", description: "When someone shares your post" },
];
