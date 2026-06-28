/** Hotfix diagnostic — always on web until login/feed is stable. */
export const EMERGENCY_DEBUG_BUILD = "2025-06-25-safari-feed-overlay-fix";

/** Fixed emergency banner height — scroll content clearance on web (not flex scene padding). */
export const EMERGENCY_BANNER_CLEARANCE = 168;

export function getEmergencyDebugLines(): string[] {
  if (typeof window === "undefined") return [EMERGENCY_DEBUG_BUILD];
  return [
    EMERGENCY_DEBUG_BUILD,
    window.location.href,
    `readyState=${document.readyState}`,
  ];
}
