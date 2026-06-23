import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { getAdminFeedback, getErrorMessage, reopenFeedback, resolveFeedback } from "@frennix/api";
import type { BetaFeedback, FeedbackFeatureArea, FeedbackStatus, FeedbackType } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert, showSuccess } from "@/lib/alerts";
import { Button, EmptyState, colors, radius, spacing, typography } from "@frennix/ui";

type TypeFilter = FeedbackType | "all";
type StatusFilter = FeedbackStatus | "all";
type AreaFilter = FeedbackFeatureArea | "all";

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bug", label: "Bugs" },
  { id: "feature", label: "Features" },
  { id: "general", label: "General" },
  { id: "rating", label: "Ratings" },
];

const AREA_FILTERS: { id: AreaFilter; label: string }[] = [
  { id: "all", label: "All areas" },
  { id: "training_partners", label: "Training Partners" },
  { id: "trainer_matching", label: "Trainer Matching" },
  { id: "messages", label: "Messages" },
  { id: "events", label: "Events" },
  { id: "notifications", label: "Notifications" },
  { id: "general", label: "General" },
];

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All" },
];

function typeLabel(type: FeedbackType) {
  switch (type) {
    case "bug":
      return "Bug report";
    case "feature":
      return "Feature request";
    case "general":
      return "General feedback";
    case "rating":
      return "Experience rating";
  }
}

function FeedbackCard({
  item,
  onResolve,
  onReopen,
  loading,
}: {
  item: BetaFeedback;
  onResolve: () => void;
  onReopen: () => void;
  loading: boolean;
}) {
  const author = item.user?.display_name ?? "Unknown user";
  const isResolved = item.status === "resolved";

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardType}>{typeLabel(item.type)}</Text>
        <Text style={[styles.badge, isResolved && styles.badgeResolved]}>
          {isResolved ? "Resolved" : "Open"}
        </Text>
      </View>

      {item.type === "rating" && item.rating ? (
        <Text style={styles.stars}>{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</Text>
      ) : null}

      {item.message ? <Text style={styles.message}>{item.message}</Text> : null}

      {item.feature_area ? (
        <Text style={styles.meta}>Area: {item.feature_area.replace(/_/g, " ")}</Text>
      ) : null}
      {item.screen_path ? <Text style={styles.meta}>Screen: {item.screen_path}</Text> : null}
      {item.platform ? (
        <Text style={styles.meta}>
          {item.platform}
          {item.app_version ? ` · v${item.app_version}` : ""}
        </Text>
      ) : null}

      <Text style={styles.meta}>
        {author} · {new Date(item.created_at).toLocaleString()}
      </Text>

      {isResolved ? (
        <Button title="Reopen" variant="secondary" onPress={onReopen} loading={loading} />
      ) : (
        <Button title="Mark resolved" onPress={onResolve} loading={loading} />
      )}
    </View>
  );
}

export default function AdminFeedbackScreen() {
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [areaFilter, setAreaFilter] = useState<AreaFilter>("all");

  const { data: feedback = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-feedback", typeFilter, statusFilter, areaFilter],
    queryFn: () => getAdminFeedback(typeFilter, statusFilter, areaFilter),
    enabled: !!profile?.is_admin,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "resolve" | "reopen" }) => {
      if (action === "resolve") {
        await resolveFeedback(id, userId);
      } else {
        await reopenFeedback(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      showSuccess("Feedback updated");
    },
    onError: (error) => showAlert("Update failed", getErrorMessage(error)),
  });

  if (!profile?.is_admin) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Admin access required"
          description="You don't have permission to view the feedback dashboard."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <Text style={styles.filterLabel}>Type</Text>
        <View style={styles.filterRow}>
          {TYPE_FILTERS.map((filter) => (
            <Pressable
              key={filter.id}
              style={[styles.chip, typeFilter === filter.id && styles.chipActive]}
              onPress={() => setTypeFilter(filter.id)}
            >
              <Text style={[styles.chipText, typeFilter === filter.id && styles.chipTextActive]}>
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.filterLabel}>Status</Text>
        <View style={styles.filterRow}>
          {STATUS_FILTERS.map((filter) => (
            <Pressable
              key={filter.id}
              style={[styles.chip, statusFilter === filter.id && styles.chipActive]}
              onPress={() => setStatusFilter(filter.id)}
            >
              <Text style={[styles.chipText, statusFilter === filter.id && styles.chipTextActive]}>
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.filterLabel}>Feature area</Text>
        <View style={styles.filterRow}>
          {AREA_FILTERS.map((filter) => (
            <Pressable
              key={filter.id}
              style={[styles.chip, areaFilter === filter.id && styles.chipActive]}
              onPress={() => setAreaFilter(filter.id)}
            >
              <Text style={[styles.chipText, areaFilter === filter.id && styles.chipTextActive]}>
                {filter.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={feedback}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No feedback yet"
              description="Beta feedback from users will appear here."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <FeedbackCard
            item={item}
            loading={actionMutation.isPending}
            onResolve={() => actionMutation.mutate({ id: item.id, action: "resolve" })}
            onReopen={() => actionMutation.mutate({ id: item.id, action: "reopen" })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filters: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  filterLabel: { ...typography.caption, color: colors.textMuted, fontWeight: "600" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.surfaceElevated },
  chipText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  chipTextActive: { color: colors.accent },
  list: { padding: spacing.md, flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardType: { ...typography.body, fontWeight: "700", color: colors.accent },
  badge: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: "700",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
  },
  badgeResolved: { color: colors.textMuted },
  stars: { fontSize: 20, color: colors.accent, letterSpacing: 2 },
  message: { ...typography.body, color: colors.text, lineHeight: 22 },
  meta: { ...typography.caption, color: colors.textMuted },
});
