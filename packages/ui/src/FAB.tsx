import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, typography, applyShadow } from "./theme";

interface FABProps {
  icon?: string;
  label?: string;
  onPress: () => void;
}

export function FAB({ icon = "+", label, onPress }: FABProps) {
  return (
    <Pressable style={styles.fab} onPress={onPress}>
      <Text style={styles.icon}>{icon}</Text>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    minWidth: 56,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    ...applyShadow("md"),
  },
  icon: { color: colors.black, fontSize: 28, fontWeight: "600", lineHeight: 32 },
  label: { color: colors.black, fontSize: 16, fontWeight: "600" },
});
