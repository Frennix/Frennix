import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "@frennix/ui";
import { showAlert, showSuccess } from "@/lib/alerts";
import {
  formatStartupDiagnosticReportText,
  getLastSentStartupReportRef,
  sendStartupDiagnosticReport,
} from "@/lib/auto-startup-diagnostic-report";
import { getStartupMountGap, formatStartupMountSummary } from "@/lib/startup-mount-trace";
import { useAuth } from "@/providers/AuthProvider";

type StartupDiagnosticPanelProps = {
  source: string;
  reason: string;
  screen?: string;
  autoSend?: boolean;
};

/** Inline diagnostics on error screens — no navigation to /beta-diagnostics required. */
export function StartupDiagnosticPanel({
  source,
  reason,
  screen = "startup-failure",
  autoSend = true,
}: StartupDiagnosticPanelProps) {
  const { session } = useAuth();
  const [reportRef, setReportRef] = useState<string | null>(getLastSentStartupReportRef());
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [sendError, setSendError] = useState<string | null>(null);

  const summary = useMemo(() => {
    const gap = getStartupMountGap();
    const mountSummary = formatStartupMountSummary(6);
    return { gap, mountSummary };
  }, []);

  const reportText = useMemo(
    () =>
      formatStartupDiagnosticReportText({
        source,
        reason,
        report_ref: reportRef,
        user_email: session?.user.email ?? null,
      }),
    [source, reason, reportRef, session?.user.email]
  );

  useEffect(() => {
    if (!autoSend) return;
    setSendState("sending");
    void sendStartupDiagnosticReport({
      source,
      reason,
      userId: session?.user.id,
      email: session?.user.email ?? undefined,
      screen,
      extra: { mount_gap: summary.gap, mount_summary: summary.mountSummary },
    }).then((result) => {
      setReportRef(result.reportRef);
      if (result.sent) {
        setSendState("sent");
        setSendError(null);
      } else {
        setSendState("failed");
        setSendError(result.error ?? "Could not send automatically");
      }
    });
  }, [autoSend, source, reason, screen, session?.user.id, session?.user.email, summary.gap, summary.mountSummary]);

  const copyReport = useCallback(async () => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(reportText);
      showSuccess("Diagnostic report copied");
      return;
    }
    showAlert("Diagnostic report", reportText.slice(0, 3500));
  }, [reportText]);

  const resendReport = useCallback(() => {
    setSendState("sending");
    void sendStartupDiagnosticReport({
      source,
      reason: `${reason} (manual resend)`,
      userId: session?.user.id,
      email: session?.user.email ?? undefined,
      screen,
    }).then((result) => {
      setReportRef(result.reportRef);
      if (result.sent) {
        setSendState("sent");
        setSendError(null);
        showSuccess("Report sent to support");
      } else {
        setSendState("failed");
        setSendError(result.error ?? "Send failed — use Copy report");
      }
    });
  }, [source, reason, screen, session?.user.email, session?.user.id]);

  return (
    <View style={styles.panel} nativeID="startup-diagnostic-panel">
      <Text style={styles.heading}>Startup diagnostics (automatic)</Text>
      <Text style={styles.line}>Reason: {reason}</Text>
      {summary.gap ? <Text style={styles.line}>Paused before: {summary.gap}</Text> : null}
      {summary.mountSummary ? <Text style={styles.muted}>{summary.mountSummary}</Text> : null}
      {reportRef ? <Text style={styles.line}>Report ref: {reportRef}</Text> : null}
      {sendState === "sent" ? (
        <Text style={styles.sent}>Report sent to support automatically.</Text>
      ) : sendState === "sending" ? (
        <Text style={styles.muted}>Sending diagnostic report…</Text>
      ) : (
        <Text style={styles.warn}>
          {sendError ?? "Report not sent yet."} Use Copy report or Send again below.
        </Text>
      )}
      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={() => void copyReport()}>
          <Text style={styles.buttonText}>Copy report</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={resendReport}>
          <Text style={styles.secondaryButtonText}>Send again</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    maxWidth: 360,
    width: "100%",
  },
  heading: {
    ...typography.bodySmall,
    fontWeight: "800",
    color: colors.text,
  },
  line: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  muted: {
    ...typography.caption,
    color: colors.textMuted,
    opacity: 0.85,
    lineHeight: 16,
  },
  sent: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
  },
  warn: {
    ...typography.caption,
    color: colors.danger,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  buttonText: {
    ...typography.caption,
    color: colors.background,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "600",
  },
});
