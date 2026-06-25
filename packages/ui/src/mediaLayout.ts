/** Feed = edge-to-edge, large, aspect-preserving. Inline = card/detail with rounded corners. */
export type MediaLayout = "feed" | "inline";

/** Placeholder while dimensions load — roughly 4:5 portrait (Instagram-friendly). */
export const FEED_PHOTO_FALLBACK_RATIO = 5 / 4;

/** Default video frame before poster dimensions load. */
export const FEED_VIDEO_FALLBACK_RATIO = 9 / 16;

export const INLINE_DEFAULT_HEIGHT = 220;
export const FEED_MIN_MEDIA_HEIGHT = 280;
