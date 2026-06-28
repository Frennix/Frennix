import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { CommunityHealthSummary, HealthMetric } from "@frennix/types";
import { FounderShell } from "@/components/founder/FounderShell";
import { FounderWidget } from "@/components/founder/FounderWidget";
import { HealthMetricGrid } from "@/components/founder/HealthMetricGrid";
import { FounderFilterBar } from "@/components/founder/FounderFilterBar";
import { useCommunityHealth } from "@/lib/founder/useCommunityHealth";
import { downloadTextFile, rowsToCsv } from "@/lib/founder/utils";
import { colors, spacing, typography } from "@frennix/ui";
import type { FounderDatePreset } from "@frennix/types";

function summaryToMetrics(summary: CommunityHealthSummary): HealthMetric[] {
  return [
    { key: "dau", label: "Daily Active Users", emoji: "📊", value: summary.dau },
    { key: "wau", label: "Weekly Active Users", emoji: "📈", value: summary.wau },
    { key: "mau", label: "Monthly Active Users", emoji: "📅", value: summary.mau },
    { key: "new_signups", label: "New Signups", emoji: "✨", value: summary.new_signups },
    { key: "retention_d1", label: "D1 Retention", emoji: "🔄", value: summary.retention_d1, suffix: "%" },
    { key: "retention_d7", label: "D7 Retention", emoji: "🔄", value: summary.retention_d7, suffix: "%" },
    { key: "retention_d30", label: "D30 Retention", emoji: "🔄", value: summary.retention_d30, suffix: "%" },
    { key: "workout_posts", label: "Workout Posts", emoji: "🏋️", value: summary.workout_posts },
    { key: "stories", label: "Stories", emoji: "📸", value: summary.stories },
    { key: "messages", label: "Messages", emoji: "💬", value: summary.messages },
    { key: "events", label: "Events", emoji: "📅", value: summary.events },
    { key: "challenges", label: "Active Challenges", emoji: "🏆", value: summary.challenges },
    { key: "matches", label: "Matches", emoji: "🤝", value: summary.matches },
    { key: "comments", label: "Comments", emoji: "💬", value: summary.comments },
    { key: "reactions", label: "Reactions", emoji: "❤️", value: summary.reactions },
    { key: "referral_growth", label: "Referral Growth", emoji: "📈", value: summary.referral_growth },
    { key: "ambassador_activity", label: "Ambassador Activity", emoji: "★", value: summary.ambassador_activity },
  ];
}

function presetToDays(preset: FounderDatePreset): number {
  switch (preset) {
    case "15m":
    case "today":
      return 7;
    case "week":
      return 14;
    case "month":
      return 30;
    default:
      return 30;
  }
}

export default function CommunityHealthScreen() {
  const [preset, setPreset] = useState<FounderDatePreset>("month");
  const days = presetToDays(preset);
  const query = useCommunityHealth(days);

  const metrics = useMemo(
    () => (query.data?.summary ? summaryToMetrics(query.data.summary) : []),
    [query.data?.summary]
  );

  const computedAt = query.data?.computed_at ? new Date(query.data.computed_at) : null;

  return (
    <FounderShell title="Community Health">
      <ScrollView contentContainerStyle={styles.scroll}>
        <FounderWidget
          title="Community Metrics"
          subtitle={`Last ${days} days · live + daily snapshots`}
          loading={query.isLoading && !query.data}
          error={query.isError ? "Could not load community health" : null}
          updatedAt={computedAt}
          onRefresh={() => void query.refetch()}
          exportEnabled
          onExport={(format) => {
            const rows = query.data?.series ?? [];
            if (format === "csv") {
              downloadTextFile("frennix-community-health.csv", rowsToCsv(rows), "text/csv");
            } else {
              downloadTextFile(
                "frennix-community-health.json",
                JSON.stringify(query.data, null, 2),
                "application/json"
              );
            }
          }}
          filterSlot={
            <FounderFilterBar
              datePreset={preset}
              onDatePresetChange={setPreset}
              search=""
              onSearchChange={() => undefined}
              showSearch={false}
            />
          }
        >
          {metrics.length > 0 ? <HealthMetricGrid metrics={metrics} /> : null}
        </FounderWidget>

        {query.data?.series && query.data.series.length > 0 ? (
          <FounderWidget title="Trend" subtitle={`${query.data.series.length} daily snapshots`}>
            <View style={styles.trendTable}>
              <View style={styles.trendHeader}>
                <Text style={[styles.trendCell, styles.trendHead]}>Date</Text>
                <Text style={[styles.trendCell, styles.trendHead]}>DAU</Text>
                <Text style={[styles.trendCell, styles.trendHead]}>Msgs</Text>
                <Text style={[styles.trendCell, styles.trendHead]}>Signups</Text>
              </View>
              {query.data.series.slice(-7).reverse().map((row) => (
                <View key={row.date} style={styles.trendRow}>
                  <Text style={styles.trendCell}>{row.date}</Text>
                  <Text style={styles.trendCell}>{row.dau ?? 0}</Text>
                  <Text style={styles.trendCell}>{row.messages ?? 0}</Text>
                  <Text style={styles.trendCell}>{row.new_signups ?? 0}</Text>
                </View>
              ))}
            </View>
          </FounderWidget>
        ) : null}
      </ScrollView>
    </FounderShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xl },
  trendTable: { gap: spacing.xs },
  trendHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.xs },
  trendRow: { flexDirection: "row", paddingVertical: 4 },
  trendCell: { flex: 1, ...typography.caption, color: colors.textSecondary },
  trendHead: { fontWeight: "700", color: colors.text },
});
