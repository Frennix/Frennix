import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  adminDeleteComment,
  adminDeletePost,
  applyModerationAction,
  getErrorMessage,
  getModerationOverview,
  getModerationReportsPage,
  reportContentTypeLabel,
  updateReportStatus,
} from "@frennix/api";
import type { ModerationReport, ReportStatus } from "@frennix/types";
import { FounderShell } from "@/components/founder/FounderShell";
import { FounderWidget } from "@/components/founder/FounderWidget";
import { HealthMetricGrid } from "@/components/founder/HealthMetricGrid";
import { useAuth } from "@/providers/AuthProvider";
import { useStaffCapability } from "@/lib/founder/useStaffAccess";
import { downloadTextFile, rowsToCsv } from "@/lib/founder/utils";
import { showAlert, showSuccess } from "@/lib/alerts";
import { Button, EmptyState, colors, radius, spacing, typography } from "@frennix/ui";

const STATUS_FILTERS: Array<{ key: ReportStatus | "all"; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "action_taken", label: "Action taken" },
  { key: "dismissed", label: "Dismissed" },
  { key: "reviewed", label: "Reviewed" },
  { key: "all", label: "All" },
];

function ReportRow({
  report,
  loading,
  onDismiss,
  onRemove,
  onWarn,
  onSuspend,
  onBan,
  onRestore,
}: {
  report: ModerationReport;
  loading: boolean;
  onDismiss: () => void;
  onRemove: () => void;
  onWarn: () => void;
  onSuspend: () => void;
  onBan: () => void;
  onRestore: () => void;
}) {
  const typeLabel = reportContentTypeLabel(report);
  const reporter = report.reporter?.display_name ?? "Unknown";
  const subject = report.reported_user?.display_name ?? "Unknown";

  return (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <Text style={styles.reportType}>{typeLabel}</Text>
        <Text style={styles.reportStatus}>{report.status}</Text>
      </View>
      <Text style={styles.reportReason}>{report.reason}</Text>
      {report.details ? <Text style={styles.reportDetails}>{report.details}</Text> : null}
      <Text style={styles.reportMeta}>
        By {reporter} · Subject {subject}
      </Text>
      <Text style={styles.reportMeta}>{new Date(report.created_at).toLocaleString()}</Text>
      {report.admin_notes ? (
        <Text style={styles.notes}>Notes: {report.admin_notes}</Text>
      ) : null}
      <View style={styles.actions}>
        <Button title="Dismiss" variant="secondary" onPress={onDismiss} loading={loading} />
        {(report.reported_post_id || report.reported_comment_id) && (
          <Button title="Remove" variant="danger" onPress={onRemove} loading={loading} />
        )}
        {report.reported_user_id ? (
          <>
            <Button title="Warn" variant="secondary" onPress={onWarn} loading={loading} />
            <Button title="Suspend 72h" variant="secondary" onPress={onSuspend} loading={loading} />
            <Button title="Ban" variant="danger" onPress={onBan} loading={loading} />
            <Button title="Restore" variant="secondary" onPress={onRestore} loading={loading} />
          </>
        ) : null}
      </View>
    </View>
  );
}

