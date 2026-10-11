import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent, ViewToken } from "react-native";
import type { Post } from "@frennix/types";
import { buildFeedListRows, type FeedListRow } from "@/lib/feed-list-rows";
import { prefetchPostImages } from "@/lib/prefetch-post-images";

/** Start fetching the next page this many viewport-heights before the list end. */
const PREFETCH_VIEWPORT_MULTIPLIER = 3;
/** Activate media for rows this many indices ahead of the last visible post. */
const MEDIA_LOOKAHEAD_ITEMS = 8;
/** First screen of an iPhone feed is one tall post plus the next row. */
const PRIORITY_INITIAL_POSTS = 2;
const MEDIA_LOOKBEHIND_ITEMS = 2;
/** Wait before auto-fetching page 2 so the first screen can render first. */
const AUTO_PAGE_TWO_DELAY_MS = 2500;

type UseFeedInfiniteScrollOptions = {
  posts: Post[];
  /** Resets media visibility and page prefetch when the feed filter changes. */
  scopeKey?: string;
  pageCount: number;
  isFeedReady: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  onScrollBase: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

export function useFeedInfiniteScroll({
  posts,
  scopeKey = "all",
  pageCount,
  isFeedReady,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onScrollBase,
}: UseFeedInfiniteScrollOptions) {
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const [nearEnd, setNearEnd] = useState(false);
  const [visiblePostIds, setVisiblePostIds] = useState<Set<string>>(() => new Set());
  const [priorityPostIds, setPriorityPostIds] = useState<Set<string>>(() => new Set());
  const nearEndRef = useRef(false);
  const fetchInFlightRef = useRef(false);
  const seededInitialPostsRef = useRef(false);
  const autoPageTwoRequestedRef = useRef(false);
  const prefetchedPageCountRef = useRef(0);

  useEffect(() => {
    seededInitialPostsRef.current = false;
    autoPageTwoRequestedRef.current = false;
    nearEndRef.current = false;
    prefetchedPageCountRef.current = 0;
    setNearEnd(false);
    setVisiblePostIds(new Set());
    setPriorityPostIds(new Set());
  }, [scopeKey]);

  // FlatList viewability often does not fire on first paint (especially Safari web).
  // Seed the first screen of posts so feed media mounts immediately.
  useEffect(() => {
    if (seededInitialPostsRef.current || posts.length === 0) return;
    seededInitialPostsRef.current = true;

    setVisiblePostIds((prev) => {
      const next = new Set(prev);
      const end = Math.min(posts.length - 1, MEDIA_LOOKAHEAD_ITEMS);
      for (let i = 0; i <= end; i++) {
        next.add(posts[i].id);
      }
      return next;
    });
    setPriorityPostIds((prev) => {
      const next = new Set(prev);
      const end = Math.min(posts.length, PRIORITY_INITIAL_POSTS);
      for (let i = 0; i < end; i++) {
        next.add(posts[i].id);
      }
      return next;
    });
    prefetchPostImages(posts.slice(0, PRIORITY_INITIAL_POSTS), PRIORITY_INITIAL_POSTS);
  }, [posts]);

  const requestNextPage = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    void fetchNextPage().finally(() => {
      fetchInFlightRef.current = false;
    });
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Buffer a second page after the first page renders — not immediately on fetch success.
  useEffect(() => {
    if (!isFeedReady || !hasNextPage || pageCount !== 1 || autoPageTwoRequestedRef.current) return;

    const timer = setTimeout(() => {
      autoPageTwoRequestedRef.current = true;
      requestNextPage();
    }, AUTO_PAGE_TWO_DELAY_MS);

    return () => clearTimeout(timer);
  }, [hasNextPage, isFeedReady, pageCount, requestNextPage]);

  // Keep fetching while the user is near the bottom and more pages exist.
  useEffect(() => {
    if (!nearEnd || !hasNextPage) return;
    requestNextPage();
  }, [nearEnd, hasNextPage, isFetchingNextPage, requestNextPage]);

  // Prefetch images for newly loaded tail posts.
  useEffect(() => {
    if (pageCount <= prefetchedPageCountRef.current) return;
    prefetchedPageCountRef.current = pageCount;
    const tail = posts.slice(-12);
    prefetchPostImages(tail, 8);
  }, [pageCount, posts]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScrollBase(event);

      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
      if (layoutMeasurement.height <= 0 || contentSize.height <= 0) return;

      const distanceFromEnd = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      const prefetchDistance = layoutMeasurement.height * PREFETCH_VIEWPORT_MULTIPLIER;
      const isNearEnd = distanceFromEnd <= prefetchDistance;

      if (isNearEnd !== nearEndRef.current) {
        nearEndRef.current = isNearEnd;
        setNearEnd(isNearEnd);
      }

      if (isNearEnd) {
        autoPageTwoRequestedRef.current = true;
        requestNextPage();
      }
    },
    [onScrollBase, requestNextPage]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 5,
    minimumViewTime: 50,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<FeedListRow>[] }) => {
      const currentPosts = postsRef.current;
      const next = new Set<string>();

      for (const entry of viewableItems) {
        if (!entry.isViewable || entry.item?.kind !== "post") continue;

        const postIndex = currentPosts.findIndex((post) => post.id === entry.item.post.id);
        if (postIndex < 0) continue;

        const start = Math.max(0, postIndex - MEDIA_LOOKBEHIND_ITEMS);
        const end = Math.min(currentPosts.length - 1, postIndex + MEDIA_LOOKAHEAD_ITEMS);

        for (let i = start; i <= end; i++) {
          next.add(currentPosts[i].id);
        }
      }

      setVisiblePostIds((prev) => {
        if (prev.size === next.size && [...next].every((id) => prev.has(id))) return prev;
        return next;
      });

      const visiblePosts = viewableItems
        .filter((entry) => entry.isViewable && entry.item?.kind === "post")
        .map((entry) => (entry.item as Extract<FeedListRow, { kind: "post" }>).post);

      if (visiblePosts.length) {
        prefetchPostImages(visiblePosts, 6);
      }

      const priority = new Set<string>();
      for (const entry of viewableItems) {
        if (!entry.isViewable || entry.item?.kind !== "post") continue;
        priority.add(entry.item.post.id);
      }
      if (priority.size) {
        setPriorityPostIds(priority);
      }
    }
  ).current;

  const resolvedPriorityPostIds = useMemo(() => {
    const stillOnScreen = posts.some((post) => priorityPostIds.has(post.id));
    if (priorityPostIds.size > 0 && stillOnScreen) return priorityPostIds;
    const next = new Set<string>();
    const end = Math.min(posts.length, PRIORITY_INITIAL_POSTS);
    for (let i = 0; i < end; i++) next.add(posts[i].id);
    return next;
  }, [posts, priorityPostIds]);

  const showTrailingSkeletons = hasNextPage && (nearEnd || isFetchingNextPage);

  const listRows = useMemo(
    () =>
      buildFeedListRows(posts, {
        hasNextPage,
        showTrailingSkeletons,
        skeletonCount: isFetchingNextPage ? 4 : 3,
      }),
    [hasNextPage, isFetchingNextPage, nearEnd, posts]
  );

  return {
    listRows,
    handleScroll,
    onViewableItemsChanged,
    viewabilityConfig,
    visiblePostIds,
    priorityPostIds: resolvedPriorityPostIds,
  };
}
