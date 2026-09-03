import {
  FEED_MIN_MEDIA_HEIGHT,
  FEED_PHOTO_FALLBACK_RATIO,
  FEED_PORTRAIT_FRAME_RATIO,
  FEED_VIDEO_FALLBACK_RATIO,
  type MediaLayout,
} from "../mediaLayout";

/**
 * Canonical feed media sizing rules — referenced by FeedMedia, MediaAspectFrame, and docs.
 */
export const feedMediaRules = {
  layout: "feed" satisfies MediaLayout,

  /** Portrait 4:5, square 1:1, landscape natural — all full width. */
  preserveAspectRatio: true,
  maxPortraitRatio: FEED_PORTRAIT_FRAME_RATIO,
  autoCrop: true,

  /** Always cover inside the computed feed frame (no pillarboxing). */
  contentFit: "cover" as const,
  videoContentFit: "cover" as const,

  edgeToEdge: true,
  loadingMinHeight: FEED_MIN_MEDIA_HEIGHT,
  photoFallbackRatio: FEED_PHOTO_FALLBACK_RATIO,
  videoFallbackRatio: FEED_VIDEO_FALLBACK_RATIO,
  deferUntilNearViewport: true,
  viewportRootMargin: "320px 0px",
} as const;

export const feedResponsiveRules = {
  phone: {
    maxContentWidth: "100%" as const,
    contentPaddingX: 0,
  },
  tabletWeb: {
    maxContentWidth: 640,
    contentPaddingX: 0,
  },
  desktopWeb: {
    maxContentWidth: 640,
    contentPaddingX: 0,
  },
} as const;
