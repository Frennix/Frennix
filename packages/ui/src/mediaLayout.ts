/** Feed = edge-to-edge, large, aspect-preserving. Inline = card/detail with rounded corners. */
export type MediaLayout = "feed" | "inline";

/** Placeholder while dimensions load — portrait 4:5 (height/width). */
export const FEED_PHOTO_FALLBACK_RATIO = 5 / 4;

/** Max portrait frame height/width ratio — caps taller media at 4:5. */
export const FEED_MAX_PORTRAIT_RATIO = 5 / 4;

/** Video placeholder before poster dimensions resolve. */
export const FEED_VIDEO_FALLBACK_RATIO = FEED_PHOTO_FALLBACK_RATIO;

export const INLINE_DEFAULT_HEIGHT = 220;
export const FEED_MIN_MEDIA_HEIGHT = 280;

/** True when media exceeds the feed portrait cap and needs cover-crop inside the frame. */
export function isFeedPortraitCapped(
  mediaWidth: number,
  mediaHeight: number,
  maxPortraitRatio: number = FEED_MAX_PORTRAIT_RATIO
): boolean {
  if (!mediaWidth || !mediaHeight) return false;
  return mediaHeight / mediaWidth > maxPortraitRatio;
}

export function feedMediaContentFit(
  mediaWidth: number,
  mediaHeight: number,
  maxPortraitRatio: number = FEED_MAX_PORTRAIT_RATIO
): "cover" | "contain" {
  return isFeedPortraitCapped(mediaWidth, mediaHeight, maxPortraitRatio) ? "cover" : "contain";
}
