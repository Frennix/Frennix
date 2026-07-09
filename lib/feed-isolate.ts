/**
 * Feed/tabs bisection kill-switches for Safari black-screen isolation.
 *
 * Activate via URL `?feedIsolate=stories` (comma-separated) or
 * `sessionStorage.setItem("frennix:feed-isolate", "stories")`.
 */
export const FEED_ISOLATE_FLAGS = [
  "stories",
  "feed-list",
  "post-cards",
  "fab",
  "bottom-tabs",
  "notification-badge",
  "online-status",
  "image-preload",
  "video",
  "pull-to-refresh",
] as const;

export type FeedIsolateFlag = (typeof FEED_ISOLATE_FLAGS)[number];

function readIsolateRaw(): string {
  if (typeof window === "undefined") return "";
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("feedIsolate");
    if (fromUrl) return fromUrl;
    return sessionStorage.getItem("frennix:feed-isolate") ?? "";
  } catch {
    return "";
  }
}

function readIsolateSet(): Set<string> {
  const raw = readIsolateRaw().trim();
  if (!raw || raw === "none") return new Set();
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

/** True when this feed subsystem should be skipped (bisection mode). */
export function isFeedIsolateDisabled(flag: FeedIsolateFlag): boolean {
  return readIsolateSet().has(flag);
}

export function isFeedIsolateActive(): boolean {
  return readIsolateSet().size > 0;
}

export function getFeedIsolateFlags(): FeedIsolateFlag[] {
  return FEED_ISOLATE_FLAGS.filter((flag) => readIsolateSet().has(flag));
}
