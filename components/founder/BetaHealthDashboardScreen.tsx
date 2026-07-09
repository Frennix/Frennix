import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type {
  BetaHealthCriticalIssue,
  BetaHealthDashboardSummary,
  FounderDatePreset,
  HealthMetric,
} from "@frennix/types";
import { BETA_HEALTH_DATE_PRESETS } from "@frennix/types";
import { FounderShell } from "@/components/founder/FounderShell";
import { FounderWidget } from "@/components/founder/FounderWidget";
import { HealthMetricGrid } from "@/components/founder/HealthMetricGrid";
import { useBetaHealthDashboard } from "@/lib/founder/useBetaHealthDashboard";
import { useStaffCapability } from "@/lib/founder/useStaffAccess";
import { downloadTextFile, formatActivityTime, rowsToCsv } from "@/lib/founder/utils";
import { EmptyState, colors, spacing, typography } from "@frennix/ui";

function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "#EF4444";
    case "high":
      return colors.warning;
    default:
      return colors.textSecondary;
  }
}

function summaryToMetrics(summary: BetaHealthDashboardSummary): HealthMetric[] {
  return [
    { key: "users", label: "Total Beta Users", emoji: "👥", value: summary.total_beta_users },
    { key: "dau", label: "Daily Active Users", emoji: "📊", value: summary.daily_active_users },
    { key: "wau", label: "Weekly Active Users", emoji: "📈", value: summary.weekly_active_users },
    { key: "signups", label: "New Signups Today", emoji: "🆕", value: summary.new_signups_today },
    {
      key: "login_rate",
      label: "Login Success Rate",
      emoji: "🔐",
      value: summary.login_success_rate,
      suffix: summary.login_success_rate != null ? "%" : undefined,
    },
    { key: "login_fail", label: "Failed Logins", emoji: "⛔", value: summary.failed_login_count },
    { key: "black_screen", label: "Black Screen Events", emoji: "⬛", value: summary.black_screen_occurrences },
    { key: "startup_fail", label: "Startup Failures", emoji: "🚫", value: summary.startup_failures },
    { key: "js_errors", label: "JS / Runtime Errors", emoji: "⚠️", value: summary.javascript_runtime_errors },
    { key: "api_fail", label: "API Failures", emoji: "🔌", value: summary.api_failures },
    {
      key: "feed_load",
      label: "Avg Feed Load",
      emoji: "📰",
      value: summary.avg_feed_load_ms,
      suffix: summary.avg_feed_load_ms != null ? "ms" : undefined,
    },
    {
      key: "startup_ms",
      label: "Avg App Startup",
      emoji: "🚀",
      value: summary.avg_app_startup_ms,
      suffix: summary.avg_app_startup_ms != null ? "ms" : undefined,
    },
    {
      key: "push_reg",
      label: "Push Registration Rate",
      emoji: "🔔",
      value: summary.push_registration_success_rate,
      suffix: summary.push_registration_success_rate != null ? "%" : undefined,
    },
    {
      key: "push_deliver",
      label: "Push Delivery Rate",
      emoji: "📬",
      value: summary.push_delivery_success_rate,
      suffix: summary.push_delivery_success_rate != null ? "%" : undefined,
    },
    { key: "push_subs", label: "Active Push Subs", emoji: "📲", value: summary.active_push_subscriptions },
    { key: "msg_fail", label: "Message Failures", emoji: "💬", value: summary.message_delivery_failures },
    { key: "story_fail", label: "Story Upload Failures", emoji: "📸", value: summary.story_upload_failures },
    { key: "photo_fail", label: "Photo Upload Failures", emoji: "🖼️", value: summary.photo_upload_failures },
    { key: "video_fail", label: "Video Upload Failures", emoji: "🎬", value: summary.video_upload_failures },
    { key: "event_fail", label: "Event Creation Failures", emoji: "📅", value: summary.event_creation_failures },
    { key: "comment_fail", label: "Comment Failures", emoji: "💭", value: summary.comment_failures },
    {
      key: "session",
      label: "Avg Session Duration",
      emoji: "⏱️",
      value:
        summary.avg_session_duration_ms != null
          ? Math.round(summary.avg_session_duration_ms / 1000)
          : null,
      suffix: summary.avg_session_duration_ms != null ? "s" : undefined,
    },
    {
      key: "crash_free",
      label: "Crash-Free Sessions",
      emoji: "✅",
      value: summary.crash_free_session_pct,
      suffix: summary.crash_free_session_pct != null ? "%" : undefined,
    },
  ];
}

