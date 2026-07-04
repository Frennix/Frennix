import { ReactNode, useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type AnimatedDismissRowProps = {
  dismissing: boolean;
  children: ReactNode;
};

export function AnimatedDismissRow({ dismissing, children }: AnimatedDismissRowProps) {
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (dismissing) {
      opacity.value = withTiming(0, { duration: 220 });
      translateY.value = withTiming(-10, { duration: 240 });
      scale.value = withTiming(0.97, { duration: 220 });
      return;
    }

    opacity.value = 1;
    translateY.value = 0;
    scale.value = 1;
  }, [dismissing, opacity, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.root, animatedStyle]} pointerEvents={dismissing ? "none" : "auto"}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: "hidden",
  },
});
