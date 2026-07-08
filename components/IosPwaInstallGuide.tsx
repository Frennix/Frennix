import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";

const STEPS = [
  "Tap the Share button at the bottom of Safari",
  'Scroll down and tap "Add to Home Screen"',
  'Tap "Add" in the top-right corner',
  "Open Frennix from your Home Screen icon",
  "Go to Settings → Notifications and tap Enable Notifications",
] as const;

export function IosPwaInstallGuide() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Frennix to your Home Screen</Text>
      <Text style={styles.body}>
        On iPhone, notifications only work when Frennix is installed as a Home Screen app — not in
        a Safari or browser tab.
      </Text>
      <View style={styles.steps}>
        {STEPS.map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.body,
    fontWeight: "700",
    color: colors.text,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textMuted,
    lineHeight: 20,
  },
  steps: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  stepNumber: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.accent,
    width: 18,
    textAlign: "center",
  },
  stepText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
});
