import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { colors, spacing } from "@frennix/ui";

export function StackBackButton() {
  if (!router.canGoBack()) return null;

  return (
    <Pressable
      onPress={() => router.back()}
      style={styles.button}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="chevron-back" size={28} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginLeft: spacing.xs,
    paddingRight: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 44,
    minHeight: 44,
  },
});
