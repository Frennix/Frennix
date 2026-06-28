import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { frennixRefreshControlProps } from '@/lib/screen-shell';
import { getBlockedUsers, unblockUser } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { showSuccess } from "@/lib/alerts";
import { Avatar, Button, EmptyState, colors, spacing, typography } from "@frennix/ui";

export default function BlockedUsersScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

  const { data: blocked = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["blocked-users", userId],
    queryFn: () => getBlockedUsers(userId),
    enabled: !!userId,
  });

  const unblockMutation = useMutation({
    mutationFn: (blockedId: string) => unblockUser(userId, blockedId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-users", userId] });
      showSuccess("User unblocked");
    },
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={blocked}
        keyExtractor={(item) => item.blocked_id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} {...frennixRefreshControlProps} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No blocked users"
              description="Users you block will appear here. You can unblock them at any time."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar
              uri={item.profile?.avatar_url}
              name={item.profile?.display_name}
              size={44}
            />
            <View style={styles.info}>
              <Text style={styles.name}>{item.profile?.display_name ?? "Unknown user"}</Text>
              <Text style={styles.username}>@{item.profile?.username ?? "unknown"}</Text>
            </View>
            <Button
              title="Unblock"
              variant="secondary"
              onPress={() => unblockMutation.mutate(item.blocked_id)}
              loading={unblockMutation.isPending}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, flexGrow: 1, gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  info: { flex: 1, gap: 2 },
  name: { ...typography.body, fontWeight: "600", color: colors.text },
  username: { ...typography.caption, color: colors.textMuted },
});
