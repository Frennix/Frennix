import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, typography } from "@frennix/ui";

type NewPostsBannerProps = {
  count: number;
  onPress: () => void;
};

export function NewPostsBanner({ count, onPress }: NewPostsBannerProps) {
  if (count <= 0) return null;

  const label = count === 1 ? "New post available" : `${count} new posts`;

  return (
    <Pressable
      style={styles.banner}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Tap to view.`}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: spacing.sm,
    alignSelf: "center",
    zIndex: 20,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  text: {
    ...typography.bodySmall,
    color: colors.background,
    fontWeight: "700",
  },
});
