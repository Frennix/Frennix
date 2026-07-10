import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@frennix/ui";
import { flexFill, webAppShell } from "@/lib/flex-layout";
import {
  buildWebStartupDiagnosticCode,
  clearSafeTransientStartupState,
  type WebStartupFailureCategory,
} from "@/lib/web-startup-checkpoints";

type WebAuthenticatedStartupFallbackProps = {
  category: WebStartupFailureCategory;
  onRetry: () => void;
  onSignOut: () => void;
};

/** Production-safe authenticated startup failure UI — never leave a black screen. */
export function WebAuthenticatedStartupFallback({
  category,
  onRetry,
  onSignOut,
}: WebAuthenticatedStartupFallbackProps) {
  const diagnosticCode = buildWebStartupDiagnosticCode({ category });

  const copyDiagnosticCode = () => {
    void navigator.clipboard?.writeText(diagnosticCode);
  };

  return (
    <View style={styles.overlay} nativeID="web-authenticated-startup-fallback">
      <View style={styles.panel}>
        <Text style={styles.title}>Frennix could not finish loading.</Text>
        <Text style={styles.message}>
          Your account signed in, but the website did not finish starting. Retry or sign out and try
          again.
        </Text>
        <Text style={styles.codeLabel}>Diagnostic code</Text>
        <Text style={styles.code} selectable>
          {diagnosticCode}
        </Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry"
            onPress={onRetry}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            onPress={onSignOut}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryButtonText}>Sign Out</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy diagnostic code"
            onPress={copyDiagnosticCode}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryButtonText}>Copy Diagnostic Code</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: Platform.select({
    web: {
      position: "fixed" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2147483646,
      backgroundColor: colors.background,
      ...flexFill,
      ...webAppShell,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    default: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 9999,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
  }),
  panel: {
    width: "100%",
    maxWidth: 420,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  message: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  codeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  code: {
    color: colors.accent,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    fontFamily: Platform.OS === "web" ? "monospace" : undefined,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
    alignItems: "stretch",
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
  },
  secondaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
});
