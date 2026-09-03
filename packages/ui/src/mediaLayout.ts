/** Feed = edge-to-edge, large, aspect-preserving. Inline = card/detail with rounded corners. */
export type MediaLayout = "feed" | "inline";

/** Placeholder while dimensions load — roughly 4:5 portrait (Instagram-friendly). */
export const FEED_PHOTO_FALLBACK_RATIO = 5 / 4;

/** Fixed portrait frame for all home-feed inline videos (9:16). */
export const FEED_VIDEO_FIXED_ASPECT_RATIO = 9 / 16;

/** @deprecated Use FEED_VIDEO_FIXED_ASPECT_RATIO — kept for existing imports. */
export const FEED_VIDEO_FALLBACK_RATIO = FEED_VIDEO_FIXED_ASPECT_RATIO;

export const INLINE_DEFAULT_HEIGHT = 220;
export const FEED_MIN_MEDIA_HEIGHT = 280;
