import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ReactionSummary } from "@frennix/types";
import { colors, radius, spacing, typography } from "./theme";

interface ReactionBarProps {
  reactions?: ReactionSummary[];
  onReactionPress?: (emoji: string) => void;
  onAddReaction?: () => void;
  compact?: boolean;
}

export function ReactionBar({
  reactions = [],
  onReactionPress,
  onAddReaction,
  compact = false,
}: ReactionBarProps) {
  if (!reactions.length && !onAddReaction) return null;

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {reactions.map((reaction) => (
        <Pressable
          key={reaction.emoji}
          style={[styles.chip, reaction.reacted_by_me && styles.chipMine]}
          onPress={() => onReactionPress?.(reaction.emoji)}
          disabled={!onReactionPress}
          accessibilityRole="button"
          accessibilityLabel={`${reaction.emoji} ${reaction.count}`}
        >
          <Text style={styles.chipEmoji}>{reaction.emoji}</Text>
          <Text style={[styles.chipCount, reaction.reacted_by_me && styles.chipCountMine]}>
            {reaction.count}
          </Text>
        </Pressable>
      ))}
      {onAddReaction ? (
        <Pressable
          style={[styles.chip, styles.addChip]}
          onPress={onAddReaction}
          accessibilityRole="button"
          accessibilityLabel="Add reaction"
        >
          <Text style={styles.addIcon}>＋</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  rowCompact: { marginTop: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipMine: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipEmoji: { fontSize: 14, lineHeight: 18 },
  chipCount: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  chipCountMine: { color: colors.accent },
  addChip: {
    minWidth: 32,
    justifyContent: "center",
  },
  addIcon: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: "700",
  },
});
