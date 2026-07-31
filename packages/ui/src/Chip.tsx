import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "./theme";

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  const content = (
    <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
  );

  if (!onPress) {
    return (
      <View style={[styles.chip, selected && styles.chipSelected]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  text: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  textSelected: {
    color: colors.accent,
    fontWeight: "600",
  },
});
