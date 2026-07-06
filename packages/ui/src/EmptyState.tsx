import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "./theme";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description: string;
  /** Optional emoji or short icon glyph above the title. */
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {icon ? <Text style={styles.icon} accessibilityElementsHidden>{icon}</Text> : null}
      <Text style={styles.title} allowFontScaling maxFontSizeMultiplier={1.4}>
        {title}
      </Text>
      <Text style={styles.description} allowFontScaling maxFontSizeMultiplier={1.4}>
        {description}
      </Text>
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
    minHeight: 220,
  },
  title: { ...typography.heading, textAlign: "center" },
  icon: { fontSize: 48, lineHeight: 56, marginBottom: spacing.xs },
  description: { ...typography.bodySmall, textAlign: "center", lineHeight: 22 },
  button: { marginTop: spacing.md, minWidth: 200 },
});
