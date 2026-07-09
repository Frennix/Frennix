import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { frennixRefreshControlProps } from "@/lib/screen-shell";
import { getFollowingIds, getFriendsPage } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { UserFollowRow } from "@/components/UserFollowRow";
import { UserFollowListSkeleton } from "@/components/UserFollowListSkeleton";
import { EmptyState, colors, spacing } from "@frennix/ui";

const PAGE_SIZE = 30;

export default function FriendsScreen() {
  const { userId: profileUserId } = useLocalSearchParams<{ userId: string }>();
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
    queryKey: ["friends", profileUserId, currentUserId],
    queryFn: ({ pageParam = 0 }) =>
      getFriendsPage(profileUserId!, {
        viewerId: currentUserId || undefined,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length * PAGE_SIZE : undefined,
    enabled: !!profileUserId,
  });

  const friends = data?.pages.flatMap((page) => page.items) ?? [];

  const { data: followingIds = [] } = useQuery({
    queryKey: ["following-ids", currentUserId],
    queryFn: () => getFollowingIds(currentUserId),
    enabled: !!currentUserId,
  });

  const followingSet = new Set(followingIds);

  return (
    <View style={styles.container}>
      <FlatList
        data={friends}
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
              title="No friends yet"
              description="Friends appear here when you connect on Frennix."
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
