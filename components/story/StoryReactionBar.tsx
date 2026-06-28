import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STORY_REACTIONS, type StoryReactionEmoji } from "@frennix/types";
import { colors, overlays, spacing, typography } from "@frennix/ui";

interface StoryReactionBarProps {
  disabled?: boolean;
  onReact: (emoji: StoryReactionEmoji) => void | Promise<void>;
}

export function StoryReactionBar({ disabled, onReact }: StoryReactionBarProps) {
  const [sentEmoji, setSentEmoji] = useState<string | null>(null);

  return (
    <View style={styles.wrap}>
      {STORY_REACTIONS.map((reaction) => (
        <Pressable
          key={reaction.emoji}
          style={[styles.button, sentEmoji === reaction.emoji && styles.buttonActive]}
          disabled={disabled}
          onPress={async () => {
            setSentEmoji(reaction.emoji);
            await onReact(reaction.emoji);
          }}
          accessibilityRole="button"
          accessibilityLabel={`React ${reaction.label}`}
        >
          <Text style={styles.emoji}>{reaction.emoji}</Text>
          <Text style={styles.label}>{reaction.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
    gap: 2,
  },
  buttonActive: {
    borderColor: colors.accent,
    backgroundColor: overlays.accentTint,
  },
  emoji: {
    fontSize: 20,
    lineHeight: 22,
  },
  label: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.text,
    fontWeight: "600",
  },
});
