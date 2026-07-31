import { Pressable, StyleSheet, Text } from "react-native";
import { Eye } from "lucide-react-native";
import { colors, overlays, spacing, typography } from "@frennix/ui";

type StoryViewerEyeButtonProps = {
  count: number;
  onPress: () => void;
};

/** Owner-only viewer count control — eye icon + unique viewer total. */
export function StoryViewerEyeButton({ count, onPress }: StoryViewerEyeButtonProps) {
  return (
    <Pressable
      style={styles.button}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${count} viewers. Open viewer list.`}
    >
      <Eye size={16} color={colors.accent} strokeWidth={2.25} />
      <Text style={styles.count}>{count}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: overlays.glassMedium,
    borderWidth: 1,
    borderColor: overlays.glassBorderStrong,
  },
  count: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "800",
    minWidth: 12,
    textAlign: "center",
  },
});
