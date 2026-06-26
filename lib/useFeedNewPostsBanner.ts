import { useIsFocused } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { getFeed } from "@frennix/api";
import type { Post } from "@frennix/types";
import { countNewFeedPosts } from "@/lib/feed-new-posts";

const PEEK_INTERVAL_MS = 45_000;
const PEEK_AT_TOP_INTERVAL_MS = 90_000;

type UseFeedNewPostsBannerOptions = {
  userId: string;
  posts: Post[];
  atTop: boolean;
  enabled?: boolean;
  /** When the user is at the top and new posts arrive, refresh in place (no banner). */
  onNewPostsWhileAtTop?: () => void;
};

export function useFeedNewPostsBanner({
  userId,
  posts,
  atTop,
  enabled = true,
  onNewPostsWhileAtTop,
}: UseFeedNewPostsBannerOptions) {
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const [newPostCount, setNewPostCount] = useState(0);
  const postsRef = useRef(posts);
  postsRef.current = posts;
  const atTopRef = useRef(atTop);
  atTopRef.current = atTop;
  const onNewPostsWhileAtTopRef = useRef(onNewPostsWhileAtTop);
  onNewPostsWhileAtTopRef.current = onNewPostsWhileAtTop;

  const peekNewPosts = useCallback(async () => {
    if (!userId || !enabled || postsRef.current.length === 0) return;

    try {
      const head = await queryClient.fetchQuery({
        queryKey: ["feed-head-peek", userId],
        queryFn: () => getFeed(userId),
        staleTime: 20_000,
      });
      const count = countNewFeedPosts(postsRef.current, head.posts);
      if (atTopRef.current) {
        if (count > 0) onNewPostsWhileAtTopRef.current?.();
        setNewPostCount(0);
        return;
      }
      setNewPostCount((prev) => (prev === count ? prev : count));
    } catch {
      // Silent — banner is optional; pull-to-refresh remains the fallback.
    }
  }, [enabled, queryClient, userId]);

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
  }, [atTop, enabled, isFocused, peekNewPosts, posts.length, userId]);

  const clearBanner = useCallback(() => {
    setNewPostCount(0);
  }, []);

  return {
    newPostCount,
    showBanner: newPostCount > 0 && !atTop,
    clearBanner,
  };
}
