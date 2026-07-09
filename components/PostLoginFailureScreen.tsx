import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@frennix/ui";
import { flexFill, webAppShell } from "@/lib/flex-layout";
import { StartupDiagnosticPanel } from "@/components/StartupDiagnosticPanel";

type PostLoginFailureScreenProps = {
  title?: string;
  message: string;
  detail?: string;
  onRetry?: () => void;
  onLogout?: () => void;
  /** Full-screen overlay above app chrome (post-login watchdog). */
  overlay?: boolean;
  diagnosticSource?: string;
  diagnosticReason?: string;
};

/** Visible fallback when post-login startup fails — never leave a black screen. */
export function PostLoginFailureScreen({
  title = "Frennix could not finish loading",
  message,
  detail,
  onRetry,
  onLogout,
  overlay = false,
  diagnosticSource = "post-login-failure",
  diagnosticReason,
}: PostLoginFailureScreenProps) {
  const reason = diagnosticReason ?? message;

  return (
    <ScrollView
      style={overlay ? styles.overlayScroll : undefined}
      contentContainerStyle={styles.container}
      nativeID="authenticated-startup-fallback"
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      <View style={styles.actions}>
        {onRetry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry"
            onPress={onRetry}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        ) : null}
        {onLogout ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log out"
            onPress={onLogout}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryButtonText}>Log out</Text>
          </Pressable>
        ) : null}
      </View>
      <StartupDiagnosticPanel source={diagnosticSource} reason={reason} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...flexFill,
    ...(Platform.OS === "web" ? webAppShell : null),
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
    gap: spacing.sm,
    flexGrow: 1,
  },
  overlay: Platform.select({
    web: {
      position: "fixed" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2147483645,
      backgroundColor: colors.background,
    },
    default: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 9999,
      backgroundColor: colors.background,
    },
  }),
  overlayScroll: Platform.select({
    web: {
      position: "fixed" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2147483645,
      backgroundColor: colors.background,
    },
    default: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 9999,
      backgroundColor: colors.background,
    },
  }),
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
    maxWidth: 340,
  },
  detail: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 360,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: spacing.md,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  secondaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
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
