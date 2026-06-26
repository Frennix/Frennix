import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent, ViewToken } from "react-native";
import type { Post } from "@frennix/types";
import { buildFeedListRows, type FeedListRow } from "@/lib/feed-list-rows";
import { prefetchPostImages } from "@/lib/prefetch-post-images";

/** Start fetching the next page this many viewport-heights before the list end. */
const PREFETCH_VIEWPORT_MULTIPLIER = 3;
/** Activate media for rows this many indices ahead of the last visible post. */
const MEDIA_LOOKAHEAD_ITEMS = 12;
const MEDIA_LOOKBEHIND_ITEMS = 2;

type UseFeedInfiniteScrollOptions = {
  posts: Post[];
  pageCount: number;
  isFeedReady: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  onScrollBase: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

export function useFeedInfiniteScroll({
  posts,
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
  const nearEndRef = useRef(false);
  const fetchInFlightRef = useRef(false);

  const requestNextPage = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage || fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    void fetchNextPage().finally(() => {
      fetchInFlightRef.current = false;
    });
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Buffer a second page as soon as the first page arrives.
  useEffect(() => {
    if (!isFeedReady || !hasNextPage || pageCount !== 1) return;
    requestNextPage();
  }, [hasNextPage, isFeedReady, pageCount, requestNextPage]);

  // Keep fetching while the user is near the bottom and more pages exist.
  useEffect(() => {
    if (!nearEnd || !hasNextPage) return;
    requestNextPage();
  }, [nearEnd, hasNextPage, isFetchingNextPage, requestNextPage]);

  // Prefetch images for newly loaded tail posts.
  const prefetchedPageCountRef = useRef(0);
  useEffect(() => {
    if (pageCount <= prefetchedPageCountRef.current) return;
    prefetchedPageCountRef.current = pageCount;
    const tail = posts.slice(-20);
    prefetchPostImages(tail, 20);
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
        prefetchPostImages(visiblePosts, 10);
      }
    }
  ).current;

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
  };
}
