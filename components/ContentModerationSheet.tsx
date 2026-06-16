import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@frennix/ui";

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 10, 11, 0.72)",
    justifyContent: "flex-end",
    padding: spacing.md,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
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
  },
  optionText: { ...typography.body, fontWeight: "600", color: colors.text },
  dangerText: { color: colors.danger },
  cancelOption: { backgroundColor: colors.surfaceElevated },
  cancelText: { ...typography.body, fontWeight: "600", color: colors.textSecondary },
});
