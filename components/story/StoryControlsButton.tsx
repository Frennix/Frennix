import { Pressable, StyleSheet } from "react-native";
import { MoreHorizontal } from "lucide-react-native";
import { colors, overlays, touchTarget } from "@frennix/ui";

type StoryControlsButtonProps = {
  onPress: () => void;
};

export function StoryControlsButton({ onPress }: StoryControlsButtonProps) {
  return (
    <Pressable
      style={styles.button}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Story controls"
      accessibilityHint="Opens privacy, save, commenting, and delete options"
    >
      <MoreHorizontal size={18} color={colors.text} strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: overlays.glassMedium,
    borderWidth: 1,
    borderColor: overlays.glassBorderStrong,
  },
});
