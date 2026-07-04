import { Pressable, StyleSheet, Text, View } from "react-native";
import { STORY_QUICK_REACTIONS, type StoryQuickReactionEmoji } from "@frennix/types";
import { colors, overlays, radius, spacing, typography } from "@frennix/ui";

type StoryReactionRowProps = {
  disabled?: boolean;
  onReact: (emoji: StoryQuickReactionEmoji) => void | Promise<void>;
};

export function StoryReactionRow({ disabled, onReact }: StoryReactionRowProps) {
  return (
    <View style={styles.row}>
      {STORY_QUICK_REACTIONS.map((reaction) => (
        <Pressable
          key={reaction.emoji}
          style={[styles.chip, disabled && styles.chipDisabled]}
          onPress={() => onReact(reaction.emoji)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={reaction.label}
        >
          <Text style={styles.emoji}>{reaction.emoji}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    borderRadius: radius.md,
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
  },
  chipDisabled: {
    opacity: 0.55,
  },
  emoji: {
    fontSize: 20,
    lineHeight: 22,
  },
});
