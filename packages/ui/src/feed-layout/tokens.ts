import { Platform, StyleSheet } from "react-native";
import { colors, spacing, touchTarget, typography } from "../theme";

/** Matches ACTION_SHEET_FONT_SCALE_MAX — caps Dynamic Type growth to preserve layout. */
export const FEED_FONT_SCALE_MAX = 1.35;

/**
 * Accessibility defaults for feed components.
 * Safe areas: feed list uses tab shell insets; post cards apply contentPaddingX once on Root
 * so media and metadata share one column width.
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

  /** Single horizontal inset for the entire post column — media and metadata share this width. */
  contentPaddingX: 0,

  /** @deprecated Use contentPaddingX on Root — media shares the same column as metadata. */
  mediaMarginX: 0,
  /** Tight gap between compact post header and media — media leads immediately. */
  mediaMarginTop: 0,

  /** Vertical rhythm between major sections inside a post. */
  sectionGap: spacing.xxs,

  postPaddingBottom: spacing.sm,

  header: {
    avatarSize: 32,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxs,
    gap: spacing.xs,
    nameGap: 0,
    usernameMarginTop: 0,
    metaMarginTop: 0,
    workoutTagGap: spacing.xxs,
  },

  media: {
    marginTop: 0,
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

  /** Feed list chrome above first post (stories row, suggestions). */
  feedChrome: {
    paddingTop: spacing.xxs,
    paddingBottom: spacing.xs,
    sectionGap: spacing.xs,
    storiesPaddingBottom: spacing.xxs,
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
    paddingHorizontal: feedLayout.contentPaddingX,
  },
  rootActive: {
    backgroundColor: colors.surfaceElevated,
    borderBottomColor: colors.accent,
  },
  /** Shared content column — every section is full width of the padded post root. */
  contentColumn: {
    width: "100%",
    alignSelf: "stretch" as const,
  },
  contentInset: {
    width: "100%",
    alignSelf: "stretch" as const,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
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
  },
  embeddedMedia: {
    width: "100%",
    alignSelf: "stretch" as const,
    marginTop: feedLayout.media.marginTop,
    borderRadius: 8,
    overflow: "hidden",
  },
  actions: {
    width: "100%",
    paddingTop: feedLayout.actions.paddingTop,
    paddingBottom: feedLayout.actions.paddingBottom,
  },
  caption: {
    width: "100%",
    paddingTop: feedLayout.caption.paddingTop,
  },
  engagement: {
    width: "100%",
    paddingTop: feedLayout.engagement.paddingTop,
    gap: feedLayout.engagement.gap,
  },
  comments: {
    width: "100%",
    paddingTop: feedLayout.comments.paddingTop,
    gap: feedLayout.comments.rowGap,
  },
  label: {
    width: "100%",
    paddingTop: feedLayout.extensions.labelPaddingTop,
    paddingBottom: feedLayout.extensions.labelPaddingBottom,
  },
  headerTrailing: {
    alignSelf: "flex-start" as const,
    marginTop: 2,
  },
  belowMedia: {
    width: "100%",
    paddingTop: feedLayout.extensions.belowMediaPaddingTop,
  },
  commerce: {
    width: "100%",
    paddingTop: feedLayout.extensions.commercePaddingTop,
  },
  footer: {
    width: "100%",
    paddingTop: feedLayout.extensions.footerPaddingTop,
  },
  mediaOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: feedLayout.extensions.mediaOverlayInset,
  },
});
