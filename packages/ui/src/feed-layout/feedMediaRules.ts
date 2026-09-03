import {
  FEED_MAX_PORTRAIT_RATIO,
  FEED_MIN_MEDIA_HEIGHT,
  FEED_PHOTO_FALLBACK_RATIO,
  FEED_VIDEO_FALLBACK_RATIO,
  type MediaLayout,
} from "../mediaLayout";

/**
 * Canonical feed media sizing rules — referenced by FeedMedia, MediaAspectFrame, and docs.
 * Update here + FEED_DESIGN_SYSTEM.md to change feed media behavior globally.
 */
export const feedMediaRules = {
  /** Layout mode passed to PostMedia / MediaAspectFrame for all feed mounts. */
  layout: "feed" satisfies MediaLayout,

  /** Photos and videos preserve intrinsic aspect up to the portrait cap. */
  preserveAspectRatio: true,

  /** Cap tall portrait media at 4:5; cover only when capped. */
  maxPortraitRatio: FEED_MAX_PORTRAIT_RATIO,
  autoCrop: true,

  /** Contain by default; cover only when portrait exceeds the 4:5 cap. */
  contentFit: "contain" as const,
  videoContentFit: "contain" as const,

  /** Edge-to-edge within the post card; text sections use contentPaddingX. */
  edgeToEdge: true,

  /** Skeleton placeholder height while dimensions load (not applied after probe). */
  loadingMinHeight: FEED_MIN_MEDIA_HEIGHT,

  /** Fallback height/width ratio before photo dimensions resolve. */
  photoFallbackRatio: FEED_PHOTO_FALLBACK_RATIO,

  /** Fallback ratio for video before poster dimensions resolve. */
  videoFallbackRatio: FEED_VIDEO_FALLBACK_RATIO,

  /** Web: defer carousel/video mount until near viewport (FeedMediaSlot). */
  deferUntilNearViewport: true,

  /** Web IntersectionObserver prefetch margin. */
  viewportRootMargin: "320px 0px",
} as const;

/** Responsive feed post width rules (see FEED_DESIGN_SYSTEM.md). */
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
