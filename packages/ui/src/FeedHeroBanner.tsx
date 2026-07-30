import { memo } from "react";
import { Platform, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { ScalePressable } from "./ScalePressable";
import { applyShadow, colors, overlays, radius, spacing, typography } from "./theme";

interface FeedHeroBannerProps {
  onFindAthletes: () => void;
  onShareWorkout: () => void;
  style?: ViewStyle;
}

export const FeedHeroBanner = memo(function FeedHeroBanner({
  onFindAthletes,
  onShareWorkout,
  style,
}: FeedHeroBannerProps) {
  return (
    <View style={[styles.shell, style]}>
      <View style={styles.backdrop} pointerEvents="none">
        <View style={styles.glowTopRight} />
        <View style={styles.glowCenter} />
        <View style={styles.vignette} />
        {Platform.OS === "web" ? <View style={styles.texture} /> : null}
      </View>

      <View style={styles.content}>
        <Text style={styles.kicker}>TRAIN TOGETHER</Text>
        <Text style={styles.headline}>Find Your Training Partner</Text>
        <Text style={styles.subtitle}>
          Train together. Stay accountable. Reach your goals.
        </Text>

        <View style={styles.actions}>
          <ScalePressable
            onPress={onFindAthletes}
            pressedScale={0.98}
            containerStyle={styles.primaryWrap}
            accessibilityRole="button"
            accessibilityLabel="Find Athletes"
          >
            <View style={styles.primaryButton}>
              <Text style={styles.primaryLabel}>Find Athletes</Text>
            </View>
          </ScalePressable>

          <ScalePressable
            onPress={onShareWorkout}
            pressedScale={0.98}
            containerStyle={styles.secondaryWrap}
            accessibilityRole="button"
            accessibilityLabel="Share Workout"
          >
            <View style={styles.secondaryButton}>
              <Text style={styles.secondaryLabel}>Share Workout</Text>
            </View>
          </ScalePressable>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    minHeight: 168,
    maxHeight: 188,
    borderRadius: radius.xl,
    overflow: "hidden",
    marginBottom: spacing.sm,
    ...applyShadow("lg"),
    ...(Platform.OS === "web"
      ? ({
          backgroundImage:
            "linear-gradient(135deg, #0f1a12 0%, #0b0b0d 38%, #12110f 72%, #0b0b0d 100%)",
        } as ViewStyle)
      : { backgroundColor: colors.backgroundFeed }),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  glowTopRight: {
    position: "absolute",
    top: -40,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: overlays.accentTintStrong,
    opacity: 0.85,
  },
  glowCenter: {
    position: "absolute",
    bottom: -60,
    left: "20%",
    width: 220,
    height: 120,
    borderRadius: 110,
    backgroundColor: "rgba(34, 197, 94, 0.06)",
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  texture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.04,
    backgroundImage:
      "repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 6px)",
  } as ViewStyle,
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    justifyContent: "flex-end",
    gap: 2,
  },
  kicker: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  headline: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...typography.bodySmall,
    color: overlays.whiteSoft,
    lineHeight: 18,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primaryWrap: {
    flexGrow: 1,
    flexBasis: "48%",
  },
  secondaryWrap: {
    flexGrow: 1,
    flexBasis: "48%",
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accent,
    ...applyShadow("accent"),
  },
  primaryLabel: {
    ...typography.button,
    color: colors.black,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: radius.xl,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    backgroundColor: overlays.glassMedium,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
  },
  secondaryLabel: {
    ...typography.button,
    color: colors.text,
    fontWeight: "700",
  },
});
