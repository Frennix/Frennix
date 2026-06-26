import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { EntityActionDefinition, EntityActionId } from "@/lib/entity-actions";
import { colors, radius, spacing, typography } from "@frennix/ui";

interface EntityActionSheetProps {
  visible: boolean;
  title?: string;
  actions: EntityActionDefinition[];
  onSelect: (actionId: EntityActionId) => void;
  onClose: () => void;
}

function labelStyle(tone: EntityActionDefinition["tone"]) {
  if (tone === "danger") return styles.dangerText;
  if (tone === "muted") return styles.mutedText;
  return styles.optionText;
}

export function EntityActionSheet({
  visible,
  title = "Options",
  actions,
  onSelect,
  onClose,
}: EntityActionSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {actions.map((action) => (
            <Pressable
              key={action.id}
              style={styles.option}
              onPress={() => onSelect(action.id)}
            >
              <Text style={labelStyle(action.tone)}>
                {action.label}
                {action.placeholder ? " (coming soon)" : ""}
              </Text>
            </Pressable>
          ))}
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
  dangerText: { ...typography.body, fontWeight: "600", color: colors.danger },
  mutedText: { ...typography.body, fontWeight: "600", color: colors.textMuted },
  cancelOption: { backgroundColor: colors.surfaceElevated },
  cancelText: { ...typography.body, fontWeight: "600", color: colors.textSecondary },
});
