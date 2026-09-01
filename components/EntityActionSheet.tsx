import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { EntityActionDefinition, EntityActionId } from "@/lib/entity-actions";
import { BottomOverlayShell } from "@/components/BottomOverlayShell";
import { colors, spacing, typography } from "@frennix/ui";

interface EntityActionSheetProps {
  visible: boolean;
  title?: string;
  actions: EntityActionDefinition[];
  onSelect: (actionId: EntityActionId) => void;
  onClose: () => void;
  rootPortal?: boolean;
  webZIndex?: number;
  portalDataAttribute?: string;
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
  rootPortal,
  webZIndex,
  portalDataAttribute,
}: EntityActionSheetProps) {
  return (
    <BottomOverlayShell
      visible={visible}
      onClose={onClose}
      rootPortal={rootPortal}
      webZIndex={webZIndex}
      portalDataAttribute={portalDataAttribute}
    >
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={actions.length > 6}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.sheetContent}
      >
        <Text style={styles.title}>{title}</Text>
        {actions.map((action) => (
          <Pressable key={action.id} style={styles.option} onPress={() => onSelect(action.id)}>
            <Text style={labelStyle(action.tone)}>
              {action.label}
              {action.placeholder ? " (coming soon)" : ""}
            </Text>
          </Pressable>
        ))}
        <Pressable style={[styles.option, styles.cancelOption]} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </BottomOverlayShell>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingBottom: spacing.lg,
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
    minHeight: 48,
    justifyContent: "center",
  },
  optionText: { ...typography.body, fontWeight: "600", color: colors.text },
  dangerText: { ...typography.body, fontWeight: "600", color: colors.danger },
  mutedText: { ...typography.body, fontWeight: "600", color: colors.textMuted },
  cancelOption: { backgroundColor: colors.surfaceElevated },
  cancelText: { ...typography.body, fontWeight: "600", color: colors.textSecondary },
});
