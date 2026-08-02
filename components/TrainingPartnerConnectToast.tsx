import { StyleSheet, Text, View } from "react-native";
import { colors, overlays, radius, spacing, typography } from "@frennix/ui";

type TrainingPartnerConnectToastProps = {
  visible: boolean;
  message: string;
};

export function TrainingPartnerConnectToast({ visible, message }: TrainingPartnerConnectToastProps) {
  if (!visible) return null;

  return (
    <View style={styles.wrap} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={styles.toast}>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingBottom: spacing.xxs,
  },
  toast: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: overlays.accentTintStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
  },
  message: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 16,
  },
});
