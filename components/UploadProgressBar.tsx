import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";

type UploadProgressBarProps = {
  active: boolean;
  label: string;
  success?: boolean;
};

/** Indeterminate upload progress — premium feel during media/post submission. */
export function UploadProgressBar({ active, label, success = false }: UploadProgressBarProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!active || success) {
      loopRef.current?.stop();
      progress.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 0.72, duration: 900, useNativeDriver: false }),
        Animated.timing(progress, { toValue: 0.2, duration: 400, useNativeDriver: false }),
      ])
    );
    loopRef.current = loop;
    loop.start();
    return () => loop.stop();
  }, [active, progress, success]);

  if (!active && !success) return null;

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["8%", "100%"],
  });

  return (
    <View
      style={[styles.wrap, success && styles.wrapSuccess]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <View style={styles.track}>
        {success ? (
          <View style={[styles.fill, styles.fillSuccess]} />
        ) : (
          <Animated.View style={[styles.fill, { width }]} />
        )}
      </View>
      <Text style={[styles.label, success && styles.labelSuccess]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wrapSuccess: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  fillSuccess: {
    width: "100%",
  },
  label: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "600",
  },
  labelSuccess: {
    color: colors.accent,
  },
});
