import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { ShareChallengeDestination } from "@/lib/share-challenge";
import { SHARE_CHALLENGE_OPTIONS } from "@/lib/share-challenge";
import { colors, radius, spacing, typography } from "@frennix/ui";

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Share Challenge</Text>
          {challengeTitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {challengeTitle}
            </Text>
          ) : null}
          {SHARE_CHALLENGE_OPTIONS.map((option) => (
            <Pressable
              key={option.id}
              style={styles.option}
              onPress={() => onSelect(option.id)}
            >
              <Text style={styles.optionLabel}>{option.label}</Text>
              <Text style={styles.optionDescription}>{option.description}</Text>
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
  },
  optionLabel: { ...typography.body, fontWeight: "600", color: colors.text },
  optionDescription: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  cancelOption: { alignItems: "center" },
  cancelText: { ...typography.body, fontWeight: "600", color: colors.textSecondary },
});
