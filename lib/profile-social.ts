import type { ProfileSocialContext } from "@frennix/types";

export function friendActionLabel(social: ProfileSocialContext | null | undefined): string {
  if (!social) return "Add Friend";
  switch (social.friendStatus) {
    case "friends":
      return "Friends";
    case "pending_outgoing":
      return "Requested";
    case "pending_incoming":
      return "Accept";
    default:
      return social.friendMode === "request_required" ? "Add Friend" : "Add Friend";
  }
}

export function formatJoinedDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function formatLastActive(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Active recently";
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Active yesterday";
  if (diffDays < 7) return `Active ${diffDays}d ago`;
  return `Active ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
