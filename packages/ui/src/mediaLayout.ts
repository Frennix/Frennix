/** Feed = edge-to-edge, large, aspect-preserving. Inline = card/detail with rounded corners. */
export type MediaLayout = "feed" | "inline";

/** Instagram-style feed frame buckets. */
export type FeedMediaBucket = "portrait" | "square" | "landscape";

/** Portrait feed frame — 4:5 (height / width). */
export const FEED_PORTRAIT_FRAME_RATIO = 5 / 4;

/** Placeholder while dimensions load — portrait 4:5. */
export const FEED_PHOTO_FALLBACK_RATIO = FEED_PORTRAIT_FRAME_RATIO;

/** @deprecated Use FEED_PORTRAIT_FRAME_RATIO */
export const FEED_MAX_PORTRAIT_RATIO = FEED_PORTRAIT_FRAME_RATIO;

/** Video placeholder before poster dimensions resolve. */
export const FEED_VIDEO_FALLBACK_RATIO = FEED_PORTRAIT_FRAME_RATIO;

export const INLINE_DEFAULT_HEIGHT = 220;

/** @deprecated Feed frames derive height from width + bucket — no arbitrary min height. */
export const FEED_MIN_MEDIA_HEIGHT = 280;

const SQUARE_TOLERANCE = 0.05;

/** Stable fallback bucket when intrinsic dimensions are unavailable. */
export const FEED_FALLBACK_BUCKET: FeedMediaBucket = "portrait";

/** CSS aspect-ratio (width / height) for each feed bucket. */
export function feedBucketAspectRatio(bucket: FeedMediaBucket): number {
  switch (bucket) {
    case "portrait":
      return 4 / 5;
    case "square":
      return 1;
    case "landscape":
      return 16 / 9;
  }
}

/** Resolve the Instagram feed bucket from intrinsic dimensions or fallback. */
export function resolveFeedMediaBucket(
  mediaWidth: number,
  mediaHeight: number,
  fallbackBucket: FeedMediaBucket = FEED_FALLBACK_BUCKET
): FeedMediaBucket {
  if (!mediaWidth || !mediaHeight) return fallbackBucket;
  return classifyFeedMediaBucket(mediaWidth, mediaHeight);
}

/** Classify media into Instagram-style feed buckets from intrinsic dimensions. */
export function classifyFeedMediaBucket(
  mediaWidth: number,
  mediaHeight: number
): FeedMediaBucket {
  if (!mediaWidth || !mediaHeight) return "portrait";
  const widthOverHeight = mediaWidth / mediaHeight;
  if (widthOverHeight > 1 + SQUARE_TOLERANCE) return "landscape";
  if (widthOverHeight >= 1 - SQUARE_TOLERANCE) return "square";
  return "portrait";
}

/** Frame height for a full-width feed media container. */
export function computeFeedMediaFrameHeight(
  containerWidth: number,
  mediaWidth: number,
  mediaHeight: number,
  fallbackBucket: FeedMediaBucket = "portrait"
): number {
  if (!containerWidth) return 0;
  const bucket =
    mediaWidth > 0 && mediaHeight > 0
      ? classifyFeedMediaBucket(mediaWidth, mediaHeight)
      : fallbackBucket;

  switch (bucket) {
    case "portrait":
      return containerWidth * FEED_PORTRAIT_FRAME_RATIO;
    case "square":
      return containerWidth;
    case "landscape":
      return containerWidth * (mediaHeight / mediaWidth);
  }
}

/** Feed media always fills its frame — cover crops excess inside fixed buckets. */
export function feedMediaContentFit(): "cover" {
  return "cover";
}

/** Deterministic carousel frame size — avoids height:100% collapse through web FlatList. */
export function resolveFeedCarouselFrameSizing(
  containerWidth: number,
  bucket: FeedMediaBucket = FEED_FALLBACK_BUCKET
): { frameHeight: number; frameAspectRatio: number } {
  const frameAspectRatio = feedBucketAspectRatio(bucket);
  const frameHeight =
    containerWidth > 0 ? computeFeedMediaFrameHeight(containerWidth, 0, 0, bucket) : 0;
  return { frameHeight, frameAspectRatio };
}

/** @deprecated Use classifyFeedMediaBucket + feedMediaContentFit */
export function isFeedPortraitCapped(
  mediaWidth: number,
  mediaHeight: number,
  maxPortraitRatio: number = FEED_PORTRAIT_FRAME_RATIO
): boolean {
  if (!mediaWidth || !mediaHeight) return true;
  return mediaHeight / mediaWidth > maxPortraitRatio;
}
