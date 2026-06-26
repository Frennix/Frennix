import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@frennix/ui";

interface ChallengeActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ChallengeActionSheet({
  visible,
  onClose,
  onEdit,
  onDelete,
}: ChallengeActionSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Challenge options</Text>
          <Pressable style={styles.option} onPress={onEdit}>
            <Text style={styles.optionText}>Edit Challenge</Text>
          </Pressable>
          <Pressable style={styles.option} onPress={onDelete}>
            <Text style={[styles.optionText, styles.dangerText]}>Delete Challenge</Text>
          </Pressable>
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
