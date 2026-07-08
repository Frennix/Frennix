import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import {
  buildDiagnosticReport,
  formatDiagnosticReportText,
  getApiDiagnosticEntries,
  getDiagnosticContext,
  getDiagnosticEntries,
  subscribeClientDiagnostics,
} from "@/lib/client-diagnostics";
import { getWebPushPermissionStatus, hasActiveWebPushSubscription } from "@/lib/web-push";
import { isWebStandalone } from "@/lib/pwa";
import { showAlert, showSuccess } from "@/lib/alerts";
import { Button, colors, spacing, typography } from "@frennix/ui";

function useDiagnosticsRefresh() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeClientDiagnostics(() => setTick((n) => n + 1)), []);
}

export default function BetaDiagnosticsScreen() {
  useDiagnosticsRefresh();
  const { session } = useAuth();
  const [pushStatus, setPushStatus] = useState<string>("checking…");

  useEffect(() => {
    if (Platform.OS !== "web") {
      setPushStatus("native push");
      return;
    }
    void (async () => {
      const permission = await getWebPushPermissionStatus();
      const subscribed =
        permission === "granted" ? await hasActiveWebPushSubscription() : false;
      setPushStatus(
        `${permission}${subscribed ? " + subscribed" : ""}${isWebStandalone() ? " · home-screen" : " · browser"}`
      );
    })();
  }, []);

  const context = getDiagnosticContext();
  const entries = getDiagnosticEntries().slice(0, 40);
  const apiEntries = getApiDiagnosticEntries().slice(0, 30);
  const reportText = useMemo(
    () =>
      formatDiagnosticReportText(
        buildDiagnosticReport({
          push_status: pushStatus,
          user_email: session?.user.email ?? null,
        })
      ),
    [pushStatus, session?.user.email]
  );

  const copyReport = useCallback(async () => {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(reportText);
      showSuccess("Diagnostics copied");
      return;
    }
    showAlert("Diagnostics report", reportText.slice(0, 3500));
  }, [reportText]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Beta Diagnostics</Text>
      <Text style={styles.subtitle}>
        Share this report when something breaks. It includes recent actions, API calls, and errors.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Session</Text>
        <Text style={styles.line}>User ID: {session?.user.id ?? "signed out"}</Text>
        <Text style={styles.line}>Email: {session?.user.email ?? "n/a"}</Text>
        <Text style={styles.line}>Screen: {context.screen ?? "unknown"}</Text>
        <Text style={styles.line}>Last success: {context.lastSuccess ?? "n/a"}</Text>
        <Text style={styles.line}>Last failure: {context.lastFailure ?? "n/a"}</Text>
        <Text style={styles.line}>Network: {context.online ? "online" : "offline"}</Text>
        <Text style={styles.line}>Push: {pushStatus}</Text>
      </View>

      <View style={styles.actions}>
        <Button title="Copy full report" onPress={() => void copyReport()} />
      </View>

      <Text style={styles.sectionTitle}>Recent events</Text>
      {entries.length === 0 ? (
        <Text style={styles.empty}>No diagnostic events yet.</Text>
      ) : (
        entries.map((entry) => (
          <View key={entry.id} style={styles.eventRow}>
            <Text style={styles.eventMeta}>
              {new Date(entry.ts).toLocaleTimeString()} · {entry.level} · {entry.category}
            </Text>
            <Text style={styles.eventMessage}>{entry.message}</Text>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>API requests</Text>
      {apiEntries.length === 0 ? (
        <Text style={styles.empty}>No API calls recorded yet.</Text>
      ) : (
        apiEntries.map((entry) => (
          <View key={entry.id} style={styles.eventRow}>
            <Text style={styles.eventMeta}>
              {new Date(entry.ts).toLocaleTimeString()} · {entry.method} · {entry.ok ? "ok" : "fail"}
              {entry.status ? ` (${entry.status})` : ""}
            </Text>
            <Text style={styles.eventMessage} numberOfLines={2}>
              {entry.endpoint}
            </Text>
            {entry.error ? <Text style={styles.eventError}>{entry.error}</Text> : null}
          </View>
        ))
      )}

      <Pressable
        onPress={() => showAlert("Raw diagnostics", reportText.slice(0, 3500))}
        style={styles.rawLink}
      >
        <Text style={styles.rawLinkText}>Preview raw JSON</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  title: { ...typography.heading, color: colors.text, fontWeight: "800" },
  subtitle: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  cardTitle: { ...typography.body, fontWeight: "700", color: colors.text, marginBottom: 4 },
  line: { ...typography.bodySmall, color: colors.textSecondary },
  actions: { marginVertical: spacing.xs },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  empty: { ...typography.bodySmall, color: colors.textMuted },
  eventRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  eventMeta: { ...typography.caption, color: colors.textMuted },
  eventMessage: { ...typography.bodySmall, color: colors.text },
  eventError: { ...typography.caption, color: colors.danger },
  rawLink: { paddingVertical: spacing.md },
  rawLinkText: { ...typography.bodySmall, color: colors.accent, fontWeight: "600" },
});
