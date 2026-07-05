import { Platform, StyleSheet } from "react-native";
import { colors, spacing, touchTarget, typography } from "../theme";

/** Matches ACTION_SHEET_FONT_SCALE_MAX — caps Dynamic Type growth to preserve layout. */
export const FEED_FONT_SCALE_MAX = 1.35;

/**
 * Accessibility defaults for feed components.
 * Safe areas: feed list uses tab shell insets; post cards do not add extra horizontal safe padding
 * (media is edge-to-edge; text uses contentPaddingX from layout tokens).
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

  /** Horizontal padding for text sections (header, caption, actions, comments). */
  contentPaddingX: spacing.sm,

  /** Media is edge-to-edge within the post card. */
  mediaMarginX: 0,
  mediaMarginTop: spacing.xs,

  /** Vertical rhythm between major sections inside a post. */
  sectionGap: spacing.xxs,

  postPaddingBottom: spacing.sm,

  header: {
    avatarSize: 36,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
    nameGap: 1,
    usernameMarginTop: 0,
    metaMarginTop: 2,
    workoutTagGap: spacing.xxs,
  },

  media: {
    marginTop: spacing.xs,
    marginBottom: 0,
  },

  actions: {
    rowHeight: 44,
    iconSize: 22,
    gap: spacing.lg,
    paddingTop: spacing.xxs,
    paddingBottom: spacing.xxs,
  },

  caption: {
    paddingTop: spacing.xs,
    lineHeight: 22,
  },

  engagement: {
    paddingTop: spacing.xs,
    gap: spacing.xxs,
  },

  comments: {
    paddingTop: spacing.xs,
    rowGap: spacing.xxs,
    commentInputMarginTop: spacing.xs,
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
    ...typography.bodySmall,
    fontWeight: "700" as const,
    color: colors.text,
    lineHeight: 18,
  },
  username: {
    ...typography.caption,
    color: colors.accent,
    lineHeight: 16,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 16,
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
    maxWidth: Platform.OS === "web" ? feedLayout.maxContentWidth : undefined,
    alignSelf: Platform.OS === "web" ? "center" : undefined,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: feedLayout.postPaddingBottom,
  },
  rootActive: {
    backgroundColor: colors.surfaceElevated,
    borderBottomColor: colors.accent,
  },
  contentInset: {
    paddingHorizontal: feedLayout.contentPaddingX,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.header.paddingTop,
    paddingBottom: feedLayout.header.paddingBottom,
    gap: feedLayout.header.gap,
  },
  headerText: {
    flex: 1,
    gap: feedLayout.header.nameGap,
  },
  media: {
    width: "100%",
    marginHorizontal: feedLayout.mediaMarginX,
    marginTop: feedLayout.media.marginTop,
  },
  embeddedMedia: {
    marginHorizontal: feedLayout.contentPaddingX,
    marginTop: feedLayout.media.marginTop,
    borderRadius: 8,
    overflow: "hidden",
  },
  actions: {
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.actions.paddingTop,
    paddingBottom: feedLayout.actions.paddingBottom,
  },
  caption: {
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.caption.paddingTop,
  },
  engagement: {
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.engagement.paddingTop,
    gap: feedLayout.engagement.gap,
  },
  comments: {
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.comments.paddingTop,
    gap: feedLayout.comments.rowGap,
  },
  label: {
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.extensions.labelPaddingTop,
    paddingBottom: feedLayout.extensions.labelPaddingBottom,
  },
  headerTrailing: {
    alignSelf: "flex-start" as const,
    marginTop: 2,
  },
  belowMedia: {
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.extensions.belowMediaPaddingTop,
  },
  commerce: {
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.extensions.commercePaddingTop,
  },
  footer: {
    paddingHorizontal: feedLayout.contentPaddingX,
    paddingTop: feedLayout.extensions.footerPaddingTop,
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: feedLayout.extensions.mediaOverlayInset,
  },
});
