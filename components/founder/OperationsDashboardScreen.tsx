import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  clearResolvedOperationsAlerts,
  listBetaFeedback,
  resolveOperationsAlert,
} from "@frennix/api";
import type {
  BetaHealthDashboardSummary,
  FounderDatePreset,
  HealthMetric,
  OperationsErrorRecord,
  OperationsTrendWindow,
} from "@frennix/types";
import { BETA_HEALTH_DATE_PRESETS } from "@frennix/types";
import { FounderShell } from "@/components/founder/FounderShell";
import { FounderWidget } from "@/components/founder/FounderWidget";
import { HealthMetricGrid } from "@/components/founder/HealthMetricGrid";
import { TrendSparkline } from "@/components/founder/TrendSparkline";
import { useOperationsDashboard } from "@/lib/founder/useOperationsDashboard";
import { useStaffCapability } from "@/lib/founder/useStaffAccess";
import { downloadTextFile, formatActivityTime, rowsToCsv } from "@/lib/founder/utils";
import { showAlert, showSuccess } from "@/lib/alerts";
import { EmptyState, colors, spacing, typography } from "@frennix/ui";
import { useQuery } from "@tanstack/react-query";

const TREND_WINDOWS: Array<{ key: OperationsTrendWindow; label: string }> = [
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
];

const FEEDBACK_SORTS = ["priority", "date", "device", "status"] as const;
type FeedbackSort = (typeof FEEDBACK_SORTS)[number];

function healthColor(level: string): string {
  switch (level) {
    case "green":
    case "healthy":
      return colors.accent;
    case "yellow":
    case "degraded":
      return colors.warning;
    case "red":
    case "down":
      return colors.danger;
    default:
      return colors.textMuted;
  }
}

function summaryToMetrics(summary: BetaHealthDashboardSummary): HealthMetric[] {
  return [
    { key: "users", label: "Total Beta Users", emoji: "👥", value: summary.total_beta_users },
    { key: "dau", label: "Daily Active Users", emoji: "📊", value: summary.daily_active_users },
    { key: "wau", label: "Weekly Active Users", emoji: "📈", value: summary.weekly_active_users },
    { key: "login_rate", label: "Login Success Rate", emoji: "🔐", value: summary.login_success_rate, suffix: summary.login_success_rate != null ? "%" : undefined },
    { key: "crash_free", label: "Crash-Free Sessions", emoji: "✅", value: summary.crash_free_session_pct, suffix: summary.crash_free_session_pct != null ? "%" : undefined },
    { key: "feed", label: "Avg Feed Load", emoji: "📰", value: summary.avg_feed_load_ms, suffix: summary.avg_feed_load_ms != null ? "ms" : undefined },
    { key: "startup", label: "Avg Startup", emoji: "🚀", value: summary.avg_app_startup_ms, suffix: summary.avg_app_startup_ms != null ? "ms" : undefined },
    { key: "push_reg", label: "Push Registration", emoji: "🔔", value: summary.push_registration_success_rate, suffix: summary.push_registration_success_rate != null ? "%" : undefined },
    { key: "push_del", label: "Push Delivery", emoji: "📬", value: summary.push_delivery_success_rate, suffix: summary.push_delivery_success_rate != null ? "%" : undefined },
    { key: "errors", label: "JS Runtime Errors", emoji: "⚠️", value: summary.javascript_runtime_errors },
    { key: "api", label: "API Failures", emoji: "🔌", value: summary.api_failures },
    { key: "black", label: "Black Screens", emoji: "⬛", value: summary.black_screen_occurrences },
  ];
}

