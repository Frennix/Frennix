import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScalePressable } from "../ScalePressable";
import { colors, spacing, touchTarget } from "../theme";
import { feedAccessibility, feedLayout, feedLayoutStyles } from "./tokens";

const STRONG_WORK_EMOJI = "💪";

export interface FeedPostActionBarProps {
  liked?: boolean;
  strongWorkActive?: boolean;
  onLike?: () => void;
  onStrongWork?: () => void;
  onComment?: () => void;
  onShare?: () => void;
  onMore?: () => void;
}

export const FeedPostActionBar = memo(function FeedPostActionBar({
  liked = false,
  strongWorkActive = false,
  onLike,
  onStrongWork,
  onComment,
  onShare,
  onMore,
}: FeedPostActionBarProps) {
  const hasActions = onLike || onStrongWork || onComment || onShare || onMore;
  if (!hasActions) return null;

  return (
    <View
      style={[feedLayoutStyles.actions, styles.row]}
      accessibilityRole="toolbar"
      accessibilityLabel="Post actions"
    >
      {onLike ? (
        <ActionButton
          label={liked ? "Unlike post" : "Like post"}
          hint={liked ? "Removes your like" : "Likes this post"}
          selected={liked}
          onPress={onLike}
        >
          <Text
            style={[styles.label, liked && styles.labelActive]}
            allowFontScaling
            maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
          >
            {liked ? "❤️" : "🤍"} Like
          </Text>
        </ActionButton>
      ) : null}

      {onStrongWork ? (
        <ActionButton
          label={strongWorkActive ? "Respect, selected" : "Respect"}
          hint={
            strongWorkActive
              ? "Removes your Respect reaction"
              : "Reacts with Respect"
          }
          selected={strongWorkActive}
          onPress={onStrongWork}
        >
          <Text
            style={[styles.label, strongWorkActive && styles.labelActive]}
            allowFontScaling
            maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
          >
            {STRONG_WORK_EMOJI} Respect
          </Text>
        </ActionButton>
      ) : null}

      {onComment ? (
        <ActionButton label="Comment on post" hint="Opens comments" onPress={onComment}>
          <Text
            style={styles.label}
            allowFontScaling
            maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
          >
            💬 Comment
          </Text>
        </ActionButton>
      ) : null}

      {onShare ? (
        <ActionButton label="Share post" hint="Opens share options" onPress={onShare}>
          <Text
            style={styles.label}
            allowFontScaling
            maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
          >
            📤 Share
          </Text>
        </ActionButton>
      ) : null}

      {onMore ? (
        <ActionButton
          label="More post actions"
          hint="Opens menu with save, reply, and more"
          onPress={onMore}
        >
          <Text
            style={styles.moreLabel}
            allowFontScaling
            maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
          >
            ⋯ More
          </Text>
        </ActionButton>
      ) : null}
    </View>
  );
});

function ActionButton({
  label,
  hint,
  selected = false,
  onPress,
  children,
}: {
  label: string;
  hint?: string;
  selected?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <ScalePressable
      pressedScale={0.96}
      onPress={onPress}
      containerStyle={styles.button}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected }}
    >
      {children}
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: feedLayout.actions.gap,
    minHeight: feedLayout.actions.rowHeight,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginTop: spacing.sm,
    paddingTop: feedLayout.actions.paddingTop,
  },
  button: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  labelActive: {
    color: colors.accent,
  },
  moreLabel: {
    fontSize: 14,
    lineHeight: 18,
    color: colors.textMuted,
    fontWeight: "700",
  },
});
