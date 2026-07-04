import { MoreVertical } from "lucide-react-native";
import { Platform, Pressable, StyleSheet } from "react-native";
import { colors, spacing } from "@frennix/ui";

type MessageActionsMenuProps = {
  onPress: () => void;
};

export function MessageActionsMenu({ onPress }: MessageActionsMenuProps) {
  return (
    <Pressable
      style={[styles.button, Platform.OS === "web" && styles.webButton]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Message options"
      accessibilityHint="Opens delete and reaction options"
      hitSlop={8}
    >
      <MoreVertical color={colors.textMuted} size={18} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    width: 28,
    height: 28,
    marginHorizontal: spacing.xs,
    borderRadius: 14,
  },
  webButton: {
    cursor: "pointer",
  },
});
