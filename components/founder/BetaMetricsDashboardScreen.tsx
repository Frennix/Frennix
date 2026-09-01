import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type {
  BetaMetricsDashboardSummary,
  BetaMetricsSurveyBreakdownRow,
  BetaMetricsWeekOverWeekMetric,
  HealthMetric,
} from "@frennix/types";
import { BETA_MOTIVATION_SURVEY_ANSWER_LABELS } from "@frennix/types";
import { FounderShell } from "@/components/founder/FounderShell";
import { FounderWidget } from "@/components/founder/FounderWidget";
import { HealthMetricGrid } from "@/components/founder/HealthMetricGrid";
import { useBetaMetricsDashboard } from "@/lib/founder/useBetaMetricsDashboard";
import { formatActivityTime } from "@/lib/founder/utils";
import { EmptyState, colors, spacing, typography } from "@frennix/ui";

function formatDelta(metric: BetaMetricsWeekOverWeekMetric, suffix = ""): string {
  if (metric.delta == null) return "—";
  const sign = metric.delta > 0 ? "+" : "";
  return `${sign}${metric.delta}${suffix}`;
}

function deltaColor(delta: number | null): string {
  if (delta == null || delta === 0) return colors.textMuted;
  return delta > 0 ? colors.accent : colors.warning;
}

function summaryToMetrics(summary: BetaMetricsDashboardSummary): HealthMetric[] {
  return [
    { key: "users", label: "Total Registered Users", emoji: "👥", value: summary.total_registered_users },
    { key: "new_week", label: "New Users This Week", emoji: "🆕", value: summary.new_users_this_week },
    { key: "wau", label: "Weekly Active Users", emoji: "📈", value: summary.weekly_active_users },
    {
      key: "multi_wau",
      label: "Active 2+ Days This Week",
      emoji: "🔁",
      value: summary.multi_day_active_users,
    },
    { key: "matches", label: "Total Matches", emoji: "🤝", value: summary.total_matches },
    { key: "users_matched", label: "Users Who Matched", emoji: "✓", value: summary.users_matched },
    {
      key: "match_rate",
      label: "Match Rate",
      emoji: "📊",
      value: summary.match_rate_pct,
      suffix: summary.match_rate_pct != null ? "%" : undefined,
    },
    {
      key: "messaged",
      label: "Users Who Messaged a Match",
      emoji: "💬",
      value: summary.users_messaged_match,
    },
    {
      key: "conv_rate",
      label: "Conversation Rate",
      emoji: "✉️",
      value: summary.conversation_rate_pct,
      suffix: summary.conversation_rate_pct != null ? "%" : undefined,
    },
    {
      key: "conversations",
      label: "Conversations Started",
      emoji: "🗨️",
      value: summary.conversations_started,
    },
    {
      key: "survey_count",
      label: "30-Day Survey Responses",
      emoji: "📝",
      value: summary.survey_response_count,
    },
    {
      key: "survey_pos",
      label: "Positive Survey Rate",
      emoji: "💪",
      value: summary.survey_positive_pct,
      suffix: summary.survey_positive_pct != null ? "%" : undefined,
    },
  ];
}

function WeekOverWeekRow({
  label,
  metric,
  suffix = "",
}: {
  label: string;
  metric: BetaMetricsWeekOverWeekMetric;
  suffix?: string;
}) {
  return (
    <View style={styles.wowRow}>
      <Text style={styles.wowLabel}>{label}</Text>
      <Text style={styles.wowValues}>
        {metric.current ?? "—"}
        {suffix} → prev {metric.previous ?? "—"}
        {suffix}
      </Text>
      <Text style={[styles.wowDelta, { color: deltaColor(metric.delta) }]}>
        {formatDelta(metric, suffix)}
      </Text>
    </View>
  );
}

function SurveyBreakdown({ rows }: { rows: BetaMetricsSurveyBreakdownRow[] }) {
  if (rows.length === 0) {
    return <Text style={styles.emptyHint}>No survey responses yet.</Text>;
  }

  return (
    <View style={styles.breakdownList}>
      {rows.map((row) => (
        <View key={row.answer} style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{BETA_MOTIVATION_SURVEY_ANSWER_LABELS[row.answer]}</Text>
          <Text style={styles.breakdownValue}>
            {row.count} ({row.pct}%)
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function BetaMetricsDashboardScreen() {
  const { data, isLoading, error, refetch, isFetching } = useBetaMetricsDashboard();

  const metrics = useMemo(
    () => (data?.summary ? summaryToMetrics(data.summary) : []),
    [data?.summary]
  );

  return (
    <FounderShell title="Beta Metrics">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.subtitle}>
              Traction metrics for grants, partnerships, and investors
            </Text>
            {data?.computed_at ? (
              <Text style={styles.meta}>Updated {formatActivityTime(data.computed_at)}</Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void refetch()}
            style={styles.refreshBtn}
          >
            <Text style={styles.refreshText}>{isFetching ? "Refreshing…" : "Refresh"}</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : error ? (
          <EmptyState
            title="Could not load beta metrics"
            description={error instanceof Error ? error.message : "Unknown error"}
          />
        ) : data ? (
          <>
            <FounderWidget title="Key Metrics" subtitle="All-time match funnel + rolling 7-day activity">
              <HealthMetricGrid metrics={metrics} />
            </FounderWidget>

            <FounderWidget title="Week over Week" subtitle="Current 7 days vs previous 7 days">
              <WeekOverWeekRow label="New users" metric={data.week_over_week.new_users} />
              <WeekOverWeekRow label="Weekly active users" metric={data.week_over_week.weekly_active_users} />
              <WeekOverWeekRow
                label="Multi-day active users"
                metric={data.week_over_week.multi_day_active_users}
              />
              <WeekOverWeekRow
                label="Match rate"
                metric={data.week_over_week.match_rate_pct}
                suffix="%"
              />
              <WeekOverWeekRow
                label="Conversation rate"
                metric={data.week_over_week.conversation_rate_pct}
                suffix="%"
              />
              <WeekOverWeekRow
                label="Positive survey rate"
                metric={data.week_over_week.survey_positive_pct}
                suffix="%"
              />
            </FounderWidget>

            <FounderWidget
              title="30-Day Motivation Survey"
              subtitle="“Has Frennix helped you feel more motivated or connected this month?”"
            >
              <SurveyBreakdown rows={data.survey_breakdown} />
            </FounderWidget>
          </>
        ) : null}
      </ScrollView>
    </FounderShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    maxWidth: 520,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 4,
  },
  refreshBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "600",
  },
  loader: { marginTop: spacing.xl },
  wowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  wowLabel: { ...typography.bodySmall, color: colors.text, flex: 1 },
  wowValues: { ...typography.caption, color: colors.textMuted },
  wowDelta: { ...typography.caption, fontWeight: "700", minWidth: 48, textAlign: "right" },
  breakdownList: { gap: spacing.sm },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  breakdownLabel: { ...typography.bodySmall, color: colors.text, flex: 1 },
  breakdownValue: { ...typography.bodySmall, color: colors.textSecondary, fontWeight: "600" },
  emptyHint: { ...typography.bodySmall, color: colors.textMuted, fontStyle: "italic" },
});
