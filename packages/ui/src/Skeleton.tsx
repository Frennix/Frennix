import { useEffect, useRef } from "react";
import { Animated, StyleSheet, type ViewStyle } from "react-native";
import { colors, radius } from "./theme";

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = "100%", height = 16, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.base, { width, height, opacity }, style]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
  },
});
