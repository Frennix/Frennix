import { StyleSheet, Text, View } from "react-native";
import { Button, colors, spacing, typography } from "@frennix/ui";
import { openCreatePost } from "@/lib/press-utils";

export function NutritionFeedEmpty() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Share what fuels you.</Text>
      <Text style={styles.body}>Post a meal, recipe, or meal-prep idea.</Text>
      <Button
        title="Share a meal"
        onPress={() => openCreatePost({ category: "nutrition" })}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    minHeight: 220,
  },
  title: {
    ...typography.heading,
    color: colors.text,
    textAlign: "center",
  },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  button: {
    marginTop: spacing.md,
    minWidth: 200,
  },
});
