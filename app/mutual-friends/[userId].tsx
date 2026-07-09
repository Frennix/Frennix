import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { frennixRefreshControlProps } from "@/lib/screen-shell";
import { getFollowingIds, getMutualFriendsPage } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { UserFollowRow } from "@/components/UserFollowRow";
import { UserFollowListSkeleton } from "@/components/UserFollowListSkeleton";
import { EmptyState, colors, spacing } from "@frennix/ui";

const PAGE_SIZE = 30;

export default function MutualFriendsScreen() {
  const { userId: targetUserId } = useLocalSearchParams<{ userId: string }>();
  const { session } = useAuth();
  const currentUserId = session?.user.id ?? "";

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["mutual-friends", currentUserId, targetUserId],
    queryFn: ({ pageParam = 0 }) =>
      getMutualFriendsPage(currentUserId, targetUserId!, {
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length * PAGE_SIZE : undefined,
    enabled: !!currentUserId && !!targetUserId,
  });

  const profiles = data?.pages.flatMap((page) => page.items) ?? [];

  const { data: followingIds = [] } = useQuery({
    queryKey: ["following-ids", currentUserId],
    queryFn: () => getFollowingIds(currentUserId),
    enabled: !!currentUserId,
  });

  const followingSet = new Set(followingIds);

  if (!currentUserId) {
    return (
      <View style={styles.container}>
        <EmptyState
          title="Sign in required"
          description="Sign in to view mutual friends."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={profiles}
        keyExtractor={(profile) => profile.id}
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
            <UserFollowListSkeleton />
          ) : (
            <EmptyState
              title="No mutual friends"
              description="You don't share any friends with this athlete yet."
            />
          )
        }
        renderItem={({ item }) => (
          <UserFollowRow
            profile={item}
            currentUserId={currentUserId}
            isFollowing={followingSet.has(item.id)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, flexGrow: 1 },
});
