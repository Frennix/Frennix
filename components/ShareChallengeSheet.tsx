import { Pressable, StyleSheet, Text } from "react-native";
import type { ShareChallengeDestination } from "@/lib/share-challenge";
import { SHARE_CHALLENGE_OPTIONS } from "@/lib/share-challenge";
import { BottomOverlayShell } from "@/components/BottomOverlayShell";
import { colors, spacing, typography } from "@frennix/ui";

interface ShareChallengeSheetProps {
  visible: boolean;
  challengeTitle?: string | null;
  onSelect: (destination: ShareChallengeDestination) => void;
  onClose: () => void;
}

export function ShareChallengeSheet({
  visible,
  challengeTitle,
  onSelect,
  onClose,
}: ShareChallengeSheetProps) {
  return (
    <BottomOverlayShell visible={visible} onClose={onClose}>
      <Text style={styles.title}>Share Challenge</Text>
      {challengeTitle ? (
        <Text style={styles.subtitle} numberOfLines={2}>
          {challengeTitle}
        </Text>
      ) : null}
      {SHARE_CHALLENGE_OPTIONS.map((option) => (
        <Pressable key={option.id} style={styles.option} onPress={() => onSelect(option.id)}>
          <Text style={styles.optionLabel}>{option.label}</Text>
          <Text style={styles.optionDescription}>{option.description}</Text>
        </Pressable>
      ))}
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
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "center",
    gap: spacing.xs,
    minHeight: 48,
    justifyContent: "center",
  },
  optionLabel: { ...typography.body, fontWeight: "600", color: colors.text },
  optionDescription: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  cancelOption: { backgroundColor: colors.surfaceElevated },
  cancelText: { ...typography.body, fontWeight: "600", color: colors.textSecondary },
});
