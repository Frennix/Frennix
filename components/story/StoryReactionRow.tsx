import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { STORY_QUICK_REACTIONS, type StoryQuickReactionEmoji } from "@frennix/types";
import { colors, overlays, radius, spacing, typography } from "@frennix/ui";

const REACTION_TAP_LOCK_MS = 450;

type StoryReactionRowProps = {
  disabled?: boolean;
  onReact: (emoji: StoryQuickReactionEmoji) => void | Promise<void>;
};

export function StoryReactionRow({ disabled, onReact }: StoryReactionRowProps) {
  const [selectedEmoji, setSelectedEmoji] = useState<StoryQuickReactionEmoji | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const lastTapAtRef = useRef(0);
  const selectedBeforeTapRef = useRef<StoryQuickReactionEmoji | null>(null);

  async function handlePress(emoji: StoryQuickReactionEmoji) {
    if (disabled || inFlightRef.current) return;
    const now = Date.now();
    if (now - lastTapAtRef.current < REACTION_TAP_LOCK_MS) return;
    lastTapAtRef.current = now;

    selectedBeforeTapRef.current = selectedEmoji;
    inFlightRef.current = true;
    setSelectedEmoji(emoji);
    setError(null);

    try {
      await onReact(emoji);
    } catch {
      setSelectedEmoji(selectedBeforeTapRef.current);
      setError("Reaction couldn’t be sent. Try again.");
    } finally {
      inFlightRef.current = false;
    }
  }

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}
      >
        {STORY_QUICK_REACTIONS.map((reaction) => {
          const selected = selectedEmoji === reaction.emoji;
          return (
            <Pressable
              key={reaction.emoji}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && styles.chipPressed,
                disabled && styles.chipDisabled,
              ]}
              onPress={() => void handlePress(reaction.emoji)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={reaction.label}
              accessibilityState={{ selected, disabled: Boolean(disabled) }}
            >
              <Text style={styles.emoji}>{reaction.emoji}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
  scroll: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingRight: spacing.xs,
  },
  chip: {
    minWidth: 44,
    minHeight: 40,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
    flexGrow: 0,
    flexShrink: 0,
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  chipPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  chipDisabled: {
    opacity: 0.55,
  },
  emoji: {
    fontSize: 20,
    lineHeight: 22,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
});
