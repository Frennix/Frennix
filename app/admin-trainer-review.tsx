import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  getPendingTrainerCertifications,
  reviewTrainerCertification,
  setTrainerVerificationLevel,
} from "@frennix/api";
import type { TrainerVerificationLevel } from "@frennix/types";
import { TrainerBadge } from "@/components/TrainerBadge";
import { useAuth } from "@/providers/AuthProvider";
import { showAlert } from "@/lib/alerts";
import { pushScreen } from "@/lib/press-utils";
import { Button, EmptyState, colors, spacing, typography } from "@frennix/ui";

export default function AdminTrainerReviewScreen() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-trainer-certs"],
    queryFn: getPendingTrainerCertifications,
    enabled: !!profile?.is_admin,
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      certId,
      status,
    }: {
      certId: string;
      status: "approved" | "rejected";
    }) => reviewTrainerCertification(certId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-trainer-certs"] }),
    onError: (e) => showAlert("Review failed", e instanceof Error ? e.message : "Could not review"),
  });

  const featuredMutation = useMutation({
    mutationFn: ({
      trainerId,
      level,
    }: {
      trainerId: string;
      level: TrainerVerificationLevel;
    }) => setTrainerVerificationLevel(trainerId, level),
    onSuccess: () => showAlert("Updated", "Trainer verification level updated."),
    onError: (e) => showAlert("Update failed", e instanceof Error ? e.message : "Could not update"),
  });

  if (!profile?.is_admin) {
    return (
      <EmptyState title="Admin only" description="You do not have access to trainer certification review." />
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trainer certification review</Text>
      <FlatList
        data={pending}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState title="No pending certifications" description="All caught up." />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.certName}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.trainer?.display_name ?? "Trainer"} · {item.issuer ?? "Unknown issuer"}
            </Text>
            {item.trainer?.username ? (
              <Pressable onPress={() => pushScreen(`/trainer/${item.trainer!.username}`)}>
                <Text style={styles.link}>View trainer profile</Text>
              </Pressable>
            ) : null}
            <View style={styles.actions}>
              <Button
                title="Approve"
                onPress={() => reviewMutation.mutate({ certId: item.id, status: "approved" })}
                loading={reviewMutation.isPending}
              />
              <Button
                title="Reject"
                variant="secondary"
                onPress={() => reviewMutation.mutate({ certId: item.id, status: "rejected" })}
                disabled={reviewMutation.isPending}
              />
              <Button
                title="Set Featured"
                variant="secondary"
                onPress={() =>
                  featuredMutation.mutate({ trainerId: item.trainer_id, level: "featured" })
                }
              />
            </View>
            <TrainerBadge level="verified" compact />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { ...typography.heading, fontSize: 18, marginBottom: spacing.md },
  list: { gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  certName: { ...typography.body, fontWeight: "700" },
  meta: { ...typography.caption, color: colors.textMuted },
  link: { ...typography.body, color: colors.accent },
  actions: { gap: spacing.xs },
});
