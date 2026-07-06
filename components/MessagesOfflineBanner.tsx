import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";

type MessagesOfflineBannerProps = {
  visible: boolean;
  retrying?: boolean;
};

export function MessagesOfflineBanner({ visible, retrying = false }: MessagesOfflineBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.text}>
        {retrying
          ? "Reconnecting… showing your last saved conversations."
          : "You’re offline. Showing saved conversations until connection returns."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
