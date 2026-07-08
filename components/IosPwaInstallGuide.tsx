import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";
import { WEB_PUSH_HOME_SCREEN_MESSAGE } from "@/lib/web-push-messages";
import { logPushSetupFunnel } from "@/lib/web-push-diagnostics";

const STEPS = [
  "Tap the Share button at the bottom of Safari",
  'Scroll down and tap "Add to Home Screen"',
  'Tap "Add" in the top-right corner',
  "Open Frennix from your Home Screen icon",
  "Go to Settings → Notifications and tap Enable Notifications",
] as const;

type Props = {
  message?: string;
  collapsible?: boolean;
};

export function IosPwaInstallGuide({
  message = WEB_PUSH_HOME_SCREEN_MESSAGE,
  collapsible = true,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  function toggleGuide() {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      logPushSetupFunnel("install_guide_open", "user opened how-to-install guide");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Frennix to your Home Screen</Text>
      <Text style={styles.body}>{message}</Text>

      {collapsible ? (
        <>
          <Pressable
            onPress={toggleGuide}
            style={({ pressed }) => [styles.guideButton, pressed && styles.guideButtonPressed]}
            accessibilityRole="button"
            accessibilityLabel={expanded ? "Hide install steps" : "How to Install"}
          >
            <Text style={styles.guideButtonText}>
              {expanded ? "Hide install steps" : "How to Install"}
            </Text>
          </Pressable>
          {expanded ? <InstallSteps /> : null}
        </>
      ) : (
        <InstallSteps />
      )}
    </View>
  );
}

function InstallSteps() {
  return (
    <View style={styles.steps}>
      {STEPS.map((step, index) => (
        <View key={step} style={styles.stepRow}>
          <Text style={styles.stepNumber}>{index + 1}</Text>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
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
  guideButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  guideButtonPressed: {
    opacity: 0.85,
  },
  guideButtonText: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: "700",
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
