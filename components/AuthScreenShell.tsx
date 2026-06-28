import { StyleSheet, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing } from "@frennix/ui";

/** Auth/onboarding screens — respects home indicator without double top inset. */
export function AuthScreenShell({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.shell,
        {
          paddingTop: Math.max(insets.top, spacing.lg),
          paddingBottom: Math.max(insets.bottom, spacing.lg),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    justifyContent: "center",
    gap: spacing.lg,
  },
});
