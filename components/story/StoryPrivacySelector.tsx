import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StoryPrivacy } from "@frennix/types";
import { getStoryPrivacyOption, storyPrivacyChoices } from "@frennix/types";
import { colors, spacing, typography } from "@frennix/ui";

type StoryPrivacySelectorProps = {
  value: StoryPrivacy;
  onChange: (value: StoryPrivacy) => void;
  disabled?: boolean;
};

export function StoryPrivacySelector({ value, onChange, disabled }: StoryPrivacySelectorProps) {
  const options = storyPrivacyChoices(value);
  const selected = getStoryPrivacyOption(value);

  return (
    <View style={styles.wrap}>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(option.value)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled }}
              accessibilityLabel={`${option.label}. ${option.hint}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>
        Visible to {selected.label}. {selected.hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  chipText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: "800",
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
