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
    minHeight: 134,
    maxHeight: 150,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.xxs,
    ...applyShadow("md"),
    ...(Platform.OS === "web"
      ? ({
          backgroundImage:
            "linear-gradient(135deg, #101510 0%, #0b0b0d 52%, #0f0f11 100%)",
        } as ViewStyle)
      : { backgroundColor: colors.backgroundFeed }),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  glowTopRight: {
    position: "absolute",
    top: -48,
    right: -24,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: overlays.accentTintStrong,
    opacity: 0.45,
  },
  glowCenter: {
    position: "absolute",
    bottom: -48,
    left: "18%",
    width: 180,
    height: 96,
    borderRadius: 90,
    backgroundColor: "rgba(34, 197, 94, 0.04)",
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: "flex-end",
    gap: 1,
  },
  kicker: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
    letterSpacing: 1.1,
    fontSize: 11,
  },
  headline: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    ...typography.bodySmall,
    color: overlays.whiteSoft,
    lineHeight: 17,
    fontSize: 12,
    marginBottom: spacing.xxs,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: 2,
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
    minHeight: 40,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.accent,
    ...applyShadow("accent"),
  },
  primaryLabel: {
    ...typography.button,
    color: colors.black,
    fontWeight: "800",
    fontSize: 14,
  },
  secondaryButton: {
    minHeight: 40,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    backgroundColor: overlays.glassMedium,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
  },
  secondaryLabel: {
    ...typography.button,
    color: colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
});
