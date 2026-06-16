import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { getFeed, toggleLike } from "@frennix/api";
import type { FeedPage } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { usePostOwnerActions } from "@/lib/usePostOwnerActions";
import { useSharePost } from "@/lib/useSharePost";
import { useSavePost } from "@/lib/useSavePost";
import { useModeration } from "@/lib/useModeration";
import { PostActionSheet } from "@/components/PostActionSheet";
import { EmptyState, PostCard, getSharedPostTargetId, colors, spacing } from "@frennix/ui";

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const { openPostActions, actionSheetProps } = usePostOwnerActions({ userId });
  const { openShare, shareSheet } = useSharePost(userId);
  const { toggleSavePost } = useSavePost(userId);
  const { moderationSheets, openPostModeration } = useModeration(userId);

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed", userId],
    queryFn: ({ pageParam }) => getFeed(userId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!userId,
  });

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  const likeMutation = useMutation({
    mutationFn: ({ postId, liked }: { postId: string; liked: boolean }) =>
      toggleLike(postId, userId, liked),
    onMutate: async ({ postId, liked }) => {
      await queryClient.cancelQueries({ queryKey: ["feed", userId] });
      const previous = queryClient.getQueryData<InfiniteData<FeedPage>>(["feed", userId]);

      queryClient.setQueryData<InfiniteData<FeedPage>>(["feed", userId], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((p) =>
              p.id === postId
                ? {
                    ...p,
                    liked_by_me: !liked,
                    like_count: Math.max(0, (p.like_count ?? 0) + (liked ? -1 : 1)),
                  }
                : p
            ),
          })),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["feed", userId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["feed", userId] });
    },
  });

  return (
    <View style={styles.container}>
      <PostActionSheet {...actionSheetProps} />
      {shareSheet}
      {moderationSheets}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
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
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : (
            <EmptyState
              title="Your feed is ready to move"
              description="Follow athletes and join groups to see workout wins, challenges, and community activity."
              actionLabel="Discover people"
              onAction={() => router.push("/(tabs)/discover")}
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
            onLike={() =>
              likeMutation.mutate({ postId: item.id, liked: !!item.liked_by_me })
            }
            onComment={() => router.push(`/post/${getSharedPostTargetId(item)}`)}
            onShare={() => openShare(item.shared_post ?? item)}
            onSave={() => toggleSavePost(item.id, !!item.saved_by_me)}
            onModerationPress={() => openPostModeration(item.id, item.author_id)}
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
});
