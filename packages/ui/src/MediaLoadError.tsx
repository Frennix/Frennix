import { Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, spacing, typography } from "./theme";

interface MediaLoadErrorProps {
  label?: string;
  onRetry: () => void;
  style?: ViewStyle;
  compact?: boolean;
}

/** Accessible fallback when image or video media fails to load. */
export function MediaLoadError({
  label = "Media unavailable",
  onRetry,
  style,
  compact,
}: MediaLoadErrorProps) {
  return (
    <View
      style={[styles.wrap, compact && styles.compact, style]}
      accessibilityRole="alert"
      accessibilityLabel={`${label}. Retry loading.`}
    >
      <Text style={[styles.label, compact && styles.labelCompact]}>{label}</Text>
      <Pressable
        style={[styles.retryButton, compact && styles.retryButtonCompact]}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading media"
      >
        <Text style={[styles.retryText, compact && styles.retryTextCompact]}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    padding: spacing.md,
  },
  compact: {
    gap: spacing.xs,
    padding: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "600",
    textAlign: "center",
  },
  labelCompact: {
    fontSize: 10,
  },
  retryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  retryButtonCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  retryText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
  },
  retryTextCompact: {
    fontSize: 10,
  },
});
