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

/** Image URLs safe for expo-image prefetch/cache. Skips video files. */
export function filterImagePrefetchUris(uris: Array<string | null | undefined>): string[] {
  return uris.filter((uri): uri is string => isImageMediaUri(uri));
}

/** Placeholder URIs aligned to media_urls for lightbox cache reuse. */
export function galleryPlaceholderUris(
  mediaUrls: string[],
  thumbnailUrl?: string | null
): Array<string | null> {
  return mediaUrls.map((_, index) => (index === 0 ? thumbnailUrl ?? null : null));
}
