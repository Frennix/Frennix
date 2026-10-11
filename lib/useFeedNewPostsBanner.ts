import { useIsFocused } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { getFeed } from "@frennix/api";
import type { FeedCategory, Post } from "@frennix/types";
import { countNewFeedPosts, currentFeedPeekGeneration, removedFeedPostIdsSnapshot } from "@/lib/feed-new-posts";

const PEEK_INTERVAL_MS = 45_000;
const PEEK_AT_TOP_INTERVAL_MS = 90_000;

type UseFeedNewPostsBannerOptions = {
  userId: string;
  posts: Post[];
  /** When set, peek the same category the visible tab is showing. */
  feedCategory?: FeedCategory | null;
  atTop: boolean;
  enabled?: boolean;
  /** When the user is at the top and new posts arrive, refresh in place (no banner). */
  onNewPostsWhileAtTop?: () => void;
};

export function useFeedNewPostsBanner({
  userId,
  posts,
  feedCategory = null,
  atTop,
  enabled = true,
  onNewPostsWhileAtTop,
}: UseFeedNewPostsBannerOptions) {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const [newPostCount, setNewPostCount] = useState(0);
  const postsRef = useRef(posts);
  postsRef.current = posts;
  const feedCategoryRef = useRef(feedCategory);
  feedCategoryRef.current = feedCategory;
  const atTopRef = useRef(atTop);
  atTopRef.current = atTop;
  const onNewPostsWhileAtTopRef = useRef(onNewPostsWhileAtTop);
  onNewPostsWhileAtTopRef.current = onNewPostsWhileAtTop;

  const peekNewPosts = useCallback(async () => {
    if (!userId || !enabled || postsRef.current.length === 0) return;

    const generation = currentFeedPeekGeneration();
    const requestedCategory = feedCategory;
    try {
      const head = await queryClient.fetchQuery({
        queryKey: ["feed-head-peek", userId, feedCategory ?? "all"],
        queryFn: () =>
          getFeed(userId, undefined, undefined, feedCategory ? { feedCategory } : undefined),
        staleTime: 0,
      });
      if (generation !== currentFeedPeekGeneration() || requestedCategory !== feedCategoryRef.current) return;
      const count = countNewFeedPosts(postsRef.current, head.posts, {
        viewerId: userId,
        removedIds: removedFeedPostIdsSnapshot(),
        feedCategory,
      });
      if (atTopRef.current) {
        if (count > 0) onNewPostsWhileAtTopRef.current?.();
        setNewPostCount(0);
        return;
      }
      setNewPostCount((prev) => (prev === count ? prev : count));
    } catch {
      // Silent — banner is optional; pull-to-refresh remains the fallback.
    }
  }, [enabled, feedCategory, queryClient, userId]);

  useEffect(() => {
    setNewPostCount(0);
  }, [feedCategory, userId]);

  useEffect(() => {
    if (!enabled || !isFocused) return;
    if (atTop) setNewPostCount(0);
  }, [atTop, enabled, isFocused, posts[0]?.id]);

  useEffect(() => {
    if (!enabled || !isFocused || !userId || posts.length === 0) return;

    const intervalMs = atTop ? PEEK_AT_TOP_INTERVAL_MS : PEEK_INTERVAL_MS;
    void peekNewPosts();

    const timer = setInterval(() => {
      void peekNewPosts();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [atTop, enabled, isFocused, peekNewPosts, posts.length, posts[0]?.id, userId]);

  const clearBanner = useCallback(() => {
    setNewPostCount(0);
  }, []);

  return {
    newPostCount,
    showBanner: newPostCount > 0 && !atTop,
    clearBanner,
  };
}
