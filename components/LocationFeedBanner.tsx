import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppIcon } from "@/components/AppIcon";
import { FrennixLogo } from "@/components/FrennixLogo";
import { colors, radius, spacing, typography, applyShadow } from "@frennix/ui";

type LocationFeedBannerProps = {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
};

/** Small dismissible feed banner — does not alter feed layout. */
export function LocationFeedBanner({ visible, onEnable, onDismiss }: LocationFeedBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.banner}>
        <FrennixLogo variant="icon" height={22} style={styles.logo} />
        <Text style={styles.text}>Turn on location to find nearby training partners.</Text>
        <Pressable
          onPress={onEnable}
          style={styles.enableButton}
          accessibilityRole="button"
          accessibilityLabel="Enable location now"
        >
          <Text style={styles.enableText}>Enable Now</Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss location banner"
        >
          <AppIcon name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    zIndex: 15,
    alignItems: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    maxWidth: 520,
    width: "100%",
    ...applyShadow("sm"),
  },
  logo: { flexShrink: 0 },
  text: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  enableButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.accentMuted,
  },
  enableText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
  },
});
