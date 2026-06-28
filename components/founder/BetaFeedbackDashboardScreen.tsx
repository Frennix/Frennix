import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { getBetaFeedbackFilterOptions, getErrorMessage, updateBetaFeedback } from "@frennix/api";
import type {
  BetaFeedback,
  BetaFeedbackUpdateInput,
  FeedbackFeatureArea,
  FeedbackPriority,
  FeedbackStatus,
  FeedbackType,
  HealthMetric,
} from "@frennix/types";
import { FounderShell } from "@/components/founder/FounderShell";
import { FounderWidget } from "@/components/founder/FounderWidget";
import { HealthMetricGrid } from "@/components/founder/HealthMetricGrid";
import { FounderFilterBar } from "@/components/founder/FounderFilterBar";
import {
  useBetaFeedbackDashboard,
  useBetaFeedbackList,
} from "@/lib/founder/useBetaFeedbackDashboard";
import { downloadTextFile, rowsToCsv } from "@/lib/founder/utils";
import { showAlert, showSuccess } from "@/lib/alerts";
import { colors, spacing, typography } from "@frennix/ui";
import type { FounderDatePreset } from "@frennix/types";
import { useQuery } from "@tanstack/react-query";

const STATUS_OPTIONS: FeedbackStatus[] = ["new", "in_progress", "fixed", "released", "closed"];
const PRIORITY_OPTIONS: FeedbackPriority[] = ["critical", "high", "medium", "low"];
const TYPE_OPTIONS: Array<FeedbackType | "all"> = ["all", "bug", "feature", "crash", "rating", "general"];
const DEVICE_OPTIONS = [
  { id: "all", label: "All devices" },
  { id: "iphone", label: "iPhone" },
  { id: "android", label: "Android" },
  { id: "web", label: "Web" },
] as const;

const CATEGORY_OPTIONS: Array<FeedbackFeatureArea | "all"> = [
  "all",
  "training_partners",
  "trainer_matching",
  "messages",
  "events",
  "notifications",
  "general",
];

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

function formatStatus(status: FeedbackStatus): string {
  return status.replace(/_/g, " ");
}

function formatPlatform(platform: string | null | undefined): string {
  switch (platform) {
    case "ios":
      return "iPhone";
    case "android":
      return "Android";
    case "web":
      return "Web";
    default:
      return platform ?? "Unknown";
  }
}

function formatCategory(area: string | null | undefined): string {
  return (area ?? "general").replace(/_/g, " ");
}

function summaryToMetrics(
  summary: NonNullable<ReturnType<typeof useBetaFeedbackDashboard>["data"]>["summary"]
): HealthMetric[] {
  return [
    { key: "total", label: "Total Feedback", emoji: "📥", value: summary.total_feedback },
    { key: "new", label: "Awaiting Review", emoji: "🆕", value: summary.awaiting_review },
    { key: "bugs", label: "Bug Reports", emoji: "🐛", value: summary.bug_reports },
    { key: "features", label: "Feature Requests", emoji: "💡", value: summary.feature_requests },
    { key: "crashes", label: "Crash Reports", emoji: "💥", value: summary.crash_reports },
    {
      key: "satisfaction",
      label: "Avg Satisfaction",
      emoji: "⭐",
      value: summary.avg_satisfaction_rating,
      suffix: summary.avg_satisfaction_rating != null ? "/5" : undefined,
    },
    { key: "dau", label: "Daily Active Testers", emoji: "📊", value: summary.daily_active_testers },
    { key: "wau", label: "Weekly Active Testers", emoji: "📈", value: summary.weekly_active_testers },
    {
      key: "match_rate",
      label: "Match Success",
      emoji: "🤝",
      value: summary.match_success_rate,
      suffix: summary.match_success_rate != null ? "%" : undefined,
    },
    {
      key: "chat_rate",
      label: "Conversation Start",
      emoji: "💬",
      value: summary.conversation_start_rate,
      suffix: summary.conversation_start_rate != null ? "%" : undefined,
    },
    { key: "msgs", label: "Msgs After Match", emoji: "✉️", value: summary.messages_after_match },
    {
      key: "session",
      label: "Avg Session",
      emoji: "⏱️",
      value: summary.avg_session_length_ms != null ? Math.round(summary.avg_session_length_ms / 1000) : null,
      suffix: summary.avg_session_length_ms != null ? "s" : undefined,
    },
  ];
}

