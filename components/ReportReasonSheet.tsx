import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { REPORT_REASONS } from "@frennix/types";
import { BottomOverlayShell } from "@/components/BottomOverlayShell";
import { colors, spacing, typography } from "@frennix/ui";

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
    <BottomOverlayShell visible={visible} onClose={onClose} sheetMaxHeight="80%">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>Why are you reporting this?</Text>
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {REPORT_REASONS.map((reason) => (
          <Pressable key={reason} style={styles.option} onPress={() => onSelect(reason)}>
            <Text style={styles.optionText}>{reason}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable style={[styles.option, styles.cancelOption]} onPress={onClose}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </BottomOverlayShell>
  );
}

const styles = StyleSheet.create({
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
    minHeight: 48,
    justifyContent: "center",
  },
  optionText: { ...typography.body, color: colors.text },
  cancelOption: { backgroundColor: colors.surfaceElevated },
  cancelText: { ...typography.body, fontWeight: "600", color: colors.textSecondary },
});
