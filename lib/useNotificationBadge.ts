import { useTabBadges } from "@/providers/TabBadgeProvider";

/** @deprecated Use useTabBadges() — kept for legacy call sites. */
export function useNotificationBadge(_userId: string) {
  return useTabBadges().unreadNotifications;
}
