import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors, spacing } from "./theme";

type ScreenSpinnerProps = {
  size?: "small" | "large";
};

/** Centered blocking load indicator for full-screen auth gates and form hydration. */
export function ScreenSpinner({ size = "large" }: ScreenSpinnerProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
});
