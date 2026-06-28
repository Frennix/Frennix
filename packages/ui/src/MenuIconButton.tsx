import { Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { touchTarget, typography } from "./theme";

type MenuIconButtonProps = Omit<PressableProps, "children"> & {
  compact?: boolean;
  accessibilityLabel?: string;
};

/** Standardized ⋯ overflow menu trigger used across cards and detail screens. */
export function MenuIconButton({
  compact = false,
  accessibilityLabel = "More options",
  hitSlop = 8,
  style,
  ...props
}: MenuIconButtonProps) {
  return (
    <Pressable
      style={[styles.hitArea, style]}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...props}
    >
      <Text style={compact ? typography.menuIconCompact : typography.menuIcon}>⋯</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    minWidth: touchTarget,
    minHeight: touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
});
