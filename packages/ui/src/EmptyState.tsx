import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "./theme";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
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
  },
  title: { ...typography.heading, textAlign: "center" },
  description: { ...typography.bodySmall, textAlign: "center", lineHeight: 22 },
  button: { marginTop: spacing.md, minWidth: 200 },
});
