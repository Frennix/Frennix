import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "@frennix/ui";
import { flexFill, webAppShell } from "@/lib/flex-layout";
import { formatStartupMountSummary, getStartupMountGap } from "@/lib/startup-mount-trace";
import { StartupDiagnosticPanel } from "@/components/StartupDiagnosticPanel";

type StartupRetryScreenProps = {
  title?: string;
  message: string;
  detail?: string;
  loading?: boolean;
  onRetry?: () => void;
  onLogout?: () => void;
  showDiagnostics?: boolean;
  diagnosticSource?: string;
  /** When false, hide mount trace (misleading during first render before effects flush). */
  showMountTrace?: boolean;
};

/** Visible fallback when auth bootstrap or startup stalls — never leave a blank black screen. */
export function StartupRetryScreen({
  title = "Loading Frennix",
  message,
  detail,
  loading = false,
  onRetry,
  onLogout,
  showDiagnostics = true,
  diagnosticSource = "startup-retry",
  showMountTrace = true,
}: StartupRetryScreenProps) {
  const gap = showMountTrace ? getStartupMountGap() : null;
  const traceSummary = showMountTrace ? formatStartupMountSummary(6) : null;
  const showDiagnosticPanel = showDiagnostics && !loading && Boolean(onRetry || onLogout);

  return (
    <ScrollView contentContainerStyle={styles.container} nativeID="startup-retry-screen">
      {loading ? <ActivityIndicator color={colors.accent} size="large" /> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      {gap ? <Text style={styles.trace}>Startup paused before: {gap}</Text> : null}
      {traceSummary ? <Text style={styles.traceMuted}>{traceSummary}</Text> : null}
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
      {showDiagnosticPanel ? (
        <StartupDiagnosticPanel source={diagnosticSource} reason={message} />
      ) : null}
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
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginTop: spacing.sm,
  },
  message: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },
  detail: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 340,
  },
  trace: {
    color: colors.accent,
    fontSize: 12,
    textAlign: "center",
    maxWidth: 360,
    marginTop: spacing.xs,
  },
  traceMuted: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: "center",
    maxWidth: 360,
    opacity: 0.8,
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
