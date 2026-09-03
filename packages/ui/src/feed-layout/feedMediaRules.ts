import {
  FEED_MIN_MEDIA_HEIGHT,
  FEED_PHOTO_FALLBACK_RATIO,
  FEED_VIDEO_FIXED_ASPECT_RATIO,
  type MediaLayout,
} from "../mediaLayout";

/**
 * Canonical feed media sizing rules — referenced by FeedMedia, MediaAspectFrame, and docs.
 * Update here + FEED_DESIGN_SYSTEM.md to change feed media behavior globally.
 */
export const feedMediaRules = {
  /** Layout mode passed to PostMedia / MediaAspectFrame for all feed mounts. */
  layout: "feed" satisfies MediaLayout,

  /** Photos preserve intrinsic aspect ratio; feed videos use a fixed frame. */
  preserveAspectRatio: true,

  /** Feed videos fill a fixed 9:16 frame with cover fit (no letterboxing). */
  videoFixedAspectRatio: FEED_VIDEO_FIXED_ASPECT_RATIO,
  videoContentFit: "cover" as const,
  autoCrop: false,

  /** No portrait height cap — fitness progress/transformation media shows in full. */
  maxPortraitRatio: null as number | null,

  /** Image fit inside exact-aspect photo frame. */
  contentFit: "contain" as const,

  /** Edge-to-edge within the unified post content column (same width as metadata). */
  edgeToEdge: true,

  /** Skeleton placeholder height while dimensions load (not applied after probe). */
  loadingMinHeight: FEED_MIN_MEDIA_HEIGHT,

  /** Fallback height/width ratio before photo dimensions resolve. */
  photoFallbackRatio: FEED_PHOTO_FALLBACK_RATIO,

  /** Fallback ratio for video before poster dimensions resolve. */
  videoFallbackRatio: FEED_VIDEO_FIXED_ASPECT_RATIO,

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
