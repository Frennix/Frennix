import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import type { Post } from "@frennix/types";
import type { FeedVideoFullscreenHandoff } from "@frennix/ui";
import { colors, spacing, typography } from "@frennix/ui";
import { ImmersiveVideoViewer } from "@/components/ImmersiveVideoViewer";
import type { ImmersiveVideoGalleryContext } from "@/lib/immersive-video-gallery";
import {
  mergeUniquePlaylistEntries,
  type ImmersiveVideoPlaylistEntry,
} from "@/lib/immersive-video-playlist";
import type { ImmersiveVideoPlaylistFetchResult } from "@/lib/immersive-video-playlist-state";

type ImmersiveVideoPlaylistViewerProps = {
  entries: ImmersiveVideoPlaylistEntry[];
  initialIndex: number;
  initialHandoff?: FeedVideoFullscreenHandoff;
  initialHandoffPlaybackId?: string;
  stageWidth: number;
  stageHeight: number;
  getPost: (postId: string) => Post | undefined;
  buildImmersiveContext: (post: Post) => ImmersiveVideoGalleryContext | undefined;
  hasMore: boolean;
  fetchMore?: () => Promise<ImmersiveVideoPlaylistFetchResult>;
  onClose: () => void;
  onActiveEntryChange?: (entry: { postId: string; mediaIndex: number }) => void;
};

const PRELOAD_RADIUS = 1;
const FETCH_AHEAD_SLIDE_COUNT = 2;