function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {options.map((opt) => (
        <Pressable
          key={opt.key}
          onPress={() => onChange(opt.key)}
          style={[styles.chip, value === opt.key && styles.chipActive]}
        >
          <Text style={[styles.chipText, value === opt.key && styles.chipTextActive]}>{opt.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ErrorRow({ error }: { error: OperationsErrorRecord }) {
  return (
    <View style={styles.errorCard}>
      <View style={styles.errorHeader}>
        <Text style={styles.errorCategory}>{error.category.replace(/_/g, " ")}</Text>
        <Text style={[styles.errorStatus, error.status === "resolved" && styles.errorResolved]}>
          {error.status}
        </Text>
      </View>
      <Text style={styles.errorMessage} numberOfLines={2}>{error.message}</Text>
      <Text style={styles.errorMeta}>
        {formatActivityTime(error.occurred_at)}
        {error.device ? ` · ${error.device}` : ""}
        {error.ios_version ? ` · iOS ${error.ios_version}` : ""}
        {error.app_version ? ` · v${error.app_version}` : ""}
      </Text>
      {error.user_id ? <Text style={styles.errorMeta}>User: {error.user_id.slice(0, 8)}…</Text> : null}
      {error.browser ? <Text style={styles.errorMeta} numberOfLines={1}>Browser: {error.browser}</Text> : null}
      {error.stack_trace ? (
        <Text style={styles.stackTrace} numberOfLines={4}>{error.stack_trace}</Text>
      ) : null}
      <Text style={styles.errorMeta}>Retries: {error.retry_count}</Text>
    </View>
  );
}

export default function OperationsDashboardScreen() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<FounderDatePreset>("today");
  const [trendWindow, setTrendWindow] = useState<OperationsTrendWindow>("7d");
  const [feedbackSort, setFeedbackSort] = useState<FeedbackSort>("priority");

  const analyticsAccess = useStaffCapability("capability_view_analytics");
  const executiveAccess = useStaffCapability("capability_view_executive");
  const adminAccess = useStaffCapability("capability_manage_staff");
  const canView = analyticsAccess.allowed || executiveAccess.allowed || adminAccess.allowed;

  const query = useOperationsDashboard(trendWindow, preset);
  const data = query.data;

  const feedbackList = useQuery({
    queryKey: ["operations-feedback", preset, feedbackSort],
    queryFn: () =>
      listBetaFeedback({
        page: 1,
        pageSize: 25,
        priority: feedbackSort === "priority" ? "critical" : null,
        platform: feedbackSort === "device" ? null : null,
        status: feedbackSort === "status" ? "new" : null,
      }),
    enabled: canView,
    staleTime: 30_000,
  });

  const resolveAlertMutation = useMutation({
    mutationFn: resolveOperationsAlert,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["founder-operations-dashboard"] });
      showSuccess("Alert resolved");
    },
    onError: (e) => showAlert("Failed", e instanceof Error ? e.message : "Could not resolve alert"),
  });

  const clearAlertsMutation = useMutation({
    mutationFn: clearResolvedOperationsAlerts,
    onSuccess: (count) => {
      void queryClient.invalidateQueries({ queryKey: ["founder-operations-dashboard"] });
      showSuccess(`Cleared ${count} resolved alert(s)`);
    },
    onError: (e) => showAlert("Failed", e instanceof Error ? e.message : "Could not clear alerts"),
  });

  const betaMetrics = useMemo(
    () => (data?.beta_health?.summary ? summaryToMetrics(data.beta_health.summary) : []),
    [data?.beta_health?.summary]
  );

  const liveMetrics: HealthMetric[] = useMemo(() => {
    if (!data?.live_activity) return [];
    const a = data.live_activity;
    return [
      { key: "online", label: "Users Online", emoji: "🟢", value: a.users_online },
      { key: "new", label: "New Users Today", emoji: "🆕", value: a.new_users_today },
      { key: "logins", label: "Logins Today", emoji: "🔑", value: a.logins_today },
      { key: "posts", label: "Posts Today", emoji: "📝", value: a.posts_today },
      { key: "stories", label: "Stories Today", emoji: "📸", value: a.stories_today },
      { key: "msgs", label: "Messages Today", emoji: "💬", value: a.messages_today },
      { key: "events", label: "Events Today", emoji: "📅", value: a.events_today },
      { key: "matches", label: "Matches Today", emoji: "🤝", value: a.matches_today },
      { key: "push", label: "Push Sent Today", emoji: "🔔", value: a.push_notifications_sent_today },
    ];
  }, [data?.live_activity]);

  const trendPoints = data?.performance?.trends?.[trendWindow] ?? [];

  if (!canView && !analyticsAccess.isLoading) {
    return (
      <FounderShell title="Operations">
        <EmptyState title="Administrator access required" description="Operations dashboard is restricted to administrators." />
      </FounderShell>
    );
  }

  const computedAt = data?.computed_at ? new Date(data.computed_at) : null;

  const exportPayload = () => data ?? {};

  return (
    <FounderShell title="Operations">
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Admin Controls */}
        <View style={styles.adminBar}>
          <Pressable style={styles.adminBtn} onPress={() => void query.refetch()}>
            <Text style={styles.adminBtnText}>↻ Refresh</Text>
          </Pressable>
          <Pressable
            style={styles.adminBtn}
            onPress={() => downloadTextFile("frennix-operations.csv", rowsToCsv([
              ...betaMetrics.map((m) => ({ section: "beta_health", key: m.key, label: m.label, value: m.value ?? "" })),
              ...(data?.errors ?? []).map((e) => ({
                section: "error", category: e.category, message: e.message, status: e.status, occurred_at: e.occurred_at,
              })),
            ]), "text/csv")}
          >
            <Text style={styles.adminBtnText}>CSV</Text>
          </Pressable>
          <Pressable
            style={styles.adminBtn}
            onPress={() => downloadTextFile("frennix-operations.json", JSON.stringify(exportPayload(), null, 2), "application/json")}
          >
            <Text style={styles.adminBtnText}>JSON</Text>
          </Pressable>
          <Pressable
            style={styles.adminBtn}
            onPress={() => downloadTextFile("frennix-error-logs.json", JSON.stringify(data?.errors ?? [], null, 2), "application/json")}
          >
            <Text style={styles.adminBtnText}>Error Logs</Text>
          </Pressable>
          <Pressable style={styles.adminBtn} onPress={() => clearAlertsMutation.mutate()}>
            <Text style={styles.adminBtnText}>Clear Resolved</Text>
          </Pressable>
        </View>

        <View style={[styles.overallBanner, { borderColor: healthColor(data?.overall_system_health ?? "green") }]}>
          <Text style={styles.overallEmoji}>
            {data?.overall_system_health === "red" ? "🔴" : data?.overall_system_health === "yellow" ? "🟡" : "🟢"}
          </Text>
          <View>
            <Text style={styles.overallTitle}>
              System Health: {(data?.overall_system_health ?? "green").toUpperCase()}
            </Text>
            <Text style={styles.overallSub}>Auto-refreshes every 30 seconds</Text>
          </View>
        </View>

        <FounderWidget
          title="Frennix Operations"
          subtitle="Permanent founder monitoring — beta health, systems, errors, performance"
          loading={query.isLoading && !data}
          error={query.isError ? "Could not load operations dashboard" : null}
          updatedAt={computedAt}
          onRefresh={() => void query.refetch()}
          filterSlot={
            <View style={styles.filterWrap}>
              <FilterChips options={BETA_HEALTH_DATE_PRESETS} value={preset} onChange={setPreset} />
              <FilterChips options={TREND_WINDOWS} value={trendWindow} onChange={setTrendWindow} />
            </View>
          }
        >
          {betaMetrics.length > 0 ? <HealthMetricGrid metrics={betaMetrics} /> : null}
        </FounderWidget>

        {/* Live System Status */}
        <FounderWidget title="Live System Status" subtitle="Infrastructure and service health">
          {(data?.system_status?.subsystems ?? []).map((sub) => (
            <View key={sub.key} style={styles.statusRow}>
              <Text style={[styles.statusDot, { color: healthColor(sub.status) }]}>●</Text>
              <Text style={styles.statusLabel}>{sub.label}</Text>
              <Text style={styles.statusValue}>{sub.status}</Text>
              {sub.latency_ms != null ? <Text style={styles.statusMeta}>{sub.latency_ms}ms</Text> : null}
            </View>
          ))}
        </FounderWidget>

        {/* Live User Activity */}
        <FounderWidget title="Live User Activity" subtitle="Real-time platform activity today">
          {liveMetrics.length > 0 ? <HealthMetricGrid metrics={liveMetrics} /> : null}
        </FounderWidget>

        {/* Alerts */}
        <FounderWidget title="Alerts" subtitle="Threshold-based administrator notifications">
          {(data?.alerts ?? []).filter((a) => a.status === "active").length === 0 ? (
            <Text style={styles.okText}>No active alerts.</Text>
          ) : (
            (data?.alerts ?? []).filter((a) => a.status === "active").map((alert) => (
              <View key={alert.id} style={styles.alertCard}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertMessage}>{alert.message}</Text>
                <View style={styles.alertActions}>
                  <Text style={styles.alertMeta}>{alert.severity} · {formatActivityTime(alert.triggered_at)}</Text>
                  <Pressable onPress={() => resolveAlertMutation.mutate(alert.id)}>
                    <Text style={styles.resolveBtn}>Resolve</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </FounderWidget>

        {/* Performance */}
        <FounderWidget title="Performance" subtitle="Averages and trend charts">
          <View style={styles.perfGrid}>
            {data?.performance?.averages ? (
              <>
                <Text style={styles.perfItem}>Startup: {data.performance.averages.app_startup_ms ?? "—"} ms</Text>
                <Text style={styles.perfItem}>Feed: {data.performance.averages.feed_load_ms ?? "—"} ms</Text>
                <Text style={styles.perfItem}>Profile: {data.performance.averages.profile_load_ms ?? "—"} ms</Text>
                <Text style={styles.perfItem}>Messages: {data.performance.averages.message_load_ms ?? "—"} ms</Text>
                <Text style={styles.perfItem}>Stories: {data.performance.averages.story_load_ms ?? "—"} ms</Text>
                <Text style={styles.perfItem}>Images: {data.performance.averages.image_load_ms ?? "—"} ms</Text>
                <Text style={styles.perfItem}>API: {data.performance.averages.api_response_ms ?? "—"} ms</Text>
                <Text style={styles.perfItem}>Database: {data.performance.averages.database_query_ms ?? "—"} ms</Text>
              </>
            ) : null}
          </View>
          <TrendSparkline
            label="Feed load trend"
            data={trendPoints.map((p) => ({ value: p.feed_load_ms, label: p.day ?? p.bucket }))}
          />
          <TrendSparkline
            label="Startup trend"
            data={trendPoints.map((p) => ({ value: p.startup_ms, label: p.day ?? p.bucket }))}
            color={colors.warning}
          />
          <TrendSparkline
            label="Error volume"
            data={trendPoints.map((p) => ({ value: p.errors, label: p.day ?? p.bucket }))}
            suffix=""
            color={colors.danger}
          />
        </FounderWidget>

        {/* Push Notifications */}
        <FounderWidget title="Push Notifications" subtitle="Registration and delivery metrics">
          {data?.push ? (
            <HealthMetricGrid
              metrics={[
                { key: "subs", label: "Active Subscriptions", emoji: "📲", value: data.push.active_subscriptions },
                { key: "pending", label: "Pending Permission", emoji: "⏳", value: data.push.pending_permission_requests },
                { key: "denied", label: "Permission Denied", emoji: "🚫", value: data.push.permission_denied_count },
                { key: "reg_ok", label: "Registrations OK", emoji: "✅", value: data.push.successful_registrations },
                { key: "reg_fail", label: "Registrations Failed", emoji: "❌", value: data.push.failed_registrations },
                { key: "delivered", label: "Delivered", emoji: "📬", value: data.push.notifications_delivered },
                { key: "failed", label: "Failed", emoji: "⚠️", value: data.push.notifications_failed },
                { key: "pct", label: "Delivery %", emoji: "📊", value: data.push.delivery_percentage, suffix: data.push.delivery_percentage != null ? "%" : undefined },
              ]}
            />
          ) : null}
        </FounderWidget>

        {/* Error Center */}
        <FounderWidget title="Error Center" subtitle="Login, black screen, feed, push, upload, API, database errors">
          {(data?.errors ?? []).length === 0 ? (
            <Text style={styles.muted}>No errors in this period.</Text>
          ) : (
            (data?.errors ?? []).slice(0, 30).map((error) => (
              <ErrorRow key={`${error.id}-${error.occurred_at}`} error={error} />
            ))
          )}
        </FounderWidget>

        {/* Beta Feedback */}
        <FounderWidget title="Beta Feedback" subtitle="Bug reports, features, critical issues">
          {data?.beta_feedback ? (
            <HealthMetricGrid
              metrics={[
                { key: "bugs", label: "Open Bug Reports", emoji: "🐛", value: data.beta_feedback.new_bug_reports },
                { key: "features", label: "Feature Requests", emoji: "💡", value: data.beta_feedback.feature_requests },
                { key: "general", label: "General Feedback", emoji: "💬", value: data.beta_feedback.general_feedback },
                { key: "critical", label: "Critical Issues", emoji: "🚨", value: data.beta_feedback.critical_issues },
              ]}
            />
          ) : null}
          <FilterChips
            options={FEEDBACK_SORTS.map((s) => ({ key: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
            value={feedbackSort}
            onChange={setFeedbackSort}
          />
          {(feedbackList.data?.items ?? []).map((item) => (
            <View key={item.id} style={styles.feedbackRow}>
              <Text style={styles.feedbackType}>{item.type} · {item.priority ?? "medium"}</Text>
              <Text style={styles.feedbackMsg} numberOfLines={2}>{item.message ?? "(no message)"}</Text>
              <Text style={styles.feedbackMeta}>
                {item.status} · {formatActivityTime(item.created_at)}
                {item.platform ? ` · ${item.platform}` : ""}
              </Text>
            </View>
          ))}
        </FounderWidget>

        {/* Device breakdown from beta health */}
        {(data?.beta_health?.device_breakdown ?? []).length > 0 ? (
          <FounderWidget title="Devices & Environments" subtitle="From beta telemetry">
            {(data?.beta_health?.device_breakdown ?? []).map((d) => (
              <View key={d.platform} style={styles.listRow}>
                <Text style={styles.listLabel}>{d.platform}</Text>
                <Text style={styles.listValue}>{d.count}</Text>
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
  adminBar: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, paddingHorizontal: spacing.md },
  adminBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  adminBtnText: { ...typography.caption, color: colors.accent, fontWeight: "700" },
  overallBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  overallEmoji: { fontSize: 28 },
  overallTitle: { ...typography.body, fontWeight: "700", color: colors.text },
  overallSub: { ...typography.caption, color: colors.textMuted },
  filterWrap: { gap: spacing.sm },
  chipRow: { flexDirection: "row", gap: spacing.xs, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.surface },
  chipText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  chipTextActive: { color: colors.accent },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  statusDot: { fontSize: 14 },
  statusLabel: { flex: 1, ...typography.bodySmall, color: colors.text },
  statusValue: { ...typography.caption, color: colors.textSecondary, textTransform: "capitalize" },
  statusMeta: { ...typography.caption, color: colors.textMuted },
  alertCard: {
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
    gap: 4,
  },
  alertTitle: { ...typography.body, fontWeight: "700", color: colors.text },
  alertMessage: { ...typography.bodySmall, color: colors.textSecondary },
  alertActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  alertMeta: { ...typography.caption, color: colors.textMuted },
  resolveBtn: { ...typography.caption, color: colors.accent, fontWeight: "700" },
  perfGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  perfItem: { width: "47%", ...typography.bodySmall, color: colors.text },
  errorCard: {
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: 4,
  },
  errorHeader: { flexDirection: "row", justifyContent: "space-between" },
  errorCategory: { ...typography.caption, fontWeight: "700", color: colors.accent, textTransform: "capitalize" },
  errorStatus: { ...typography.caption, color: colors.danger, fontWeight: "700", textTransform: "capitalize" },
  errorResolved: { color: colors.accent },
  errorMessage: { ...typography.bodySmall, color: colors.text },
  errorMeta: { ...typography.caption, color: colors.textMuted },
  stackTrace: { ...typography.caption, color: colors.textMuted, fontFamily: "monospace" },
  feedbackRow: { paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, gap: 2 },
  feedbackType: { ...typography.caption, color: colors.accent, fontWeight: "700", textTransform: "capitalize" },
  feedbackMsg: { ...typography.bodySmall, color: colors.text },
  feedbackMeta: { ...typography.caption, color: colors.textMuted },
  listRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  listLabel: { ...typography.bodySmall, color: colors.text },
  listValue: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  okText: { ...typography.bodySmall, color: colors.accent },
  muted: { ...typography.bodySmall, color: colors.textMuted },
});
