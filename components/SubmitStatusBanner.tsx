import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@frennix/ui";

interface SubmitStatusBannerProps {
  submittingLabel?: string;
  successLabel?: string;
  isSubmitting?: boolean;
  isSuccess?: boolean;
}

export function SubmitStatusBanner({
  submittingLabel = "Saving…",
  successLabel = "Success!",
  isSubmitting,
  isSuccess,
}: SubmitStatusBannerProps) {
  if (!isSubmitting && !isSuccess) return null;

  return (
    <View style={[styles.banner, isSuccess ? styles.success : styles.progress]}>
      {!isSuccess ? (
        <ActivityIndicator color={colors.accent} size="small" />
      ) : (
        <Text style={styles.successIcon}>✓</Text>
      )}
      <Text style={[styles.text, isSuccess && styles.successText]}>
        {isSuccess ? successLabel : submittingLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  progress: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  success: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  text: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  successText: { color: colors.accent, fontWeight: "600" },
  successIcon: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: "700",
    width: 20,
    textAlign: "center",
  },
});
