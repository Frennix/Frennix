import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { HealthMetric, PlatformSubsystemHealth } from "@frennix/types";
import { FounderShell } from "@/components/founder/FounderShell";
import { FounderWidget } from "@/components/founder/FounderWidget";
import { HealthMetricGrid } from "@/components/founder/HealthMetricGrid";
import { usePlatformHealth } from "@/lib/founder/usePlatformHealth";
import { downloadTextFile, rowsToCsv } from "@/lib/founder/utils";
import { colors, spacing, typography } from "@frennix/ui";

const SUBSYSTEM_EMOJI: Record<string, string> = {
  app_errors: "⚠️",
  crashes: "🚨",
  api_latency: "⏱️",
  supabase: "🟢",
  realtime_messaging: "💬",
  database: "🗄️",
  storage: "📦",
  notifications: "🔔",
  deployment: "🚀",
  app: "📱",
};

function statusEmoji(status: string): string {
  switch (status) {
    case "healthy":
      return "🟢";
    case "degraded":
      return "🟡";
    case "down":
      return "🔴";
    default:
      return "⚪";
  }
}

function subsystemToMetric(sub: PlatformSubsystemHealth): HealthMetric {
  let value: number | string | null = sub.status;
  let suffix: string | undefined;

  if (sub.latency_ms != null) {
    value = sub.latency_ms;
    suffix = "ms";
  } else if (sub.error_rate != null) {
    value = sub.error_rate;
    suffix = "%";
  } else if (sub.details?.delivery_rate != null) {
    value = sub.details.delivery_rate as number;
    suffix = "%";
  } else if (sub.key === "deployment" && sub.details?.version) {
    value = String(sub.details.version);
  }

  return {
    key: sub.key,
    label: sub.label,
    emoji: SUBSYSTEM_EMOJI[sub.key] ?? statusEmoji(sub.status),
    value,
    suffix,
    placeholder: sub.placeholder,
  };
}

export default function PlatformHealthScreen() {
  const query = usePlatformHealth();

  const metrics = useMemo(
    () => (query.data?.subsystems ?? []).map(subsystemToMetric),
    [query.data?.subsystems]
  );

  const computedAt = query.data?.computed_at ? new Date(query.data.computed_at) : null;
  const overall = query.data?.overall_status ?? "unknown";

  return (
    <FounderShell title="Platform Health">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.overallBanner}>
          <Text style={styles.overallEmoji}>{statusEmoji(overall)}</Text>
          <View>
            <Text style={styles.overallTitle}>Overall: {overall}</Text>
            <Text style={styles.overallSub}>Auto-refreshes every 30 seconds</Text>
          </View>
        </View>

        <FounderWidget
          title="Subsystem Status"
          subtitle="Supabase, Realtime, database, notifications, deployment"
          loading={query.isLoading && !query.data}
          error={query.isError ? "Could not load platform health" : null}
          updatedAt={computedAt}
          onRefresh={() => void query.refetch()}
          exportEnabled
          onExport={(format) => {
            const rows = (query.data?.subsystems ?? []).map((s) => ({
              key: s.key,
              label: s.label,
              status: s.status,
              latency_ms: s.latency_ms ?? "",
              error_rate: s.error_rate ?? "",
              recorded_at: s.recorded_at,
            }));
            if (format === "csv") {
              downloadTextFile("frennix-platform-health.csv", rowsToCsv(rows), "text/csv");
            } else {
              downloadTextFile(
                "frennix-platform-health.json",
                JSON.stringify(query.data, null, 2),
                "application/json"
              );
            }
          }}
        >
          {metrics.length > 0 ? <HealthMetricGrid metrics={metrics} /> : null}
        </FounderWidget>

        {query.data?.subsystems?.map((sub) => (
          <View key={sub.key} style={styles.detailCard}>
            <Text style={styles.detailTitle}>
              {SUBSYSTEM_EMOJI[sub.key] ?? "●"} {sub.label}
            </Text>
            <Text style={styles.detailStatus}>
              Status: {sub.status}
              {sub.latency_ms != null ? ` · ${sub.latency_ms}ms` : ""}
            </Text>
            {sub.placeholder ? (
              <Text style={styles.detailPlaceholder}>Probe placeholder — full integration in M7.4+</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </FounderShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xl },
  overallBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  overallEmoji: { fontSize: 28 },
  overallTitle: { ...typography.body, fontWeight: "700", color: colors.text, textTransform: "capitalize" },
  overallSub: { ...typography.caption, color: colors.textSecondary },
  detailCard: {
    padding: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  detailTitle: { ...typography.bodySmall, fontWeight: "700", color: colors.text },
  detailStatus: { ...typography.caption, color: colors.textSecondary, textTransform: "capitalize" },
  detailPlaceholder: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" },
});
