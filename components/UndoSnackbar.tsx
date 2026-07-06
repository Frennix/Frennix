import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "@frennix/ui";

type UndoSnackbarProps = {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onUndo: () => void;
};

export function UndoSnackbar({
  visible,
  message,
  actionLabel = "Undo",
  onUndo,
}: UndoSnackbarProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View
      style={[styles.container, { bottom: Math.max(insets.bottom, spacing.md) + 56 }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      <Pressable
        onPress={onUndo}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        hitSlop={8}
      >
        <Text style={styles.action}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.black,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  message: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  action: {
    ...typography.body,
    color: colors.accent,
    fontWeight: "700",
  },
});
