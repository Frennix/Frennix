import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getProductAnalyticsSummary } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { EmptyState, colors, spacing, typography } from "@frennix/ui";

const DAY_OPTIONS = [7, 14, 30];

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function AdminAnalyticsScreen() {
  const { profile } = useAuth();
  const [days, setDays] = useState(7);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-analytics", days],
    queryFn: () => getProductAnalyticsSummary(days),
    enabled: !!profile?.is_admin,
  });

  if (!profile?.is_admin) {
    return (
      <EmptyState title="Admin only" description="You do not have access to product analytics." />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Product analytics</Text>
      <Text style={styles.subtitle}>Supabase events — last {days} days</Text>

      <View style={styles.dayRow}>
        {DAY_OPTIONS.map((option) => (
          <Pressable
            key={option}
            style={[styles.dayChip, days === option && styles.dayChipActive]}
            onPress={() => setDays(option)}
          >
            <Text style={[styles.dayChipText, days === option && styles.dayChipTextActive]}>{option}d</Text>
          </Pressable>
        ))}
      </View>

      {isLoading && !data ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : data ? (
        <>
          <View style={styles.grid}>
            <MetricCard label="Signups" value={data.signups} />
            <MetricCard label="DAU (unique)" value={data.daily_active_users_total} />
            <MetricCard label="Training matches" value={data.training_partner_matches} />
            <MetricCard label="Trainer requests" value={data.trainer_connection_requests} />
            <MetricCard label="Trainer accepted" value={data.trainer_connections_accepted} />
            <MetricCard label="Messages sent" value={data.messages_sent} />
            <MetricCard label="Events joined" value={data.events_joined} />
          </View>

          {data.daily_active_users.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Daily active users</Text>
              {data.daily_active_users.map((row) => (
                <Text key={row.date} style={styles.dauRow}>
                  {row.date}: {row.count}
                </Text>
              ))}
            </View>
          ) : null}

          {data.perf_events.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Performance (avg ms)</Text>
              {data.perf_events.map((row) => (
                <Text key={row.event_name} style={styles.dauRow}>
                  {row.event_name.replace("perf_", "")}: {row.avg_ms ?? "—"} ms ({row.count} samples)
                </Text>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {isRefetching ? <ActivityIndicator color={colors.accent} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.heading, fontSize: 20 },
  subtitle: { ...typography.bodySmall, color: colors.textMuted },
  dayRow: { flexDirection: "row", gap: spacing.sm },
  dayChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: { borderColor: colors.accent },
  dayChipText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  dayChipTextActive: { color: colors.accent },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  metricCard: {
    width: "47%",
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  metricValue: { ...typography.heading, fontSize: 22, color: colors.accent },
  metricLabel: { ...typography.caption, color: colors.textMuted },
  section: { gap: spacing.xs },
  sectionTitle: { ...typography.body, fontWeight: "700" },
  dauRow: { ...typography.bodySmall, color: colors.textSecondary },
  loader: { marginVertical: spacing.xl },
});
