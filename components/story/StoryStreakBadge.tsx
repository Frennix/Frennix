import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";

interface StoryStreakBadgeProps {
  streak: number;
  resetKey: string;
}

/** Brief entrance animation when a story opens. */
export function StoryStreakBadge({ streak, resetKey }: StoryStreakBadgeProps) {
  const scale = useRef(new Animated.Value(0.72)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    scale.setValue(0.72);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [resetKey, scale, opacity]);

  if (streak <= 0) return null;

  return (
    <Animated.View style={[styles.badge, { transform: [{ scale }], opacity }]}>
      <Text style={styles.text}>
        🔥 {streak} day{streak === 1 ? "" : "s"} streak
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.55)",
  },
  text: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
  },
});
