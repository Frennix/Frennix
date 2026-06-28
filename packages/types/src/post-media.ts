import type { PostType } from "./index";

/** Discriminated media kind for future mixed photo/video posts. */
export type PostMediaKind = "image" | "video";

/** Normalized media item — safe placeholder for future per-item video metadata. */
export interface PostMediaItem {
  url: string;
  kind: PostMediaKind;
  /** Poster or low-res preview (video poster or first-slide thumbnail). */
  thumbnailUrl?: string | null;
}

const VIDEO_URI_PATTERN = /\.(mp4|mov|webm|m4v)(\?|$)/i;

export function isVideoMediaUri(uri?: string | null): boolean {
  if (!uri) return false;
  return VIDEO_URI_PATTERN.test(uri);
}

export function isImageMediaUri(uri?: string | null): boolean {
  if (!uri?.trim()) return false;
  return !isVideoMediaUri(uri);
}

/** Infer image vs video for a slide — post_type applies to index 0 only today. */
export function inferPostMediaKind(
  url: string,
  options?: { postType?: PostType; index?: number }
): PostMediaKind {
  const index = options?.index ?? 0;
  if (options?.postType === "video" && index === 0) return "video";
  if (isVideoMediaUri(url)) return "video";
  return "image";
}

/** Map legacy post media_urls into typed items without breaking existing posts. */
export function normalizePostMediaItems(
  mediaUrls: string[],
  options?: { postType?: PostType; thumbnailUrl?: string | null }
): PostMediaItem[] {
  return mediaUrls
    .filter(Boolean)
    .map((url, index) => ({
      url,
      kind: inferPostMediaKind(url, { postType: options?.postType, index }),
      thumbnailUrl: index === 0 ? options?.thumbnailUrl ?? null : null,
    }));
}

/** Unified gallery state for mixed photo/video posts. */
export interface MediaGalleryState {
  items: PostMediaItem[];
  index: number;
}

/** Build gallery state from legacy post fields. */
export function buildMediaGalleryState(
  mediaUrls: string[],
  options?: { postType?: PostType; thumbnailUrl?: string | null; index?: number }
): MediaGalleryState {
  const items = normalizePostMediaItems(mediaUrls, options);
  const clampedIndex = Math.min(
    Math.max(options?.index ?? 0, 0),
    Math.max(items.length - 1, 0)
  );
  return { items, index: clampedIndex };
}

/** Per-item placeholder URIs for gallery cache reuse. */
export function galleryPlaceholderUris(
  items: PostMediaItem[]
): Array<string | null> {
  return items.map((item) => item.thumbnailUrl ?? null);
}

/** Image URLs safe for expo-image prefetch/cache. Skips video files. */
export function filterImagePrefetchUris(uris: Array<string | null | undefined>): string[] {
  return uris.filter((uri): uri is string => isImageMediaUri(uri));
}

/** Prefetch URIs for adjacent gallery slides (images only). */
export function galleryNeighborImageUris(items: PostMediaItem[], index: number): string[] {
  return filterImagePrefetchUris([
    items[index + 1]?.kind === "image" ? items[index + 1]?.url : null,
    items[index - 1]?.kind === "image" ? items[index - 1]?.url : null,
  ]);
}
