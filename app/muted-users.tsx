import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { getMutedUsers, unmuteUser } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { frennixRefreshControlProps } from "@/lib/screen-shell";
import { showAlert, showSuccess } from "@/lib/alerts";
import { getErrorMessage } from "@frennix/api";
import { Avatar, Button, EmptyState, colors, spacing, typography } from "@frennix/ui";

export default function MutedUsersScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();

  const { data: muted = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["muted-users", userId],
    queryFn: () => getMutedUsers(userId),
    enabled: !!userId,
  });

  const unmuteMutation = useMutation({
    mutationFn: (mutedId: string) => unmuteUser(userId, mutedId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["muted-users"] });
      showSuccess("User unmuted");
    },
    onError: (error) => showAlert("Could not unmute", getErrorMessage(error)),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        Muted users won't appear in your feed, stories, or notifications. You can unmute anytime.
      </Text>
      <FlatList
        data={muted}
        keyExtractor={(item) => item.muted_id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} {...frennixRefreshControlProps} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="No muted users"
              description="Mute someone from their profile or a post menu to hide their content without blocking."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar
              uri={item.profile?.avatar_url}
              name={item.profile?.display_name ?? "User"}
              size={44}
            />
            <View style={styles.meta}>
              <Text style={styles.name}>{item.profile?.display_name ?? "User"}</Text>
              <Text style={styles.flags}>
                {[
                  item.mute_posts && "Posts",
                  item.mute_stories && "Stories",
                  item.mute_notifications && "Notifications",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            <Button
              title="Unmute"
              variant="secondary"
              onPress={() => unmuteMutation.mutate(item.muted_id)}
              loading={unmuteMutation.isPending}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    ...typography.bodySmall,
    color: colors.textMuted,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  list: { padding: spacing.md, flexGrow: 1, gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  meta: { flex: 1, gap: 2 },
  name: { ...typography.body, fontWeight: "600" },
  flags: { ...typography.caption, color: colors.textMuted },
});