function clampIndex(value: number, max: number) {
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

export function ImmersiveVideoPlaylistViewer({
  entries: initialEntries,
  initialIndex,
  initialHandoff,
  initialHandoffPlaybackId,
  stageWidth,
  stageHeight,
  getPost,
  buildImmersiveContext,
  hasMore: initialHasMore,
  fetchMore,
  onClose,
  onActiveEntryChange,
}: ImmersiveVideoPlaylistViewerProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [showEndState, setShowEndState] = useState(false);
  const handoffAppliedRef = useRef(false);
  const fetchInFlightRef = useRef(false);
  const webScrollRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<FlatList<ImmersiveVideoPlaylistEntry>>(null);

  useEffect(() => {
    setEntries(initialEntries);
    setActiveIndex(initialIndex);
    setHasMore(initialHasMore);
    handoffAppliedRef.current = false;
  }, [initialEntries, initialHasMore, initialIndex]);

  const shouldRenderIndex = useCallback(
    (index: number) => Math.abs(index - activeIndex) <= PRELOAD_RADIUS,
    [activeIndex]
  );

  const requestFetchMore = useCallback(async () => {
    if (!fetchMore || !hasMore || fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    setFetchingMore(true);
    try {
      const result = await fetchMore();
      setEntries((current) => mergeUniquePlaylistEntries(current, result.entries));
      setHasMore(result.hasMore);
      if (!result.hasMore && result.entries.length === 0) {
        setShowEndState(true);
      }
    } finally {
      fetchInFlightRef.current = false;
      setFetchingMore(false);
    }
  }, [fetchMore, hasMore]);

  useEffect(() => {
    if (activeIndex >= entries.length - FETCH_AHEAD_SLIDE_COUNT) {
      void requestFetchMore();
    }
    if (!hasMore && activeIndex === entries.length - 1 && entries.length > 0) {
      setShowEndState(true);
    } else if (activeIndex < entries.length - 1) {
      setShowEndState(false);
    }
  }, [activeIndex, entries.length, hasMore, requestFetchMore]);

  useEffect(() => {
    const entry = entries[activeIndex];
    if (!entry) return;
    onActiveEntryChange?.({ postId: entry.postId, mediaIndex: entry.mediaIndex });
  }, [activeIndex, entries, onActiveEntryChange]);

  const handleIndexChange = useCallback(
    (nextIndex: number) => {
      const clamped = clampIndex(nextIndex, entries.length - 1);
      setActiveIndex((current) => (current === clamped ? current : clamped));
    },
    [entries.length]
  );

  const handleNativeScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!stageHeight) return;
      const nextIndex = Math.round(event.nativeEvent.contentOffset.y / stageHeight);
      handleIndexChange(nextIndex);
    },
    [handleIndexChange, stageHeight]
  );

  const handleWebScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (!stageHeight) return;
      const nextIndex = Math.round(event.currentTarget.scrollTop / stageHeight);
      handleIndexChange(nextIndex);
    },
    [handleIndexChange, stageHeight]
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !webScrollRef.current || !stageHeight) return;
    webScrollRef.current.scrollTop = initialIndex * stageHeight;
  }, [initialIndex, stageHeight]);

  const renderSlide = useCallback(
    (entry: ImmersiveVideoPlaylistEntry, slideIndex: number) => {
      const post = getPost(entry.postId);
      const immersiveContext = post ? buildImmersiveContext(post) : undefined;
      const isActive = slideIndex === activeIndex;
      const shouldRender = shouldRenderIndex(slideIndex);

      if (!shouldRender || !post || !immersiveContext?.postActions) {
        return (
          <View
            style={[styles.slideShell, { width: stageWidth, height: stageHeight }]}
            {...(Platform.OS === "web"
              ? ({ "data-frennix-video-playlist-slide": "placeholder" } as object)
              : null)}
          />
        );
      }

      const canApplyHandoff =
        !handoffAppliedRef.current &&
        Boolean(initialHandoff) &&
        entry.playbackId === initialHandoffPlaybackId &&
        isActive;

      const playbackHandoff = canApplyHandoff ? initialHandoff : undefined;
      if (canApplyHandoff) {
        handoffAppliedRef.current = true;
      }

      return (
        <View
          style={[styles.slideShell, { width: stageWidth, height: stageHeight }]}
          {...(Platform.OS === "web"
            ? ({
                "data-frennix-video-playlist-slide": isActive ? "active" : "inactive",
              } as object)
            : null)}
        >
          <ImmersiveVideoViewer
            item={entry.item}
            mediaIndex={entry.mediaIndex}
            stageWidth={stageWidth}
            stageHeight={stageHeight}
            isActive={isActive}
            playbackHandoff={playbackHandoff}
            postActions={immersiveContext.postActions}
            onClose={onClose}
          />
        </View>
      );
    },
    [
      activeIndex,
      buildImmersiveContext,
      getPost,
      initialHandoff,
      initialHandoffPlaybackId,
      onClose,
      shouldRenderIndex,
      stageHeight,
      stageWidth,
    ]
  );

  const footer = useMemo(() => {
    if (fetchingMore) {
      return (
        <View style={[styles.footer, { height: stageHeight * 0.18 }]}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      );
    }
    if (showEndState && !hasMore) {
      return (
        <View style={[styles.footer, styles.endState, { minHeight: stageHeight * 0.18 }]}>
          <Text style={styles.endStateText}>You're caught up on feed videos</Text>
        </View>
      );
    }
    return null;
  }, [fetchingMore, hasMore, showEndState, stageHeight]);

  if (Platform.OS === "web") {
    return (
      <View
        style={[styles.root, { width: stageWidth, height: stageHeight }]}
        {...({
          nativeID: "frennix-immersive-video-playlist",
          "data-frennix-immersive-video-playlist": "true",
        } as object)}
      >
        <div
          ref={webScrollRef}
          className="frennix-immersive-video-playlist-scroll"
          onScroll={handleWebScroll}
          style={{
            width: stageWidth,
            height: stageHeight,
            overflowY: "scroll",
            scrollSnapType: "y mandatory",
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
            touchAction: "pan-y",
            backgroundColor: colors.background,
          }}
        >
          {entries.map((entry, slideIndex) => (
            <div
              key={entry.playbackId}
              style={{
                width: stageWidth,
                height: stageHeight,
                scrollSnapAlign: "start",
                scrollSnapStop: "always",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {renderSlide(entry, slideIndex)}
            </div>
          ))}
          {footer ? (
            <div
              style={{
                width: stageWidth,
                scrollSnapAlign: "start",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </View>
    );
  }

  return (
    <View style={[styles.root, { width: stageWidth, height: stageHeight }]}>
      <FlatList
        ref={listRef}
        data={entries}
        keyExtractor={(entry) => entry.playbackId}
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={stageHeight}
        snapToAlignment="start"
        disableIntervalMomentum
        showsVerticalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: stageHeight,
          offset: stageHeight * index,
          index,
        })}
        onMomentumScrollEnd={handleNativeScroll}
        onScroll={handleNativeScroll}
        scrollEventThrottle={16}
        initialNumToRender={Math.min(3, entries.length)}
        maxToRenderPerBatch={2}
        windowSize={3}
        ListFooterComponent={footer ? () => footer : undefined}
        renderItem={({ item, index: slideIndex }) => renderSlide(item, slideIndex)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  slideShell: {
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  footer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  endState: {
    opacity: 0.72,
  },
  endStateText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
