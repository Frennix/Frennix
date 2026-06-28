import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { frennixRefreshControlProps } from "@/lib/screen-shell";
import { getSavedPosts } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { usePostActions } from "@/lib/usePostActions";
import { useSavePost } from "@/lib/useSavePost";
import { useSharePost } from "@/lib/useSharePost";
import { EmptyState, FeedPostCardSkeleton, PostCard, getSharedPostTargetId, colors, spacing } from "@frennix/ui";

export default function SavedPostsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const { openShare, shareSheet } = useSharePost(userId);
  const { openPostActions, postActionSheets } = usePostActions({
    userId,
    onShareInApp: (post) => openShare(post.shared_post ?? post),
  });
  const { toggleSavePost } = useSavePost(userId);

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["saved-posts", userId],
    queryFn: ({ pageParam }) => getSavedPosts(userId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!userId,
  });

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <View style={styles.container}>
      {postActionSheets}
      {shareSheet}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} {...frennixRefreshControlProps} />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.initialSkeletons}>
              <FeedPostCardSkeleton />
              <FeedPostCardSkeleton />
              <FeedPostCardSkeleton />
            </View>
          ) : (
            <EmptyState
              title="No saved posts yet"
              description="Tap Save on any workout post to bookmark it here for quick access."
              actionLabel="Browse feed"
              onAction={() => router.push("/(tabs)")}
            />
          )
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            isOwn={item.author_id === userId}
            onOwnerActionsPress={() => openPostActions(item)}
            onPress={() => router.push(`/post/${getSharedPostTargetId(item)}`)}
            onAuthorPress={() => item.author && router.push(`/user/${item.author.username}`)}
            onComment={() => router.push(`/post/${getSharedPostTargetId(item)}`)}
            onShare={() => openShare(item.shared_post ?? item)}
            onSave={() => toggleSavePost(item.id, !!item.saved_by_me)}
            onModerationPress={() => openPostActions(item)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, flexGrow: 1 },
  footer: { paddingVertical: spacing.lg },
  initialSkeletons: { gap: 0 },
});
