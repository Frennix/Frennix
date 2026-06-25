import type { NotificationPreferenceKey, NotificationPreferences } from "@frennix/types";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@frennix/types";
import { getSupabase } from "./supabase";
import { formatSupabaseError } from "./profile-utils";

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
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("notification_preferences")
    .eq("id", userId)
    .single();

  if (error) throw error;
  const row = data as { notification_preferences?: Partial<NotificationPreferences> };
  return normalizeNotificationPreferences(row.notification_preferences);
}

export async function updateNotificationPreference(
  userId: string,
  key: NotificationPreferenceKey,
  enabled: boolean
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences(userId);
  const next = { ...current, [key]: enabled };

  const { data, error } = await getSupabase()
    .from("profiles")
    .update({ notification_preferences: next })
    .eq("id", userId)
    .select("notification_preferences")
    .single();

  if (error) throw formatSupabaseError(error, "Failed to update notification settings");
  const row = data as { notification_preferences?: Partial<NotificationPreferences> };
  return normalizeNotificationPreferences(row.notification_preferences);
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
  { key: "post_share", title: "Post shares", description: "When someone shares your post" },
];
