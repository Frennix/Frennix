import { useCallback, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import type { Animated as AnimatedNamespace } from "react-native";
import { hapticMedium } from "@/lib/haptics";
import { colors, spacing, applyShadow } from "@frennix/ui";

type TrainingCalendarCreateFabProps = {
  scrollY: AnimatedNamespace.Value;
  onPress: () => void;
  bottom: number;
  interactive: boolean;
};

const SCROLL_SHOW_START = 36;
const SCROLL_SHOW_END = 96;

export function TrainingCalendarCreateFab({
  scrollY,
  onPress,
  bottom,
  interactive,
}: TrainingCalendarCreateFabProps) {
  const pressScale = useRef(new Animated.Value(1)).current;

  const opacity = scrollY.interpolate({
    inputRange: [SCROLL_SHOW_START, SCROLL_SHOW_END],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const scale = scrollY.interpolate({
    inputRange: [0, SCROLL_SHOW_END],
    outputRange: [0.55, 1],
    extrapolate: "clamp",
  });

  const translateY = scrollY.interpolate({
    inputRange: [SCROLL_SHOW_START, SCROLL_SHOW_END],
    outputRange: [18, 0],
    extrapolate: "clamp",
  });

  const handlePressIn = useCallback(() => {
    Animated.spring(pressScale, {
      toValue: 0.92,
      useNativeDriver: true,
      speed: 28,
      bounciness: 0,
    }).start();
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  }, [pressScale]);

  const handlePress = useCallback(() => {
    hapticMedium();
    onPress();
  }, [onPress]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          bottom,
          opacity,
          transform: [{ translateY }, { scale: Animated.multiply(scale, pressScale) }],
        },
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.fab}
        disabled={!interactive}
        pointerEvents={interactive ? "auto" : "none"}
        accessibilityRole="button"
        accessibilityLabel="Add workout to calendar"
      >
        <Text style={styles.icon}>+</Text>
      </Pressable>
    </Animated.View>
  );
}

const shadow = applyShadow("md");

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    right: spacing.lg,
    zIndex: 30,
    ...(Platform.OS === "web" ? ({ pointerEvents: "box-none" } as ViewStyle) : null),
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  icon: {
    color: colors.black,
    fontSize: 30,
    fontWeight: "600",
    lineHeight: 32,
    marginTop: -1,
  },
});
