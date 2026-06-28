import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import type { WorkoutStoryMilestone } from "@frennix/types";
import { colors, overlays, spacing, typography } from "@frennix/ui";

interface StoryAchievementMomentProps {
  milestone: WorkoutStoryMilestone;
  resetKey: string;
}

/** Spotlight milestone achievements when a story opens. */
export function StoryAchievementMoment({ milestone, resetKey }: StoryAchievementMomentProps) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scale.setValue(0.85);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 110,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();
  }, [resetKey, scale, opacity]);

  return (
    <Animated.View style={[styles.badge, { transform: [{ scale }], opacity }]}>
      <Text style={styles.text}>
        {milestone.emoji} {milestone.label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: overlays.warningTint,
    borderWidth: 1,
    borderColor: overlays.warningBorder,
  },
  text: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "800",
  },
});
