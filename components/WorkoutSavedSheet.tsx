import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { StoryShareMode } from "@frennix/types";
import { colors, spacing, typography } from "@frennix/ui";

const OPTIONS: Array<{ mode: StoryShareMode | "done"; label: string; hint: string; emoji: string }> = [
  { mode: "feed", label: "Post to Feed", hint: "Share on your home feed", emoji: "📰" },
  { mode: "story", label: "Share to Story", hint: "24-hour story only", emoji: "⭕" },
  { mode: "both", label: "Share to Both", hint: "Feed post and story", emoji: "✨" },
  { mode: "done", label: "Done", hint: "Save without sharing", emoji: "✓" },
];

type WorkoutSavedSheetProps = {
  visible: boolean;
  loading?: boolean;
  onSelect: (mode: StoryShareMode | "done") => void;
  onClose: () => void;
};

export function WorkoutSavedSheet({ visible, loading, onSelect, onClose }: WorkoutSavedSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.emoji}>💪</Text>
            <Text style={styles.title}>Workout Saved</Text>
            <Text style={styles.subtitle}>Choose where to share — nothing posts automatically.</Text>
          </View>

          <View style={styles.options}>
            {OPTIONS.map((option) => (
              <Pressable
                key={option.mode}
                style={[styles.option, loading && styles.optionDisabled]}
                onPress={() => onSelect(option.mode)}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={option.label}
              >
                <Text style={styles.optionEmoji}>{option.emoji}</Text>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionHint}>{option.hint}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    alignItems: "center",
    gap: spacing.xs,
  },
  emoji: {
    fontSize: 40,
    lineHeight: 44,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    fontWeight: "800",
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: "center",
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionEmoji: {
    fontSize: 24,
    lineHeight: 28,
    width: 32,
    textAlign: "center",
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    ...typography.body,
    color: colors.text,
    fontWeight: "700",
  },
  optionHint: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
