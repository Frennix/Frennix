import { StyleSheet } from "react-native";
import { colors, spacing, touchTarget, typography } from "../theme";

/** Matches ACTION_SHEET_FONT_SCALE_MAX — caps Dynamic Type growth to preserve layout. */
export const FEED_FONT_SCALE_MAX = 1.35;

/**
 * Accessibility defaults for feed components.
 * Safe areas: feed list uses tab shell insets; text sections apply contentPaddingX;
 * media spans the full feed width edge-to-edge (no card shell).
 */
export const feedAccessibility = {
  maxFontSizeMultiplier: FEED_FONT_SCALE_MAX,
  minTouchTarget: touchTarget,
} as const;

/**
 * Single source of truth for feed post layout.
 * Update these tokens to redesign every feed post at once.
 */
export const feedLayout = {
  /** Max post width on large web viewports; phones use full width. */
  maxContentWidth: 640,

  /** Horizontal inset for text/metadata sections — media is full-bleed. */
  contentPaddingX: spacing.md,

  /** @deprecated Media is full-bleed — use contentPaddingX on text sections only. */
  mediaMarginX: 0,
  /** Tight gap between compact post header and media. */
  mediaMarginTop: 0,

  /** Vertical rhythm between major sections inside a post. */
  sectionGap: spacing.sm,

  postPaddingBottom: spacing.sm,
  postMarginX: 0,
  postMarginBottom: spacing.sm,
  postRadius: 0,

  header: {
    avatarSize: 36,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxs,
    gap: spacing.xs,
    nameGap: 1,
    usernameMarginTop: 0,
    metaMarginTop: 0,
    workoutTagGap: spacing.xs,
  },

  media: {
    marginTop: 0,
    marginBottom: 0,
  },

  actions: {
    rowHeight: 44,
    iconSize: 24,
    gap: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },

  caption: {
    paddingTop: spacing.xs,
    lineHeight: 24,
  },

  engagement: {
    paddingTop: spacing.xxs,
    gap: spacing.xxs,
  },

  comments: {
    paddingTop: spacing.xxs,
    rowGap: spacing.xxs,
    commentInputMarginTop: spacing.xs,
  },

  /** Feed list chrome above first post (stories row, suggestions). */
  feedChrome: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxs,
    sectionGap: spacing.sm,
    storiesPaddingBottom: 0,
  },

  /** Extension slots — spacing for future monetization / content overlays. */
  extensions: {
    labelPaddingTop: spacing.xs,
    labelPaddingBottom: spacing.xxs,
    belowMediaPaddingTop: spacing.xxs,
    commercePaddingTop: spacing.sm,
    footerPaddingTop: spacing.sm,
    mediaOverlayInset: spacing.sm,
  },
} as const;

export const feedLayoutTypography = {
  displayName: {
    fontSize: 15,
    fontWeight: "800" as const,
    color: colors.text,
    lineHeight: 18,
  },
  username: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: "600" as const,
    lineHeight: 16,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 15,
  },
  workoutTitle: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: colors.text,
    lineHeight: 24,
  },
  workoutDescription: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  caption: {
    ...typography.body,
    color: colors.text,
    lineHeight: feedLayout.caption.lineHeight,
  },
  engagement: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: "600" as const,
  },
  reactionSummary: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "700" as const,
  },
  commentText: {
    ...typography.bodySmall,
    lineHeight: 18,
  },
  commentAuthor: {
    fontWeight: "700" as const,
    color: colors.text,
  },
  commentBody: {
    color: colors.text,
    fontWeight: "400" as const,
  },
  commentMuted: {
    ...typography.bodySmall,
    color: colors.textMuted,
  },
} as const;

export const feedLayoutStyles = StyleSheet.create({
  root: {
    width: "100%",
    maxWidth: "100%",
    alignSelf: "stretch" as const,
    backgroundColor: "transparent",
    marginHorizontal: feedLayout.postMarginX,
    marginBottom: feedLayout.postMarginBottom,
    paddingBottom: feedLayout.postPaddingBottom,
    overflow: "visible",
  },
  rootActive: {
    backgroundColor: "transparent",
  },
  /** Shared content column — every section is full width of the post root. */
  contentColumn: {
    width: "100%",
    alignSelf: "stretch" as const,
  },
  contentInset: {
    width: "100%",
    alignSelf: "stretch" as const,
    paddingHorizontal: feedLayout.contentPaddingX,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.header.paddingTop,
    paddingBottom: feedLayout.header.paddingBottom,
    gap: feedLayout.header.gap,
    minHeight: feedAccessibility.minTouchTarget,
  },
  headerText: {
    flex: 1,
    gap: feedLayout.header.nameGap,
  },
  media: {
    width: "100%",
    alignSelf: "stretch" as const,
    marginTop: feedLayout.media.marginTop,
    marginBottom: feedLayout.media.marginBottom,
    marginHorizontal: 0,
    borderRadius: 0,
    overflow: "hidden",
  },
  embeddedMedia: {
    width: "100%",
    alignSelf: "stretch" as const,
    marginTop: feedLayout.media.marginTop,
    marginHorizontal: feedLayout.contentPaddingX,
    borderRadius: 0,
    overflow: "hidden",
  },
  actions: {
    width: "100%",
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.actions.paddingTop,
    paddingBottom: feedLayout.actions.paddingBottom,
  },
  caption: {
    width: "100%",
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.caption.paddingTop,
  },
  engagement: {
    width: "100%",
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.engagement.paddingTop,
    gap: feedLayout.engagement.gap,
  },
  comments: {
    width: "100%",
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.comments.paddingTop,
    gap: feedLayout.comments.rowGap,
  },
  label: {
    width: "100%",
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.extensions.labelPaddingTop,
    paddingBottom: feedLayout.extensions.labelPaddingBottom,
  },
  headerTrailing: {
    alignSelf: "flex-start" as const,
    marginTop: 2,
  },
  belowMedia: {
    width: "100%",
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.extensions.belowMediaPaddingTop,
  },
  commerce: {
    width: "100%",
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.extensions.commercePaddingTop,
  },
  footer: {
    width: "100%",
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.extensions.footerPaddingTop,
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: feedLayout.extensions.mediaOverlayInset,
  },
});
