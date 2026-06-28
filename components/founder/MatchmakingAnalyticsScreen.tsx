import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { HealthMetric, MatchmakingAnalyticsSummary, FounderDatePreset } from "@frennix/types";
import { FounderShell } from "@/components/founder/FounderShell";
import { FounderWidget } from "@/components/founder/FounderWidget";
import { HealthMetricGrid } from "@/components/founder/HealthMetricGrid";
import { FounderFilterBar } from "@/components/founder/FounderFilterBar";
import { useMatchmakingAnalytics } from "@/lib/founder/useMatchmakingAnalytics";
import { downloadTextFile, rowsToCsv } from "@/lib/founder/utils";
import { colors, spacing, typography } from "@frennix/ui";

function summaryToMetrics(summary: MatchmakingAnalyticsSummary): HealthMetric[] {
  return [
    { key: "matches_today", label: "Matches Today", emoji: "🤝", value: summary.matches_today },
    { key: "new_matches", label: "New Matches", emoji: "✨", value: summary.new_matches },
    { key: "connects", label: "Connects", emoji: "✅", value: summary.connects },
    { key: "skips", label: "Skips", emoji: "⏭️", value: summary.skips },
    {
      key: "mutual_conversion_rate",
      label: "Match Conversion",
      emoji: "📈",
      value: summary.mutual_conversion_rate,
      suffix: summary.mutual_conversion_rate != null ? "%" : undefined,
    },
    { key: "active_matchers", label: "Active Matchers", emoji: "👟", value: summary.active_matchers },
    { key: "discovery_enabled", label: "Discovery On", emoji: "🔍", value: summary.discovery_enabled },
    { key: "deck_loads", label: "Deck Loads", emoji: "📋", value: summary.deck_loads },
    { key: "deck_empty", label: "Empty Decks", emoji: "📭", value: summary.deck_empty },
    {
      key: "avg_deck_load_ms",
      label: "Avg Deck Load",
      emoji: "⚡",
      value: summary.avg_deck_load_ms != null ? Math.round(summary.avg_deck_load_ms) : null,
      suffix: summary.avg_deck_load_ms != null ? "ms" : undefined,
    },
    { key: "unmatched_total", label: "Unmatched Total", emoji: "🚫", value: summary.unmatched_total },
    {
      key: "feature_flag_enabled",
      label: "Discovery Flag",
      emoji: "⛿",
      value: summary.feature_flag_enabled ? "On" : "Off",
    },
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

export default function MatchmakingAnalyticsScreen() {
  const [preset, setPreset] = useState<FounderDatePreset>("month");
  const days = presetToDays(preset);
  const query = useMatchmakingAnalytics(days);

  const metrics = useMemo(
    () => (query.data?.summary ? summaryToMetrics(query.data.summary) : []),
    [query.data?.summary]
  );

  const computedAt = query.data?.computed_at ? new Date(query.data.computed_at) : null;

  return (
    <FounderShell title="Matchmaking Analytics">
      <ScrollView contentContainerStyle={styles.scroll}>
        <FounderWidget
          title="Training Partner Metrics"
          subtitle={`Last ${days} days · live data`}
          loading={query.isLoading && !query.data}
          error={query.isError ? "Could not load matchmaking analytics" : null}
          updatedAt={computedAt}
          onRefresh={() => void query.refetch()}
          exportEnabled
          onExport={(format) => {
            const rows = query.data?.series ?? [];
            if (format === "csv") {
              downloadTextFile("frennix-matchmaking-analytics.csv", rowsToCsv(rows), "text/csv");
            } else {
              downloadTextFile(
                "frennix-matchmaking-analytics.json",
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
          <FounderWidget title="Daily Trend" subtitle={`${query.data.series.length} days`}>
            <View style={styles.trendTable}>
              <View style={styles.trendHeader}>
                <Text style={[styles.trendCell, styles.trendHead]}>Date</Text>
                <Text style={[styles.trendCell, styles.trendHead]}>Match</Text>
                <Text style={[styles.trendCell, styles.trendHead]}>Connect</Text>
                <Text style={[styles.trendCell, styles.trendHead]}>Skip</Text>
                <Text style={[styles.trendCell, styles.trendHead]}>Matchers</Text>
              </View>
              {query.data.series.slice(-7).reverse().map((row) => (
                <View key={row.date} style={styles.trendRow}>
                  <Text style={styles.trendCell}>{row.date}</Text>
                  <Text style={styles.trendCell}>{row.matches}</Text>
                  <Text style={styles.trendCell}>{row.connects}</Text>
                  <Text style={styles.trendCell}>{row.skips}</Text>
                  <Text style={styles.trendCell}>{row.active_matchers}</Text>
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
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  trendTable: { gap: spacing.xs },
  trendHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.xs },
  trendRow: { flexDirection: "row", paddingVertical: spacing.xs },
  trendCell: { flex: 1, ...typography.caption, color: colors.textSecondary },
  trendHead: { fontWeight: "700", color: colors.textMuted },
});
