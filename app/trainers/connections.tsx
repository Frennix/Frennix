import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { frennixRefreshControlProps } from '@/lib/screen-shell';
import {
  getTrainerConnectionsEnriched,
  removeTrainerConnection,
  respondTrainerConnection,
  startTrainerConversation,
} from "@frennix/api";
import { TrainerConnectionRow } from "@/components/TrainerConnectionRow";
import { ReportIssueLink } from "@/components/ReportIssueLink";
import { showAlert } from "@/lib/alerts";
import { pushScreen } from "@/lib/press-utils";
import { useAuth } from "@/providers/AuthProvider";
import { EmptyState, colors, spacing } from "@frennix/ui";

export default function TrainerConnectionsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

  const { data: connections = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["trainer-connections", userId],
    queryFn: () => getTrainerConnectionsEnriched(),
    enabled: !!userId,
  });

  const actionMutation = useMutation({
    mutationFn: async (action: { type: string; connectionId: string; otherUserId?: string }) => {
      if (action.type === "accept") return respondTrainerConnection(action.connectionId, true);
      if (action.type === "decline") return respondTrainerConnection(action.connectionId, false);
      if (action.type === "remove") return removeTrainerConnection(action.connectionId);
      if (action.type === "message" && action.otherUserId) {
        return startTrainerConversation(action.otherUserId);
      }
      throw new Error("Unknown action");
    },
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["trainer-connections", userId] });
      if (variables.type === "message" && typeof result === "string") {
        pushScreen(`/chat/${result}`);
      }
    },
    onError: (e) => showAlert("Action failed", e instanceof Error ? e.message : "Something went wrong"),
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={connections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} {...frennixRefreshControlProps} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No trainer connections yet"
              description="Request coaching from a trainer profile or respond to incoming requests here."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const isTrainer = userId === item.trainer_id;
          const other = isTrainer ? item.client : item.trainer;
          const otherUserId = other?.id;

          return (
            <TrainerConnectionRow
              connection={item}
              viewerId={userId}
              loading={actionMutation.isPending}
              onAccept={() => actionMutation.mutate({ type: "accept", connectionId: item.id })}
              onDecline={() => actionMutation.mutate({ type: "decline", connectionId: item.id })}
              onRemove={() => actionMutation.mutate({ type: "remove", connectionId: item.id })}
              onMessage={
                otherUserId
                  ? () =>
                      actionMutation.mutate({
                        type: "message",
                        connectionId: item.id,
                        otherUserId,
                      })
                  : undefined
              }
              onViewProfile={() => {
                if (isTrainer && item.client?.username) pushScreen(`/user/${item.client.username}`);
                else if (!isTrainer && item.trainer?.username) pushScreen(`/trainer/${item.trainer.username}`);
              }}
            />
          );
        }}
      />
      <ReportIssueLink area="trainer_matching" from="/trainers/connections" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
});