function FeedbackRow({
  item,
  onUpdate,
  loading,
}: {
  item: BetaFeedback;
  onUpdate: (updates: BetaFeedbackUpdateInput) => void;
  loading: boolean;
}) {
  const author = item.user?.display_name ?? item.display_name ?? item.user?.username ?? "Tester";
  const [milestone, setMilestone] = useState(item.milestone_code ?? "");
  const [release, setRelease] = useState(item.release_version ?? "");
  const [githubIssue, setGithubIssue] = useState(item.github_issue_url ?? "");
  const [githubCommit, setGithubCommit] = useState(item.github_commit_sha ?? "");

  const isResolved = item.status === "fixed" || item.status === "released" || item.status === "closed";

  return (
    <View style={styles.feedbackCard}>
      <View style={styles.feedbackHeader}>
        <Text style={styles.feedbackType}>{item.type.replace(/_/g, " ")}</Text>
        <Text style={styles.feedbackStatus}>{formatStatus(item.status)}</Text>
      </View>

      {item.type === "rating" && item.rating ? (
        <Text style={styles.stars}>{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</Text>
      ) : null}

      {item.message ? <Text style={styles.feedbackMessage}>{item.message}</Text> : null}

      {item.screenshot_url ? (
        <Image source={{ uri: item.screenshot_url }} style={styles.screenshot} resizeMode="cover" />
      ) : null}

      <Text style={styles.feedbackMeta}>
        {author} · {formatPlatform(item.platform)}
        {item.app_version ? ` · v${item.app_version}` : ""}
        {item.build_number ? ` · build ${item.build_number}` : ""}
      </Text>
      <Text style={styles.feedbackMeta}>
        Category: {formatCategory(item.feature_area)}
        {item.milestone_code ? ` · Milestone ${item.milestone_code}` : ""}
        {item.release_version ? ` · Release ${item.release_version}` : ""}
      </Text>

      <View style={styles.chipRow}>
        {STATUS_OPTIONS.map((status) => (
          <Pressable
            key={status}
            style={[styles.smallChip, item.status === status && styles.smallChipActive]}
            onPress={() => onUpdate({ status })}
            disabled={loading}
          >
            <Text style={[styles.smallChipText, item.status === status && styles.smallChipTextActive]}>
              {formatStatus(status)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chipRow}>
        {PRIORITY_OPTIONS.map((priority) => (
          <Pressable
            key={priority}
            style={[styles.smallChip, item.priority === priority && styles.priorityChipActive]}
            onPress={() => onUpdate({ priority })}
            disabled={loading}
          >
            <Text style={[styles.smallChipText, item.priority === priority && styles.smallChipTextActive]}>
              {priority}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.linkFields}>
        <TextInput
          style={styles.linkInput}
          value={milestone}
          onChangeText={setMilestone}
          placeholder="Milestone (e.g. P1)"
          placeholderTextColor={colors.textMuted}
          onBlur={() => onUpdate({ milestoneCode: milestone.trim() || null })}
        />
        <TextInput
          style={styles.linkInput}
          value={release}
          onChangeText={setRelease}
          placeholder="Release (e.g. v1.0.0)"
          placeholderTextColor={colors.textMuted}
          onBlur={() => onUpdate({ releaseVersion: release.trim() || null })}
        />
        <TextInput
          style={styles.linkInput}
          value={githubIssue}
          onChangeText={setGithubIssue}
          placeholder="GitHub issue URL"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          onBlur={() => onUpdate({ githubIssueUrl: githubIssue.trim() || null })}
        />
        <TextInput
          style={styles.linkInput}
          value={githubCommit}
          onChangeText={setGithubCommit}
          placeholder="Git commit SHA"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          onBlur={() => onUpdate({ githubCommitSha: githubCommit.trim() || null })}
        />
      </View>

      {item.github_issue_url ? (
        <Text style={styles.link} onPress={() => void Linking.openURL(item.github_issue_url!)}>
          Open GitHub issue →
        </Text>
      ) : null}

      <View style={styles.notifyRow}>
        <Text style={styles.notifyLabel}>Notify tester when resolved</Text>
        <Switch
          value={item.notify_tester_when_resolved}
          onValueChange={(value) => onUpdate({ notifyTester: value })}
          trackColor={{ true: colors.accent, false: colors.border }}
        />
      </View>

      {isResolved && item.notify_tester_when_resolved && !item.tester_notified_at ? (
        <Text style={styles.notifyHint}>Notification queued for a future release.</Text>
      ) : null}
      {item.tester_notified_at ? (
        <Text style={styles.notifyHint}>Tester notified {new Date(item.tester_notified_at).toLocaleString()}</Text>
      ) : null}
    </View>
  );
}

export default function BetaFeedbackDashboardScreen() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<FounderDatePreset>("month");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [deviceFilter, setDeviceFilter] = useState<(typeof DEVICE_OPTIONS)[number]["id"]>("all");
  const [categoryFilter, setCategoryFilter] = useState<FeedbackFeatureArea | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<FeedbackPriority | "all">("all");
  const [milestoneFilter, setMilestoneFilter] = useState<string | "all">("all");
  const [platformFilter, setPlatformFilter] = useState<string | "all">("all");
  const [versionFilter, setVersionFilter] = useState<string | "all">("all");
  const [releaseFilter, setReleaseFilter] = useState<string | "all">("all");
  const days = presetToDays(preset);

  const dashboard = useBetaFeedbackDashboard(days);
  const listParams = useMemo(
    () => ({
      page: 1,
      pageSize: 50,
      type: typeFilter === "all" ? null : typeFilter,
      status: statusFilter === "all" ? null : statusFilter,
      platform: deviceFilter !== "all" ? deviceFilter : platformFilter === "all" ? null : platformFilter,
      appVersion: versionFilter === "all" ? null : versionFilter,
      releaseVersion: releaseFilter === "all" ? null : releaseFilter,
      featureArea: categoryFilter === "all" ? null : categoryFilter,
      priority: priorityFilter === "all" ? null : priorityFilter,
      milestoneCode: milestoneFilter === "all" ? null : milestoneFilter,
      search: search.trim() || null,
    }),
    [
      typeFilter,
      statusFilter,
      deviceFilter,
      platformFilter,
      versionFilter,
      releaseFilter,
      categoryFilter,
      priorityFilter,
      milestoneFilter,
      search,
    ]
  );
  const feedbackList = useBetaFeedbackList(listParams);

  const filterOptions = useQuery({
    queryKey: ["beta-feedback-filter-options"],
    queryFn: getBetaFeedbackFilterOptions,
    staleTime: 120_000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: BetaFeedbackUpdateInput }) =>
      updateBetaFeedback(id, updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["founder-beta-feedback-list"] });
      void queryClient.invalidateQueries({ queryKey: ["founder-beta-feedback-dashboard"] });
      showSuccess("Feedback updated");
    },
    onError: (error) => showAlert("Update failed", getErrorMessage(error)),
  });

  const metrics = useMemo(
    () => (dashboard.data?.summary ? summaryToMetrics(dashboard.data.summary) : []),
    [dashboard.data?.summary]
  );

  const computedAt = dashboard.data?.computed_at ? new Date(dashboard.data.computed_at) : null;

  return (
    <FounderShell title="Beta Feedback">
      <FlatList
        data={feedbackList.data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={
          <>
            <FounderWidget
              title="Beta Command Center"
              subtitle="Single source of truth for all tester feedback"
              loading={dashboard.isLoading && !dashboard.data}
              error={dashboard.isError ? "Could not load beta metrics" : null}
              updatedAt={computedAt}
              onRefresh={() => {
                void dashboard.refetch();
                void feedbackList.refetch();
              }}
              exportEnabled
              onExport={(format) => {
                const payload = { dashboard: dashboard.data, feedback: feedbackList.data?.items ?? [] };
                if (format === "csv") {
                  downloadTextFile(
                    "frennix-beta-feedback.csv",
                    rowsToCsv(feedbackList.data?.items ?? []),
                    "text/csv"
                  );
                } else {
                  downloadTextFile(
                    "frennix-beta-feedback.json",
                    JSON.stringify(payload, null, 2),
                    "application/json"
                  );
                }
              }}
              filterSlot={
                <FounderFilterBar
                  datePreset={preset}
                  onDatePresetChange={setPreset}
                  search={search}
                  onSearchChange={setSearch}
                />
              }
            >
              {metrics.length > 0 ? <HealthMetricGrid metrics={metrics} /> : null}
            </FounderWidget>

            {dashboard.data?.top_feature_requests && dashboard.data.top_feature_requests.length > 0 ? (
              <FounderWidget title="Most Requested Features" subtitle="Grouped feature requests">
                {dashboard.data.top_feature_requests.map((item) => (
                  <View key={item.feature_label} style={styles.listRow}>
                    <Text style={styles.listLabel} numberOfLines={2}>{item.feature_label}</Text>
                    <Text style={styles.listValue}>{item.request_count}</Text>
                  </View>
                ))}
              </FounderWidget>
            ) : null}

            {dashboard.data?.top_bugs && dashboard.data.top_bugs.length > 0 ? (
              <FounderWidget title="Most Common Bugs" subtitle="Grouped bug reports">
                {dashboard.data.top_bugs.map((item) => (
                  <View key={`${item.bug_area}-${item.bug_summary}`} style={styles.listRow}>
                    <Text style={styles.listLabel} numberOfLines={2}>
                      {formatCategory(item.bug_area)} — {item.bug_summary}
                    </Text>
                    <Text style={styles.listValue}>{item.report_count}</Text>
                  </View>
                ))}
              </FounderWidget>
            ) : null}

            <View style={styles.filtersSection}>
              <Text style={styles.sectionTitle}>Feedback Queue</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Pressable
                  style={[styles.filterChip, statusFilter === "all" && styles.filterChipActive]}
                  onPress={() => setStatusFilter("all")}
                >
                  <Text style={[styles.filterChipText, statusFilter === "all" && styles.filterChipTextActive]}>
                    All status
                  </Text>
                </Pressable>
                {STATUS_OPTIONS.map((status) => (
                  <Pressable
                    key={status}
                    style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
                    onPress={() => setStatusFilter(status)}
                  >
                    <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
                      {formatStatus(status)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {TYPE_OPTIONS.map((type) => (
                  <Pressable
                    key={type}
                    style={[styles.filterChip, typeFilter === type && styles.filterChipActive]}
                    onPress={() => setTypeFilter(type)}
                  >
                    <Text style={[styles.filterChipText, typeFilter === type && styles.filterChipTextActive]}>
                      {type === "all" ? "All types" : type}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {DEVICE_OPTIONS.map((device) => (
                  <Pressable
                    key={device.id}
                    style={[styles.filterChip, deviceFilter === device.id && styles.filterChipActive]}
                    onPress={() => setDeviceFilter(device.id)}
                  >
                    <Text style={[styles.filterChipText, deviceFilter === device.id && styles.filterChipTextActive]}>
                      {device.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {CATEGORY_OPTIONS.map((category) => (
                  <Pressable
                    key={category}
                    style={[styles.filterChip, categoryFilter === category && styles.filterChipActive]}
                    onPress={() => setCategoryFilter(category)}
                  >
                    <Text style={[styles.filterChipText, categoryFilter === category && styles.filterChipTextActive]}>
                      {category === "all" ? "All categories" : formatCategory(category)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Pressable
                  style={[styles.filterChip, priorityFilter === "all" && styles.filterChipActive]}
                  onPress={() => setPriorityFilter("all")}
                >
                  <Text style={[styles.filterChipText, priorityFilter === "all" && styles.filterChipTextActive]}>
                    All priority
                  </Text>
                </Pressable>
                {PRIORITY_OPTIONS.map((priority) => (
                  <Pressable
                    key={priority}
                    style={[styles.filterChip, priorityFilter === priority && styles.filterChipActive]}
                    onPress={() => setPriorityFilter(priority)}
                  >
                    <Text style={[styles.filterChipText, priorityFilter === priority && styles.filterChipTextActive]}>
                      {priority}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Pressable
                  style={[styles.filterChip, milestoneFilter === "all" && styles.filterChipActive]}
                  onPress={() => setMilestoneFilter("all")}
                >
                  <Text style={[styles.filterChipText, milestoneFilter === "all" && styles.filterChipTextActive]}>
                    All milestones
                  </Text>
                </Pressable>
                {(filterOptions.data?.milestone_codes ?? []).map((milestone) => (
                  <Pressable
                    key={milestone}
                    style={[styles.filterChip, milestoneFilter === milestone && styles.filterChipActive]}
                    onPress={() => setMilestoneFilter(milestone)}
                  >
                    <Text style={[styles.filterChipText, milestoneFilter === milestone && styles.filterChipTextActive]}>
                      {milestone}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Pressable
                  style={[styles.filterChip, versionFilter === "all" && styles.filterChipActive]}
                  onPress={() => setVersionFilter("all")}
                >
                  <Text style={[styles.filterChipText, versionFilter === "all" && styles.filterChipTextActive]}>
                    All versions
                  </Text>
                </Pressable>
                {(filterOptions.data?.app_versions ?? []).map((version) => (
                  <Pressable
                    key={version}
                    style={[styles.filterChip, versionFilter === version && styles.filterChipActive]}
                    onPress={() => setVersionFilter(version)}
                  >
                    <Text style={[styles.filterChipText, versionFilter === version && styles.filterChipTextActive]}>
                      v{version}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Pressable
                  style={[styles.filterChip, releaseFilter === "all" && styles.filterChipActive]}
                  onPress={() => setReleaseFilter("all")}
                >
                  <Text style={[styles.filterChipText, releaseFilter === "all" && styles.filterChipTextActive]}>
                    All releases
                  </Text>
                </Pressable>
                {(filterOptions.data?.release_versions ?? []).map((release) => (
                  <Pressable
                    key={release}
                    style={[styles.filterChip, releaseFilter === release && styles.filterChipActive]}
                    onPress={() => setReleaseFilter(release)}
                  >
                    <Text style={[styles.filterChipText, releaseFilter === release && styles.filterChipTextActive]}>
                      {release}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </>
        }
        renderItem={({ item }) => (
          <FeedbackRow
            item={item}
            loading={updateMutation.isPending}
            onUpdate={(updates) => updateMutation.mutate({ id: item.id, updates })}
          />
        )}
        ListEmptyComponent={
          !feedbackList.isLoading ? (
            <Text style={styles.empty}>No feedback matches your filters.</Text>
          ) : null
        }
      />
    </FounderShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  filtersSection: { paddingHorizontal: spacing.md, gap: spacing.sm },
  sectionTitle: { ...typography.section, color: colors.text },
  chipRow: { flexDirection: "row", gap: spacing.xs, paddingVertical: 2 },
  filterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: { borderColor: colors.accent, backgroundColor: colors.surfaceElevated },
  filterChipText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  filterChipTextActive: { color: colors.accent },
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
  feedbackCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  feedbackHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  feedbackType: { ...typography.body, fontWeight: "700", color: colors.accent, textTransform: "capitalize" },
  feedbackStatus: { ...typography.caption, color: colors.textSecondary, fontWeight: "700", textTransform: "capitalize" },
  feedbackMessage: { ...typography.body, color: colors.text, lineHeight: 22 },
  feedbackMeta: { ...typography.caption, color: colors.textMuted },
  stars: { fontSize: 18, color: colors.accent, letterSpacing: 2 },
  screenshot: { width: "100%", height: 180, borderRadius: 8, backgroundColor: colors.background },
  smallChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  smallChipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  priorityChipActive: { borderColor: colors.warning, backgroundColor: "rgba(234, 179, 8, 0.14)" },
  smallChipText: { ...typography.caption, color: colors.textMuted, fontWeight: "600", textTransform: "capitalize" },
  smallChipTextActive: { color: colors.accent },
  linkFields: { gap: spacing.xs },
  linkInput: {
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    color: colors.text,
    backgroundColor: colors.background,
    ...typography.caption,
  },
  link: { ...typography.caption, color: colors.accent, fontWeight: "600" },
  notifyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  notifyLabel: { ...typography.bodySmall, color: colors.textSecondary },
  notifyHint: { ...typography.caption, color: colors.textMuted, fontStyle: "italic" },
  empty: { ...typography.bodySmall, color: colors.textMuted, textAlign: "center", padding: spacing.lg },
});
