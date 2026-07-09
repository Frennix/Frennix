import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { FounderShell } from "@/components/founder/FounderShell";
import { FounderWidget } from "@/components/founder/FounderWidget";
import { HealthMetricGrid } from "@/components/founder/HealthMetricGrid";
import { TrendSparkline } from "@/components/founder/TrendSparkline";
import { useCommunityHealth } from "@/lib/founder/useCommunityHealth";
import { useOperationsDashboard } from "@/lib/founder/useOperationsDashboard";
import { useExecutiveDashboard } from "@/lib/founder/useExecutiveDashboard";
import { useQuery } from "@tanstack/react-query";
import { getGrowthDashboardMetrics, getModerationOverview } from "@frennix/api";
import { useStaffCapability } from "@/lib/founder/useStaffAccess";
import { downloadTextFile, rowsToCsv } from "@/lib/founder/utils";
import { colors, spacing, typography } from "@frennix/ui";

export default function FounderCommandCenterScreen() {
  const router = useRouter();
  const canModerate = useStaffCapability("capability_moderate");
  const executive = useExecutiveDashboard();
  const community = useCommunityHealth(30);
  const operations = useOperationsDashboard("7d", "week");

  const moderation = useQuery({
    queryKey: ["moderation-overview"],
    queryFn: getModerationOverview,
    enabled: canModerate,
    refetchInterval: 60_000,
  });

  const growth = useQuery({
    queryKey: ["growth-dashboard"],
    queryFn: getGrowthDashboardMetrics,
    refetchInterval: 120_000,
  });

  const userMetrics = useMemo(() => {
    const s = community.data?.summary;
    const ops = operations.data?.live_activity;
    const beta = operations.data?.beta_health.summary;
    if (!s && !ops && !beta) return [];
    return [
      { key: "total", label: "Total users", emoji: "👥", value: beta?.total_beta_users ?? s?.mau ?? null },
      { key: "new_today", label: "New today", emoji: "✨", value: ops?.new_users_today ?? beta?.new_signups_today ?? null },
      { key: "dau", label: "DAU", emoji: "📊", value: s?.dau ?? beta?.daily_active_users ?? null },
      { key: "wau", label: "WAU", emoji: "📈", value: s?.wau ?? beta?.weekly_active_users ?? null },
      { key: "mau", label: "MAU", emoji: "📅", value: s?.mau ?? null },
      { key: "online", label: "Online now", emoji: "🟢", value: ops?.users_online ?? null },
      { key: "ret_d7", label: "D7 retention", emoji: "🔄", value: s?.retention_d7, suffix: "%" },
      { key: "session", label: "Avg session", emoji: "⏱", value: beta?.avg_session_duration_ms, suffix: "ms" },
    ];
  }, [community.data, operations.data]);

  const communityMetrics = useMemo(() => {
    const s = community.data?.summary;
    const ops = operations.data?.live_activity;
    if (!s && !ops) return [];
    return [
      { key: "posts", label: "Posts today", emoji: "📰", value: ops?.posts_today ?? s?.workout_posts },
      { key: "stories", label: "Stories", emoji: "📸", value: s?.stories },
      { key: "comments", label: "Comments", emoji: "💬", value: s?.comments },
      { key: "reactions", label: "Likes & reactions", emoji: "❤️", value: s?.reactions },
      { key: "messages", label: "Messages", emoji: "✉️", value: ops?.messages_today ?? s?.messages },
      { key: "matches", label: "Training matches", emoji: "🤝", value: s?.matches },
      { key: "events", label: "Events", emoji: "📅", value: s?.events },
      { key: "challenges", label: "Challenges", emoji: "🏆", value: s?.challenges },
      { key: "challenge_rate", label: "Challenge completion", emoji: "✅", value: growth.data?.challenge_completion_rate, suffix: "%" },
    ];
  }, [community.data, operations.data, growth.data]);

  const notificationMetrics = useMemo(() => {
    const push = operations.data?.push;
    if (!push) return [];
    return [
      { key: "sent", label: "Push sent today", emoji: "📤", value: operations.data?.live_activity.push_notifications_sent_today },
      { key: "delivered", label: "Delivered", emoji: "📬", value: push.notifications_delivered },
      { key: "failed", label: "Failed", emoji: "❌", value: push.notifications_failed },
      { key: "rate", label: "Delivery rate", emoji: "📊", value: push.delivery_percentage, suffix: "%" },
      { key: "devices", label: "Devices registered", emoji: "📱", value: push.active_subscriptions },
    ];
  }, [operations.data]);

  const signupTrend = (growth.data?.daily_signups ?? []).map((d) => ({
    label: d.day,
    value: d.count,
  }));

  const dauTrend = (community.data?.series ?? []).slice(-14).map((d) => ({
    label: d.date,
    value: d.dau,
  }));

  return (
    <FounderShell title="Command Center">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lede}>
          Unified operations view for beta health, community engagement, trust & safety, and growth.
        </Text>

        <FounderWidget
          title="User metrics"
          subtitle="Growth, retention, and live activity"
          loading={community.isLoading && operations.isLoading}
          onRefresh={() => {
            void executive.refetch();
            void community.refetch();
            void operations.refetch();
          }}
          exportEnabled
          onExport={(format) => {
            const rows = userMetrics.map((m) => ({ key: m.key, label: m.label, value: m.value ?? "" }));
            if (format === "csv") downloadTextFile("frennix-user-metrics.csv", rowsToCsv(rows), "text/csv");
            else downloadTextFile("frennix-user-metrics.json", JSON.stringify(rows, null, 2), "application/json");
          }}
        >
          <HealthMetricGrid metrics={userMetrics} />
          {signupTrend.length ? (
            <View style={styles.chartBlock}>
              <TrendSparkline label="New signups by day" data={signupTrend} suffix="" />
            </View>
          ) : null}
          {dauTrend.length ? (
            <View style={styles.chartBlock}>
              <TrendSparkline label="Daily active users" data={dauTrend} suffix="" />
            </View>
          ) : null}
        </FounderWidget>

        <FounderWidget
          title="Community engagement"
          subtitle="Posts, stories, messaging, events, and challenges"
          loading={community.isLoading}
          onRefresh={() => void community.refetch()}
        >
          <HealthMetricGrid metrics={communityMetrics} />
        </FounderWidget>

        <FounderWidget
          title="Notifications"
          subtitle="Push delivery and device registration"
          loading={operations.isLoading}
          onRefresh={() => void operations.refetch()}
        >
          <HealthMetricGrid metrics={notificationMetrics} />
        </FounderWidget>

        {canModerate ? (
          <FounderWidget
            title="Moderation overview"
            subtitle="Trust & safety at a glance"
            loading={moderation.isLoading}
            onRefresh={() => void moderation.refetch()}
          >
            <HealthMetricGrid
              metrics={[
                { key: "pending", label: "Pending reports", emoji: "⚑", value: moderation.data?.pending_reports ?? 0 },
                { key: "banned", label: "Banned users", emoji: "🚫", value: moderation.data?.banned_users ?? 0 },
                { key: "spam", label: "Spam attempts (24h)", emoji: "🛡", value: moderation.data?.spam_attempts_24h ?? 0 },
              ]}
            />
            <Text style={styles.link} onPress={() => router.push("/founder/moderation")}>
              Open moderation dashboard →
            </Text>
          </FounderWidget>
        ) : null}

        <FounderWidget
          title="Performance & reliability"
          subtitle="API, feed, crashes, and active alerts"
          loading={operations.isLoading}
          onRefresh={() => void operations.refetch()}
        >
          <HealthMetricGrid
            metrics={[
              {
                key: "health",
                label: "System health",
                emoji: operations.data?.overall_system_health === "green" ? "🟢" : "🟡",
                value: operations.data?.overall_system_health ?? "unknown",
              },
              {
                key: "feed",
                label: "Avg feed load",
                emoji: "📰",
                value: operations.data?.performance.averages.feed_load_ms,
                suffix: "ms",
              },
              {
                key: "api",
                label: "Avg API response",
                emoji: "🔌",
                value: operations.data?.performance.averages.api_response_ms,
                suffix: "ms",
              },
              {
                key: "crashes",
                label: "Crash-free sessions",
                emoji: "✅",
                value: operations.data?.beta_health.summary.crash_free_session_pct,
                suffix: "%",
              },
              {
                key: "errors",
                label: "Active errors",
                emoji: "⚠️",
                value: operations.data?.errors.filter((e) => e.status === "active").length ?? 0,
              },
              {
                key: "alerts",
                label: "Active alerts",
                emoji: "🚨",
                value: operations.data?.alerts.filter((a) => a.status === "active").length ?? 0,
              },
            ]}
          />
          <Text style={styles.link} onPress={() => router.push("/founder/operations")}>
            Open operations dashboard →
          </Text>
        </FounderWidget>

        <FounderWidget title="Growth" subtitle="Referrals, top challenges, and top events">
          <HealthMetricGrid
            metrics={[
              { key: "ref", label: "Referral conversions", emoji: "📈", value: growth.data?.referral_conversions ?? 0 },
              { key: "invites", label: "Referral codes", emoji: "✉️", value: growth.data?.referral_invites ?? 0 },
            ]}
          />
          {(growth.data?.top_challenges ?? []).slice(0, 3).map((c) => (
            <Text key={c.id} style={styles.listRow}>
              🏆 {c.title} · {c.participants} participants
            </Text>
          ))}
          {(growth.data?.top_events ?? []).slice(0, 3).map((e) => (
            <Text key={e.id} style={styles.listRow}>
              📅 {e.title} · {e.attendees} attendees
            </Text>
          ))}
        </FounderWidget>

        <View style={styles.quickLinks}>
          {[
            ["/founder/community", "Community Health"],
            ["/founder/platform", "Platform Health"],
            ["/founder/support", "Beta Feedback"],
            ["/founder/admin", "Admin & Audit Log"],
          ].map(([href, label]) => (
            <Text key={href} style={styles.link} onPress={() => router.push(href as never)}>
              {label} →
            </Text>
          ))}
        </View>
      </ScrollView>
    </FounderShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  lede: { ...typography.bodySmall, color: colors.textMuted, marginBottom: spacing.sm },
  chartBlock: { marginTop: spacing.md, gap: spacing.xs },
  chartLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  link: { ...typography.bodySmall, color: colors.accent, fontWeight: "600", marginTop: spacing.sm },
  listRow: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  quickLinks: { gap: spacing.sm, paddingVertical: spacing.md },
});
