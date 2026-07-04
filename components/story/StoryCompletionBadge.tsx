import { StyleSheet, Text, View } from "react-native";
import { colors, overlays, spacing, typography } from "@frennix/ui";

export function StoryCompletionBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>✓ Completed</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: overlays.glassMedium,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  text: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
  },
});
