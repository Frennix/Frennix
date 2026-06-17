import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { getFeed, getFeedStories, toggleLike } from "@frennix/api";
import type { FeedPage, FeedStory } from "@frennix/types";
import { useAuth } from "@/providers/AuthProvider";
import { FeedHeader } from "@/components/FeedHeader";
import { FeedStoryViewer } from "@/components/FeedStoryViewer";
import { usePostOwnerActions } from "@/lib/usePostOwnerActions";
import { useSharePost } from "@/lib/useSharePost";
import { useSavePost } from "@/lib/useSavePost";
import { usePostReaction } from "@/lib/usePostReaction";
import { useModeration } from "@/lib/useModeration";
import { PostActionSheet } from "@/components/PostActionSheet";
import { EmptyState, FeedPostCard, getSharedPostTargetId, colors, spacing } from "@frennix/ui";

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const queryClient = useQueryClient();
  const [activeStory, setActiveStory] = useState<FeedStory | null>(null);
  const { openPostActions, actionSheetProps } = usePostOwnerActions({ userId });
  const { openShare, shareSheet } = useSharePost(userId);
  const { toggleSavePost } = useSavePost(userId);
  const postReaction = usePostReaction(userId);
  const { moderationSheets, openPostModeration } = useModeration(userId);

  const {
    data: stories = [],
    refetch: refetchStories,
    isRefetching: isStoriesRefetching,
  } = useQuery({
    queryKey: ["feed-stories", userId],
    queryFn: () => getFeedStories(userId),
    enabled: !!userId,
  });

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

  async function handleRefresh() {
    await Promise.all([refetch(), refetchStories()]);
  }

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
      <FeedStoryViewer
        story={activeStory}
        visible={Boolean(activeStory)}
        onClose={() => setActiveStory(null)}
        onViewProfile={(username) => {
          setActiveStory(null);
          router.push(`/user/${username}`);
        }}
        onViewPost={(postId) => {
          setActiveStory(null);
          router.push(`/post/${postId}`);
        }}
        onShareWorkout={() => {
          setActiveStory(null);
          router.push("/create-post");
        }}
      />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching || isStoriesRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <FeedHeader stories={stories} onStoryPress={(story) => setActiveStory(story)} />
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={colors.accent} style={styles.footer} />
          ) : (
            <View style={styles.emptyWrap}>
              <EmptyState
                title="Your feed is ready"
                description="Follow athletes, join groups, or share your first workout photo, video, or progress update."
                actionLabel="Share a workout"
                onAction={() => router.push("/create-post")}
              />
            </View>
          )
        }
        renderItem={({ item }) => (
          <FeedPostCard
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
            onReaction={(emoji) =>
              postReaction.mutate({
                postId: item.id,
                emoji,
                currentEmoji: item.my_reaction,
              })
            }
            onModerationPress={() => openPostModeration(item.id, item.author_id)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flexGrow: 1, paddingBottom: spacing.xl },
  emptyWrap: { padding: spacing.lg },
  footer: { paddingVertical: spacing.lg },
});
