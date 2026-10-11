/**
 * Phone feed display size. A 1440px PNG of ~2.7MB becomes ~50KB WebP at this size
 * on the Supabase image renderer (measured against a live post image).
 */
export const FEED_DISPLAY_IMAGE_WIDTH = 1080;
export const FEED_DISPLAY_IMAGE_QUALITY = 60;

const OBJECT_PUBLIC = "/storage/v1/object/public/";
const VIDEO_URI_PATTERN = /\.(mp4|mov|webm|m4v)(\?|#|$)/i;

function isFeedImageUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!trimmed) return false;
  return !VIDEO_URI_PATTERN.test(trimmed);
}

export type FeedMediaLoadPriority = "high" | "low";

export function feedDisplayImageUri(uri: string | null | undefined): string {
  if (!uri) return "";
  if (!isFeedImageUri(uri)) return uri;
  if (uri.startsWith("data:") || uri.startsWith("blob:")) return uri;
  if (uri.includes("/storage/v1/render/image/")) return uri;

  const index = uri.indexOf(OBJECT_PUBLIC);
  if (index === -1) return uri;

  const base = `${uri.slice(0, index)}/storage/v1/render/image/public/${uri.slice(index + OBJECT_PUBLIC.length)}`;
  const hashIndex = base.indexOf("#");
  const withoutHash = hashIndex === -1 ? base : base.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : base.slice(hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const params = new URLSearchParams(queryIndex === -1 ? "" : withoutHash.slice(queryIndex + 1));
  params.set("width", String(FEED_DISPLAY_IMAGE_WIDTH));
  params.set("quality", String(FEED_DISPLAY_IMAGE_QUALITY));
  params.set("resize", "contain");
  params.set("format", "webp");
  return `${path}?${params.toString()}${hash}`;
}

/** Visible feed media should start before offscreen rows on a phone connection. */
export function shouldAttachFeedVideoSource(input: {
  loadPriority?: FeedMediaLoadPriority;
  inView: boolean;
  preloadGranted: boolean;
  shouldPlay: boolean;
}): boolean {
  return input.loadPriority !== "low" || input.inView || input.preloadGranted || input.shouldPlay;
}

export function feedImageRequestAttrs(priority?: FeedMediaLoadPriority): {
  fetchPriority: "high" | "low" | "auto";
  loading: "eager" | "lazy";
} {
  if (priority === "low") return { fetchPriority: "low", loading: "lazy" };
  if (priority === "high") return { fetchPriority: "high", loading: "eager" };
  return { fetchPriority: "auto", loading: "eager" };
}
