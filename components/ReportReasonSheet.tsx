import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { REPORT_REASONS } from "@frennix/types";
import { colors, radius, spacing, typography } from "@frennix/ui";

interface ReportReasonSheetProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onSelect: (reason: string) => void;
}

export function ReportReasonSheet({
  visible,
  title = "Report",
  onClose,
  onSelect,
}: ReportReasonSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Why are you reporting this?</Text>
          <ScrollView style={styles.list}>
            {REPORT_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={styles.option}
                onPress={() => onSelect(reason)}
              >
                <Text style={styles.optionText}>{reason}</Text>
              </Pressable>
            ))}
          </ScrollView>
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
    maxHeight: "80%",
  },
  title: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    paddingTop: spacing.md,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  list: { maxHeight: 320 },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
  },
  optionText: { ...typography.body, color: colors.text },
  cancelOption: { backgroundColor: colors.surfaceElevated },
  cancelText: { ...typography.body, fontWeight: "600", color: colors.textSecondary },
});
