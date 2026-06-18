import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { colors, spacing } from "@frennix/ui";
import { guardDoublePress } from "@/lib/press-utils";

type StackBackButtonProps = {
  /** Used when there is no history entry (common on mobile web). */
  fallbackHref?: Href;
};

export function StackBackButton({ fallbackHref = "/(tabs)" }: StackBackButtonProps) {
  const handlePress = guardDoublePress(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  });

  return (
    <Pressable
      onPress={handlePress}
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
