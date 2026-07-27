import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, typography } from "@frennix/ui";

type PwaUpdatePromptProps = {
  visible: boolean;
  onReload: () => void;
};

/** Standalone PWA — prompt when a newer production build is available. */
export function PwaUpdatePrompt({ visible, onReload }: PwaUpdatePromptProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + spacing.sm }]} pointerEvents="box-none">
      <View style={styles.banner}>
        <Text style={styles.text}>Update available — Reload to get the latest Frennix.</Text>
        <Pressable onPress={onReload} style={styles.button} accessibilityRole="button">
          <Text style={styles.buttonText}>Reload</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
    alignItems: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    maxWidth: 520,
    width: "100%",
  },
  text: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
  button: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.accentMuted,
  },
  buttonText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
  },
});
