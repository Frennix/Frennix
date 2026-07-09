import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { frennixRefreshControlProps } from "@/lib/screen-shell";
import { getFriendRequestsPage } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { useAcceptFriendRequest, useDeclineFriendRequest } from "@/lib/useFriendUser";
import { avatarDisplayUri } from "@/lib/avatar";
import { CachedImage, EmptyState, colors, radius, spacing, typography } from "@frennix/ui";

const PAGE_SIZE = 20;

export default function FriendRequestsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["friend-requests", userId],
    queryFn: ({ pageParam = 0 }) =>
      getFriendRequestsPage(userId, "incoming", { limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length * PAGE_SIZE : undefined,
    enabled: !!userId,
  });

  const acceptMutation = useAcceptFriendRequest(userId);
  const declineMutation = useDeclineFriendRequest(userId);
  const requests = data?.pages.flatMap((page) => page.items) ?? [];

  if (!userId) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Sign in required"
          description="Sign in to view friend requests."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} {...frennixRefreshControlProps} />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          isLoading ? (
            <Text style={styles.loading}>Loading requests…</Text>
          ) : (
            <EmptyState
              title="No friend requests"
              description="When someone sends you a friend request, it will show up here."
            />
          )
        }
        renderItem={({ item }) => {
          const avatarUri = avatarDisplayUri(item.profile.avatar_url, item.profile.updated_at);
          return (
            <View style={styles.row}>
              <Pressable
                style={styles.identity}
                onPress={() => router.push(`/user/${item.profile.username}`)}
              >
                <CachedImage uri={avatarUri} style={styles.avatar} />
                <View style={styles.textBlock}>
                  <Text style={styles.name}>{item.profile.display_name}</Text>
                  <Text style={styles.username}>@{item.profile.username}</Text>
                </View>
              </Pressable>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.actionBtn, styles.acceptBtn]}
                  onPress={() => acceptMutation.mutate(item.profile.id)}
                >
                  <Text style={styles.acceptText}>Accept</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, styles.declineBtn]}
                  onPress={() => declineMutation.mutate(item.profile.id)}
                >
                  <Text style={styles.declineText}>Decline</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, flexGrow: 1, gap: spacing.sm },
  loading: { ...typography.body, color: colors.textMuted, textAlign: "center", padding: spacing.lg },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceElevated },
  textBlock: { flex: 1 },
  name: { ...typography.body, fontWeight: "700", color: colors.text },
  username: { ...typography.caption, color: colors.textMuted },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  acceptBtn: { backgroundColor: colors.accent },
  acceptText: { ...typography.bodySmall, color: colors.white, fontWeight: "700" },
  declineBtn: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  declineText: { ...typography.bodySmall, color: colors.text, fontWeight: "600" },
});
