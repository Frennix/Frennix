import { Pressable, StyleSheet, Text } from "react-native";
import { BottomOverlayShell } from "@/components/BottomOverlayShell";
import { colors, spacing, typography } from "@frennix/ui";

interface ContentModerationSheetProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onReport: () => void;
  onBlock?: () => void;
  blockLabel?: string;
}

export function ContentModerationSheet({
  visible,
  title = "Options",
  onClose,
  onReport,
  onBlock,
  blockLabel = "Block user",
}: ContentModerationSheetProps) {
  return (
    <BottomOverlayShell visible={visible} onClose={onClose}>
      <Text style={styles.title}>{title}</Text>
      <Pressable style={styles.option} onPress={onReport}>
        <Text style={styles.optionText}>Report</Text>
      </Pressable>
      {onBlock ? (
        <Pressable style={styles.option} onPress={onBlock}>
          <Text style={[styles.optionText, styles.dangerText]}>{blockLabel}</Text>
        </Pressable>
      ) : null}
      <Pressable style={[styles.option, styles.cancelOption]} onPress={onClose}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </BottomOverlayShell>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  optionText: { ...typography.body, fontWeight: "600", color: colors.text },
  dangerText: { color: colors.danger },
  cancelOption: { backgroundColor: colors.surfaceElevated },
  cancelText: { ...typography.body, fontWeight: "600", color: colors.textSecondary },
});
