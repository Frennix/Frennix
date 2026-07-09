import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@frennix/ui";
import { flexFill, webAppShell } from "@/lib/flex-layout";
import { formatStartupMountSummary, getStartupMountGap } from "@/lib/startup-mount-trace";

type LoginFailureScreenProps = {
  title?: string;
  message: string;
  detail?: string;
  errorMessage?: string;
  onRetry?: () => void;
};

/** Visible fallback when the login route fails to render — never leave a blank black screen. */
export function LoginFailureScreen({
  title = "Sign-in screen failed to load",
  message,
  detail,
  errorMessage,
  onRetry,
}: LoginFailureScreenProps) {
  const gap = getStartupMountGap();
  const traceSummary = formatStartupMountSummary(8);

  return (
    <View style={styles.container} nativeID="login-failure-screen">
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      {gap ? <Text style={styles.trace}>Startup paused before: {gap}</Text> : null}
      <Text style={styles.traceMuted}>{traceSummary}</Text>
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
    </View>
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
    maxWidth: 340,
  },
  detail: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 360,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 360,
  },
  trace: {
    color: colors.accent,
    fontSize: 12,
    textAlign: "center",
    maxWidth: 360,
  },
  traceMuted: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: "center",
    maxWidth: 360,
    opacity: 0.8,
  },
  button: {
    marginTop: spacing.md,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.accent,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "600",
  },
});
