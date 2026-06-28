import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { getFounderAnalyticsDomains } from "@frennix/api";
import { FounderShell } from "@/components/founder/FounderShell";
import { FounderWidget } from "@/components/founder/FounderWidget";
import MatchmakingAnalyticsScreen from "@/components/founder/MatchmakingAnalyticsScreen";
import { colors, spacing, typography } from "@frennix/ui";

const DOMAIN_LABELS: Record<string, { title: string; milestone: string; description: string }> = {
  revenue: {
    title: "Revenue Dashboard",
    milestone: "M9 Marketplace",
    description: "Revenue, GMV, and transaction analytics when payments launch.",
  },
  subscriptions: {
    title: "Subscription Analytics",
    milestone: "M9 Marketplace",
    description: "MRR, premium members, trials, and churn.",
  },
  ambassadors: {
    title: "Ambassador Performance",
    milestone: "M8 Ambassador Program",
    description: "Referral growth, ambassador tiers, and engagement scores.",
  },
  "creator-payouts": {
    title: "Creator Payouts",
    milestone: "M9 Marketplace",
    description: "Creator earnings and payout pipeline.",
  },
  advertising: {
    title: "Advertisement Analytics",
    milestone: "M9 Marketplace",
    description: "Impressions, clicks, and campaign performance.",
  },
  marketplace: {
    title: "Marketplace Analytics",
    milestone: "M9 Marketplace",
    description: "Product sales, listings, and marketplace GMV.",
  },
  "ai-coach": {
    title: "AI Coach Usage",
    milestone: "M10 AI Coach",
    description: "Session volume, retention, and feature usage.",
  },
  challenges: {
    title: "Challenge Analytics",
    milestone: "M4 Challenges",
    description: "Participation, completion rates, and trending challenges.",
  },
  events: {
    title: "Event Analytics",
    milestone: "M5 Events",
    description: "RSVPs, attendance, and event growth.",
  },
  matchmaking: {
    title: "Matchmaking Analytics",
    milestone: "P1 Matchmaking",
    description: "Swipes, matches, deck funnel, and conversion metrics.",
  },
  nutrition: {
    title: "Nutrition Analytics",
    milestone: "Future",
    description: "Nutrition logging and meal tracking engagement.",
  },
  referrals: {
    title: "Referral Analytics",
    milestone: "M1 Foundation",
    description: "Invite conversion, referral growth, and viral coefficient.",
  },
  messaging: {
    title: "Messaging Analytics",
    milestone: "M2 Messaging",
    description: "Message volume, delivery, and Realtime health.",
  },
  stories: {
    title: "Stories Analytics",
    milestone: "M3 Stories",
    description: "Story uploads, views, and engagement.",
  },
  users: {
    title: "User Analytics",
    milestone: "M7.7",
    description: "Growth, retention cohorts, and engagement — full charts in M7.7.",
  },
  notifications: {
    title: "Push Notification Analytics",
    milestone: "M7.3",
    description: "Delivery rate, open rate, and engagement.",
  },
  crashes: {
    title: "Crash Analytics",
    milestone: "M7.3 Platform",
    description: "Sentry crash-free sessions and issue tracking.",
  },
  "api-performance": {
    title: "API Performance",
    milestone: "M7.3 Platform",
    description: "Latency p50/p95 and error rates.",
  },
  database: {
    title: "Database Health",
    milestone: "M7.3 Platform",
    description: "Connection pool, query latency, and storage.",
  },
  realtime: {
    title: "Realtime Connection Health",
    milestone: "M7.3 Platform",
    description: "Messaging and presence Realtime subscribe success.",
  },
  "feature-adoption": {
    title: "Feature Adoption",
    milestone: "M7.5",
    description: "Feature flag rollout and adoption metrics.",
  },
  "app-store": {
    title: "App Store Reviews",
    milestone: "M8",
    description: "Rating average, review volume, and sentiment.",
  },
};

export default function AnalyticsDomainScreen() {
  const { domain } = useLocalSearchParams<{ domain: string }>();
  const key = String(domain ?? "unknown");

  if (key === "matchmaking") {
    return <MatchmakingAnalyticsScreen />;
  }

  const meta = DOMAIN_LABELS[key];

  const { data: domains } = useQuery({
    queryKey: ["founder-analytics-domains"],
    queryFn: getFounderAnalyticsDomains,
  });

  const dbDomain = domains?.find((d) => d.drill_down_path?.endsWith(`/${key}`) || d.domain_key === key);

  return (
    <FounderShell title={meta?.title ?? "Analytics"}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FounderWidget
          title={meta?.title ?? key}
          subtitle={dbDomain?.status === "active" ? "Active module" : `Planned · ${meta?.milestone ?? "TBD"}`}
        >
          <Text style={styles.body}>{meta?.description ?? dbDomain?.description ?? "Analytics module."}</Text>
          <View style={styles.metaBox}>
            <Text style={styles.metaRow}>Domain key: {dbDomain?.domain_key ?? key}</Text>
            <Text style={styles.metaRow}>Status: {dbDomain?.status ?? "placeholder"}</Text>
            <Text style={styles.metaRow}>Milestone: {dbDomain?.milestone_code ?? meta?.milestone ?? "—"}</Text>
          </View>
          <Text style={styles.note}>
            Data model and route are registered. Charts, tables, and exports will ship with this domain&apos;s
            milestone — built on the shared pagination, filter, search, export, and realtime widget framework.
          </Text>
        </FounderWidget>
      </ScrollView>
    </FounderShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  body: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 22 },
  metaBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  metaRow: { ...typography.caption, color: colors.textMuted },
  note: { ...typography.caption, color: colors.textMuted, marginTop: spacing.md, lineHeight: 18 },
});
