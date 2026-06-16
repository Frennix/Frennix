import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  adminBanUser,
  adminDeleteComment,
  adminDeletePost,
  getErrorMessage,
  getModerationReports,
  updateReportStatus,
} from "@frennix/api";
import type { ModerationReport, ReportStatus } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert, showSuccess } from "@/lib/alerts";
import { Button, EmptyState, colors, radius, spacing, typography } from "@frennix/ui";

function reportSummary(report: ModerationReport) {
  if (report.reported_post_id) return "Post report";
  if (report.reported_comment_id) return "Comment report";
  return "User report";
}

function ReportCard({
  report,
  onDismiss,
  onRemoveContent,
  onBanUser,
  loading,
}: {
  report: ModerationReport;
  onDismiss: () => void;
  onRemoveContent: () => void;
  onBanUser: () => void;
  loading: boolean;
}) {
  const reporter = report.reporter?.display_name ?? "Unknown";
  const subject = report.reported_user?.display_name ?? "Unknown user";

  return (
    <View style={styles.card}>
      <Text style={styles.cardType}>{reportSummary(report)}</Text>
      <Text style={styles.cardReason}>{report.reason}</Text>
      <Text style={styles.cardMeta}>
        Reported by {reporter} · {subject}
      </Text>
      <Text style={styles.cardMeta}>
        {new Date(report.created_at).toLocaleString()}
      </Text>
      <View style={styles.actions}>
        <Button title="Dismiss" variant="secondary" onPress={onDismiss} loading={loading} />
        {(report.reported_post_id || report.reported_comment_id) && (
          <Button title="Remove content" variant="danger" onPress={onRemoveContent} loading={loading} />
        )}
        {report.reported_user_id && (
          <Button title="Ban user" variant="danger" onPress={onBanUser} loading={loading} />
        )}
      </View>
    </View>
  );
}

export default function AdminModerationScreen() {
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const status: ReportStatus = "pending";

  const { data: reports = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["moderation-reports", status],
    queryFn: () => getModerationReports(status),
    enabled: !!profile?.is_admin,
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      report,
      action,
    }: {
      report: ModerationReport;
      action: "dismiss" | "remove" | "ban";
    }) => {
      if (action === "dismiss") {
        await updateReportStatus(report.id, userId, "dismissed");
        return;
      }
      if (action === "remove") {
        if (report.reported_post_id) await adminDeletePost(report.reported_post_id);
        if (report.reported_comment_id) await adminDeleteComment(report.reported_comment_id);
        await updateReportStatus(report.id, userId, "action_taken", "Content removed");
        return;
      }
      if (report.reported_user_id) {
        await adminBanUser(report.reported_user_id);
        await updateReportStatus(report.id, userId, "action_taken", "User banned");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation-reports"] });
      showSuccess("Action completed");
    },
    onError: (error) => showAlert("Action failed", getErrorMessage(error)),
  });

  if (!profile?.is_admin) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Admin access required"
          description="You don't have permission to view the moderation panel."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{reports.length} pending reports</Text>
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No pending reports"
              description="New user reports will appear here for review."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <ReportCard
            report={item}
            loading={actionMutation.isPending}
            onDismiss={() => actionMutation.mutate({ report: item, action: "dismiss" })}
            onRemoveContent={() => actionMutation.mutate({ report: item, action: "remove" })}
            onBanUser={() => actionMutation.mutate({ report: item, action: "ban" })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    ...typography.body,
    fontWeight: "600",
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  list: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardType: { ...typography.body, fontWeight: "700", color: colors.accent },
  cardReason: { ...typography.body, color: colors.text },
  cardMeta: { ...typography.caption, color: colors.textMuted },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