function BetaHealthFilterBar({
  preset,
  onPresetChange,
}: {
  preset: FounderDatePreset;
  onPresetChange: (preset: FounderDatePreset) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
      {BETA_HEALTH_DATE_PRESETS.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          onPress={() => onPresetChange(item.key)}
          style={[styles.filterChip, preset === item.key && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, preset === item.key && styles.filterChipTextActive]}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function CriticalIssueCard({ issue }: { issue: BetaHealthCriticalIssue }) {
  return (
    <View style={[styles.criticalCard, { borderLeftColor: severityColor(issue.severity) }]}>
      <Text style={styles.criticalTitle}>{issue.title}</Text>
      <Text style={styles.criticalMessage}>{issue.message}</Text>
      <Text style={styles.criticalMeta}>
        {issue.severity.toUpperCase()} · threshold {issue.threshold}
      </Text>
    </View>
  );
}

export default function BetaHealthDashboardScreen() {
  const [preset, setPreset] = useState<FounderDatePreset>("week");
  const analyticsAccess = useStaffCapability("capability_view_analytics");
  const executiveAccess = useStaffCapability("capability_view_executive");
  const adminAccess = useStaffCapability("capability_manage_staff");

  const canView =
    analyticsAccess.allowed || executiveAccess.allowed || adminAccess.allowed;
  const accessLoading =
    analyticsAccess.isLoading || executiveAccess.isLoading || adminAccess.isLoading;

  const query = useBetaHealthDashboard(preset);

  const metrics = useMemo(
    () => (query.data?.summary ? summaryToMetrics(query.data.summary) : []),
    [query.data?.summary]
  );

  const computedAt = query.data?.computed_at ? new Date(query.data.computed_at) : null;

  if (accessLoading) {
    return (
      <FounderShell title="Beta Health">
        <EmptyState title="Checking access…" description="Verifying administrator permissions." />
      </FounderShell>
    );
  }

  if (!canView) {
    return (
      <FounderShell title="Beta Health">
        <EmptyState
          title="Administrator access required"
          description="Beta Health is restricted to administrators and analytics roles."
        />
      </FounderShell>
    );
  }

  return (
    <FounderShell title="Beta Health">
      <ScrollView contentContainerStyle={styles.scroll}>
        <FounderWidget
          title="Beta Health Dashboard"
          subtitle="Real-time beta monitoring — users, performance, errors, push"
          loading={query.isLoading && !query.data}
          error={query.isError ? "Could not load beta health metrics" : null}
          updatedAt={computedAt}
          onRefresh={() => void query.refetch()}
          exportEnabled
          onExport={(format) => {
            if (!query.data) return;
            if (format === "csv") {
              const rows = [
                ...metrics.map((m) => ({
                  section: "summary",
                  key: m.key,
                  label: m.label,
                  value: m.value ?? "",
                })),
                ...(query.data.performance_trends ?? []).map((t) => ({
                  section: "performance_trend",
                  day: t.day,
                  feed_load_ms: t.feed_load_ms ?? "",
                  startup_ms: t.startup_ms ?? "",
                  api_failures: t.api_failures,
                  error_events: t.error_events,
                })),
                ...(query.data.recent_errors ?? []).map((e) => ({
                  section: "recent_error",
                  source: e.source,
                  message: e.message,
                  severity: e.severity,
                  platform: e.platform ?? "",
                  created_at: e.created_at,
                })),
              ];
              downloadTextFile("frennix-beta-health.csv", rowsToCsv(rows), "text/csv");
            } else {
              downloadTextFile(
                "frennix-beta-health.json",
                JSON.stringify(query.data, null, 2),
                "application/json"
              );
            }
          }}
          filterSlot={<BetaHealthFilterBar preset={preset} onPresetChange={setPreset} />}
        >
          {metrics.length > 0 ? <HealthMetricGrid metrics={metrics} /> : null}
        </FounderWidget>

        <FounderWidget
          title="Critical Issues"
          subtitle="Auto-detected problems requiring immediate attention"
        >
          {(query.data?.critical_issues ?? []).length === 0 ? (
            <Text style={styles.okText}>No critical issues detected for this period.</Text>
          ) : (
            (query.data?.critical_issues ?? []).map((issue) => (
              <CriticalIssueCard key={issue.key} issue={issue} />
            ))
          )}
        </FounderWidget>

        <FounderWidget title="Recent Errors" subtitle="Latest crashes and runtime failures">
          {(query.data?.recent_errors ?? []).length === 0 ? (
            <Text style={styles.muted}>No errors recorded in this period.</Text>
          ) : (
            (query.data?.recent_errors ?? []).slice(0, 20).map((error) => (
              <View key={`${error.id}-${error.created_at}`} style={styles.errorRow}>
                <View style={styles.errorHeader}>
                  <Text style={styles.errorSource}>{error.source}</Text>
                  <Text style={styles.errorTime}>{formatActivityTime(error.created_at)}</Text>
                </View>
                <Text style={styles.errorMessage} numberOfLines={3}>
                  {error.message}
                </Text>
                <Text style={styles.errorMeta}>
                  {error.severity}
                  {error.platform ? ` · ${error.platform}` : ""}
                </Text>
              </View>
            ))
          )}
        </FounderWidget>

        <FounderWidget title="Performance Trends" subtitle="Daily feed load, startup, and error volume">
          {(query.data?.performance_trends ?? []).length === 0 ? (
            <Text style={styles.muted}>No performance data for this period yet.</Text>
          ) : (
            (query.data?.performance_trends ?? []).map((day) => (
              <View key={day.day} style={styles.trendRow}>
                <Text style={styles.trendDay}>{day.day}</Text>
                <Text style={styles.trendValue}>
                  Feed {day.feed_load_ms ?? "—"}ms · Startup {day.startup_ms ?? "—"}ms
                </Text>
                <Text style={styles.trendMeta}>
                  API fails {day.api_failures} · Errors {day.error_events}
                </Text>
              </View>
            ))
          )}
        </FounderWidget>

        {(query.data?.top_bugs ?? []).length > 0 ? (
          <FounderWidget title="Top Reported Bugs" subtitle="Grouped bug reports">
            {(query.data?.top_bugs ?? []).map((bug) => (
              <View key={`${bug.bug_area}-${bug.bug_summary}`} style={styles.listRow}>
                <Text style={styles.listLabel} numberOfLines={2}>
                  {bug.bug_area.replace(/_/g, " ")} — {bug.bug_summary}
                </Text>
                <Text style={styles.listValue}>{bug.report_count}</Text>
              </View>
            ))}
          </FounderWidget>
        ) : null}

        <FounderWidget title="Device & Environment" subtitle="Platforms, iOS versions, browsers">
          <Text style={styles.subSection}>Device types</Text>
          {(query.data?.device_breakdown ?? []).map((item) => (
            <View key={item.platform} style={styles.listRow}>
              <Text style={styles.listLabel}>{item.platform}</Text>
              <Text style={styles.listValue}>{item.count}</Text>
            </View>
          ))}
          <Text style={styles.subSection}>iOS versions</Text>
          {(query.data?.ios_versions ?? []).length === 0 ? (
            <Text style={styles.muted}>No iOS version data yet.</Text>
          ) : (
            (query.data?.ios_versions ?? []).map((item) => (
              <View key={item.version} style={styles.listRow}>
                <Text style={styles.listLabel}>{item.version}</Text>
                <Text style={styles.listValue}>{item.count}</Text>
              </View>
            ))
          )}
          <Text style={styles.subSection}>Browser versions</Text>
          {(query.data?.browser_versions ?? []).length === 0 ? (
            <Text style={styles.muted}>No browser data yet.</Text>
          ) : (
            (query.data?.browser_versions ?? []).map((item) => (
              <View key={item.browser} style={styles.listRow}>
                <Text style={styles.listLabel} numberOfLines={1}>
                  {item.browser}
                </Text>
                <Text style={styles.listValue}>{item.count}</Text>
              </View>
            ))
          )}
        </FounderWidget>

        {(query.data?.new_signups_by_day ?? []).length > 0 ? (
          <FounderWidget title="New Signups" subtitle="Daily registration volume">
            {(query.data?.new_signups_by_day ?? []).map((day) => (
              <View key={day.day} style={styles.listRow}>
                <Text style={styles.listLabel}>{day.day}</Text>
                <Text style={styles.listValue}>{day.count}</Text>
              </View>
            ))}
          </FounderWidget>
        ) : null}
      </ScrollView>
    </FounderShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  filterRow: { flexDirection: "row", gap: spacing.xs, paddingVertical: 2 },
  filterChip: {
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    justifyContent: "center",
  },
  filterChipActive: { borderColor: colors.accent, backgroundColor: colors.surface },
  filterChipText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  filterChipTextActive: { color: colors.accent },
  criticalCard: {
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    gap: 4,
  },
  criticalTitle: { ...typography.body, fontWeight: "700", color: colors.text },
  criticalMessage: { ...typography.bodySmall, color: colors.textSecondary },
  criticalMeta: { ...typography.caption, color: colors.textMuted },
  okText: { ...typography.bodySmall, color: colors.accent },
  muted: { ...typography.bodySmall, color: colors.textMuted },
  errorRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 4,
  },
  errorHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  errorSource: { ...typography.caption, fontWeight: "700", color: colors.accent },
  errorTime: { ...typography.caption, color: colors.textMuted },
  errorMessage: { ...typography.bodySmall, color: colors.text },
  errorMeta: { ...typography.caption, color: colors.textMuted, textTransform: "capitalize" },
  trendRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 2,
  },
  trendDay: { ...typography.caption, fontWeight: "700", color: colors.text },
  trendValue: { ...typography.bodySmall, color: colors.text },
  trendMeta: { ...typography.caption, color: colors.textMuted },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listLabel: { flex: 1, ...typography.bodySmall, color: colors.text },
  listValue: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  subSection: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "700",
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
});