export default function FounderModerationDashboardScreen() {
  const { session } = useAuth();
  const adminId = session?.user.id ?? "";
  const canModerate = useStaffCapability("capability_moderate");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReportStatus | "all">("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const overview = useQuery({
    queryKey: ["moderation-overview"],
    queryFn: getModerationOverview,
    enabled: canModerate,
    refetchInterval: 60_000,
  });

  const reports = useQuery({
    queryKey: ["moderation-reports-page", status, search, page],
    queryFn: () =>
      getModerationReportsPage({
        status: status === "all" ? null : status,
        search: search.trim() || undefined,
        page,
        pageSize: 20,
      }),
    enabled: canModerate,
  });

  const actionMutation = useMutation({
    mutationFn: async (input: {
      report: ModerationReport;
      action: "dismiss" | "remove" | "warn" | "suspend" | "ban" | "restore";
    }) => {
      const { report, action } = input;
      if (action === "dismiss") {
        await updateReportStatus(report.id, adminId, "dismissed");
        return;
      }
      if (action === "remove") {
        if (report.reported_post_id) await adminDeletePost(report.reported_post_id);
        if (report.reported_comment_id) await adminDeleteComment(report.reported_comment_id);
        await updateReportStatus(report.id, adminId, "action_taken", "Content removed");
        return;
      }
      if (!report.reported_user_id) return;
      if (action === "warn") {
        await applyModerationAction({
          targetUserId: report.reported_user_id,
          actionType: "warn",
          reportId: report.id,
          notes: `Warned via report ${report.id}`,
        });
        return;
      }
      if (action === "suspend") {
        await applyModerationAction({
          targetUserId: report.reported_user_id,
          actionType: "suspend",
          durationHours: 72,
          reportId: report.id,
          notes: "72-hour suspension",
        });
        return;
      }
      if (action === "ban") {
        await applyModerationAction({
          targetUserId: report.reported_user_id,
          actionType: "ban",
          reportId: report.id,
          notes: "Banned via moderation queue",
        });
        return;
      }
      if (action === "restore") {
        await applyModerationAction({
          targetUserId: report.reported_user_id,
          actionType: "restore",
          reportId: report.id,
          notes: "Restored via moderation queue",
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["moderation-reports-page"] });
      void queryClient.invalidateQueries({ queryKey: ["moderation-overview"] });
      showSuccess("Moderation action completed");
    },
    onError: (error) => showAlert("Action failed", getErrorMessage(error)),
  });

  const overviewMetrics = useMemo(() => {
    const s = overview.data;
    if (!s) return [];
    return [
      { key: "pending", label: "Pending reports", emoji: "⚑", value: s.pending_reports },
      { key: "resolved", label: "Resolved", emoji: "✓", value: s.resolved_reports },
      { key: "suspended", label: "Suspended", emoji: "⏸", value: s.suspended_users },
      { key: "banned", label: "Banned", emoji: "🚫", value: s.banned_users },
      { key: "spam", label: "Spam (24h)", emoji: "🛡", value: s.spam_attempts_24h },
      { key: "reports24", label: "Reports (24h)", emoji: "📋", value: s.reports_24h },
    ];
  }, [overview.data]);

  if (!canModerate) {
    return (
      <FounderShell title="Moderation">
        <EmptyState
          title="Moderator access required"
          description="You need moderation capability to review reports."
        />
      </FounderShell>
    );
  }

  return (
    <FounderShell title="Trust & Safety">
      <ScrollView contentContainerStyle={styles.scroll}>
        <FounderWidget
          title="Moderation overview"
          subtitle="Reports, enforcement, and automated protection"
          loading={overview.isLoading && !overview.data}
          onRefresh={() => void overview.refetch()}
          exportEnabled
          onExport={(format) => {
            const rows = overview.data?.recent_actions ?? [];
            if (format === "csv") {
              downloadTextFile("frennix-moderation-actions.csv", rowsToCsv(rows as never), "text/csv");
            } else {
              downloadTextFile(
                "frennix-moderation-overview.json",
                JSON.stringify(overview.data, null, 2),
                "application/json"
              );
            }
          }}
        >
          {overviewMetrics.length ? <HealthMetricGrid metrics={overviewMetrics} /> : null}
          {(overview.data?.top_report_reasons ?? []).length ? (
            <View style={styles.reasonsBlock}>
              <Text style={styles.sectionLabel}>Top report reasons (30d)</Text>
              {(overview.data?.top_report_reasons ?? []).map((r) => (
                <Text key={r.reason} style={styles.reasonRow}>
                  {r.reason} · {r.count}
                </Text>
              ))}
            </View>
          ) : null}
        </FounderWidget>

        <FounderWidget title="Report queue" subtitle="Filter, search, and take action">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STATUS_FILTERS.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => {
                  setStatus(f.key);
                  setPage(1);
                }}
                style={[styles.chip, status === f.key && styles.chipActive]}
              >
                <Text style={[styles.chipText, status === f.key && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            style={styles.search}
            placeholder="Search reports, usernames…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
          <FlatList
            data={reports.data?.items ?? []}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ListEmptyComponent={
              !reports.isLoading ? (
                <EmptyState title="No reports" description="Reports matching your filters appear here." />
              ) : null
            }
            renderItem={({ item }) => (
              <ReportRow
                report={item}
                loading={actionMutation.isPending}
                onDismiss={() => actionMutation.mutate({ report: item, action: "dismiss" })}
                onRemove={() => actionMutation.mutate({ report: item, action: "remove" })}
                onWarn={() => actionMutation.mutate({ report: item, action: "warn" })}
                onSuspend={() => actionMutation.mutate({ report: item, action: "suspend" })}
                onBan={() => actionMutation.mutate({ report: item, action: "ban" })}
                onRestore={() => actionMutation.mutate({ report: item, action: "restore" })}
              />
            )}
          />
          <View style={styles.pagination}>
            <Button
              title="Previous"
              variant="secondary"
              disabled={page <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            />
            <Text style={styles.pageLabel}>
              Page {page}
              {reports.data?.total != null ? ` · ${reports.data.total} total` : ""}
            </Text>
            <Button
              title="Next"
              variant="secondary"
              disabled={!reports.data?.hasMore}
              onPress={() => setPage((p) => p + 1)}
            />
          </View>
        </FounderWidget>
      </ScrollView>
    </FounderShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  chipRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.surfaceElevated },
  chipText: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  chipTextActive: { color: colors.accent },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    color: colors.text,
    marginBottom: spacing.md,
  },
  reportCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  reportHeader: { flexDirection: "row", justifyContent: "space-between" },
  reportType: { ...typography.body, fontWeight: "700", color: colors.accent },
  reportStatus: { ...typography.caption, color: colors.textMuted },
  reportReason: { ...typography.body },
  reportDetails: { ...typography.bodySmall, color: colors.textSecondary },
  reportMeta: { ...typography.caption, color: colors.textMuted },
  notes: { ...typography.caption, color: colors.warning },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pageLabel: { ...typography.caption, color: colors.textMuted },
  reasonsBlock: { marginTop: spacing.md, gap: spacing.xs },
  sectionLabel: { ...typography.bodySmall, fontWeight: "600", color: colors.textSecondary },
  reasonRow: { ...typography.caption, color: colors.textMuted },
});
