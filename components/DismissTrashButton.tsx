import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@frennix/ui";

type DismissTrashButtonProps = {
  onPress: () => void;
  accessibilityLabel?: string;
};

export function DismissTrashButton({
  onPress,
  accessibilityLabel = "Delete",
}: DismissTrashButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Text style={styles.icon}>🗑</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: { fontSize: 16, lineHeight: 18 },
});
