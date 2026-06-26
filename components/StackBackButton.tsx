import { AppIcon } from "@/components/AppIcon";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { colors, spacing } from "@frennix/ui";
import { guardDoublePress } from "@/lib/press-utils";

type StackBackButtonProps = {
  /** Used when there is no history entry (common on mobile web). */
  fallbackHref?: Href;
  /** Override default back navigation (e.g. cancel a modal flow). */
  onBack?: () => void;
};

export function StackBackButton({ fallbackHref = "/(tabs)", onBack }: StackBackButtonProps) {
  const handlePress = guardDoublePress(() => {
    if (onBack) {
      onBack();
      return;
    }
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
      <AppIcon name="chevron-left" color={colors.text} size={28} />
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
