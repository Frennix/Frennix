import { memo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, touchTarget } from "../theme";
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
            style={[styles.icon, liked && styles.iconActive]}
            allowFontScaling
            maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
            importantForAccessibility="no"
          >
            {liked ? "♥" : "♡"}
          </Text>
        </ActionButton>
      ) : null}

      {onStrongWork ? (
        <ActionButton
          label={strongWorkActive ? "Strong Work, selected" : "Strong Work"}
          hint={
            strongWorkActive
              ? "Removes your Strong Work reaction"
              : "Reacts with Strong Work"
          }
          selected={strongWorkActive}
          onPress={onStrongWork}
        >
          <Text
            style={[styles.emoji, strongWorkActive && styles.emojiActive]}
            allowFontScaling
            maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
            importantForAccessibility="no"
          >
            {STRONG_WORK_EMOJI}
          </Text>
        </ActionButton>
      ) : null}

      {onComment ? (
        <ActionButton label="Comment on post" hint="Opens comments" onPress={onComment}>
          <Text
            style={styles.icon}
            allowFontScaling
            maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
            importantForAccessibility="no"
          >
            💬
          </Text>
        </ActionButton>
      ) : null}

      {onShare ? (
        <ActionButton label="Share post" hint="Opens share options" onPress={onShare}>
          <Text
            style={styles.icon}
            allowFontScaling
            maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
            importantForAccessibility="no"
          >
            ↗
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
            style={styles.moreIcon}
            allowFontScaling
            maxFontSizeMultiplier={feedAccessibility.maxFontSizeMultiplier}
            importantForAccessibility="no"
          >
            ⋯
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
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected }}
      hitSlop={8}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: feedLayout.actions.gap,
    minHeight: feedLayout.actions.rowHeight,
  },
  button: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  icon: {
    fontSize: feedLayout.actions.iconSize,
    lineHeight: feedLayout.actions.iconSize + 4,
    color: colors.text,
    fontWeight: "400",
  },
  iconActive: {
    color: colors.accent,
  },
  emoji: {
    fontSize: feedLayout.actions.iconSize,
    lineHeight: feedLayout.actions.iconSize + 4,
  },
  emojiActive: {
    opacity: 1,
  },
  moreIcon: {
    fontSize: feedLayout.actions.iconSize + 2,
    lineHeight: feedLayout.actions.iconSize + 6,
    color: colors.textSecondary,
    fontWeight: "700",
  },
});
