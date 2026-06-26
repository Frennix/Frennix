import type { Profile } from "@frennix/types";

export type PresenceProfile = Pick<Profile, "is_online" | "last_seen_at" | "show_online_status">;

/** Whether presence indicators should render for this profile row. */
export function isPresenceVisible(profile: PresenceProfile | null | undefined): boolean {
  return profile?.show_online_status !== false;
}

/** Must match packages/api/src/presence.ts */
export const PRESENCE_ONLINE_THRESHOLD_MS = 3 * 60 * 1000;

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

export function isProfileOnline(
  profile: PresenceProfile | null | undefined,
  now = new Date()
): boolean {
  if (!isPresenceVisible(profile)) return false;
  if (!profile?.last_seen_at || !profile.is_online) return false;
  const seenMs = new Date(profile.last_seen_at).getTime();
  if (Number.isNaN(seenMs)) return false;
  return now.getTime() - seenMs <= PRESENCE_ONLINE_THRESHOLD_MS;
}

/**
 * Human-readable presence for profile cards, chat headers, etc.
 * Returns null when no last_seen_at is recorded or presence is hidden.
 */
export function formatPresenceStatus(
  profile: PresenceProfile | null | undefined,
  now = new Date()
): string | null {
  if (!isPresenceVisible(profile)) return null;
  if (!profile?.last_seen_at) return null;
  if (isProfileOnline(profile, now)) return "Online now";

  const seen = new Date(profile.last_seen_at);
  if (Number.isNaN(seen.getTime())) return null;

  const diffMs = Math.max(0, now.getTime() - seen.getTime());
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Last seen just now";
  if (diffMin < 60) {
    return diffMin === 1 ? "Last seen 1 minute ago" : `Last seen ${diffMin} minutes ago`;
  }

  if (isYesterday(seen, now)) return "Last seen yesterday";

  const diffHour = Math.floor(diffMs / 3_600_000);
  if (isSameCalendarDay(seen, now)) {
    return diffHour === 1 ? "Last seen 1 hour ago" : `Last seen ${diffHour} hours ago`;
  }

  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffDay < 7) {
    return diffDay === 1 ? "Last seen 1 day ago" : `Last seen ${diffDay} days ago`;
  }

  const formatted = seen.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: seen.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
  return `Last seen ${formatted}`;
}
