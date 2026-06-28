import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { STORY_DAILY_MOTIVATIONS } from "@frennix/types";
import { Button, colors, overlays, spacing, typography } from "@frennix/ui";

interface StoryDailyMotivationProps {
  onShareWorkout?: () => void;
  seed?: string;
}

/** Motivational prompts when the user has no active workout story. */
export function StoryDailyMotivation({ onShareWorkout, seed = "today" }: StoryDailyMotivationProps) {
  const message = useMemo(() => {
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
      hash = (hash + seed.charCodeAt(index) * (index + 1)) % STORY_DAILY_MOTIVATIONS.length;
    }
    return STORY_DAILY_MOTIVATIONS[hash] ?? STORY_DAILY_MOTIVATIONS[0];
  }, [seed]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>💪</Text>
      <Text style={styles.title}>Your story is waiting</Text>
      <Text style={styles.body}>{message}</Text>
      {onShareWorkout ? <Button title="Share today's workout" onPress={onShareWorkout} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  emoji: {
    fontSize: 48,
    lineHeight: 52,
  },
  title: {
    ...typography.body,
    color: colors.text,
    fontWeight: "800",
    textAlign: "center",
  },
  body: {
    ...typography.bodySmall,
    color: overlays.whiteSubtle,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
});
