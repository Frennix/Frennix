import { StyleSheet, Text, View } from "react-native";
import { Button } from "./Button";
import { colors, spacing, typography } from "./theme";

interface QueryErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
}

/** Inline retry UI for failed React Query loads — keeps cached data visible when possible. */
export function QueryErrorState({
  title = "Could not load",
  message = "Check your connection and try again.",
  onRetry,
  retryLabel = "Try again",
  compact = false,
}: QueryErrorStateProps) {
  return (
    <View style={[styles.container, compact && styles.compact]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Button title={retryLabel} variant="secondary" onPress={onRetry} style={styles.button} />
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
    backgroundColor: colors.background,
  },
  compact: {
    flex: 0,
    paddingVertical: spacing.lg,
  },
  title: { ...typography.heading, fontSize: 18, textAlign: "center" },
  message: { ...typography.bodySmall, textAlign: "center", lineHeight: 22, color: colors.textSecondary },
  button: { marginTop: spacing.sm, minWidth: 160 },
});
