import { StyleSheet, Text } from "react-native";
import { colors, typography } from "./theme";

/** Small category mark for nutrition posts. Hidden for every other category. */
export function NutritionPostLabel() {
  return <Text style={styles.label}>Nutrition</Text>;
}

const styles = StyleSheet.create({
  label: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
