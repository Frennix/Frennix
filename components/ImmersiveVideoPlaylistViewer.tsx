import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
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
  /** Comments sheet open — shrink active slide video into peek region. */
  commentsOverlayOpen?: boolean;
  /** Dedicated /video route — decouple non-handoff slides from feed coordinator. */
  routePlayback?: boolean;
};

const PRELOAD_RADIUS = 1;
const FETCH_AHEAD_SLIDE_COUNT = 2;
const SWIPE_LOCK_PX = 14;
const SWIPE_DISTANCE_PX = 72;
const SWIPE_VELOCITY_PX_PER_MS = 0.45;

type PlaylistSwipeLock = "none" | "vertical" | "horizontal";

type PlaylistSwipeGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  lock: PlaylistSwipeLock;
};

function clampIndex(value: number, max: number) {
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

function isPlaylistChromeTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (
    target.closest("[data-frennix-playlist-swipe-surface='true']") ||
    target.closest("[aria-label='Play or pause video']")
  ) {
    return false;
  }
  return Boolean(
    target.closest(
      "button, a, input, textarea, [role='button'], [data-frennix-immersive-rail], [data-frennix-immersive-top-bar]"
    )
  );
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
  commentsOverlayOpen = false,
  routePlayback = false,
}: ImmersiveVideoPlaylistViewerProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [showEndState, setShowEndState] = useState(false);
  const handoffAppliedRef = useRef(false);
  const fetchInFlightRef = useRef(false);
  const listRef = useRef<FlatList<ImmersiveVideoPlaylistEntry>>(null);
  const activeIndexRef = useRef(activeIndex);
  const commentsOpenRef = useRef(commentsOverlayOpen);
  const gestureRef = useRef<PlaylistSwipeGesture | null>(null);
  const suppressClickRef = useRef(false);

  activeIndexRef.current = activeIndex;
  commentsOpenRef.current = commentsOverlayOpen;

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

  const finishWebSwipe = useCallback(
    (gesture: PlaylistSwipeGesture, clientX: number, clientY: number) => {
      if (gesture.lock !== "vertical") return false;
      const dy = clientY - gesture.startY;
      const dt = Math.max(1, Date.now() - gesture.startTime);
      const velocity = dy / dt;
      const passed =
        Math.abs(dy) >= SWIPE_DISTANCE_PX || Math.abs(velocity) >= SWIPE_VELOCITY_PX_PER_MS;
      if (!passed) return false;
      suppressClickRef.current = true;
      handleIndexChange(activeIndexRef.current + (dy < 0 ? 1 : -1));
      return true;
    },
    [handleIndexChange]
  );

  const handleWebPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (commentsOpenRef.current || isPlaylistChromeTarget(event.target)) {
        gestureRef.current = null;
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) return;
      gestureRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTime: Date.now(),
        lock: "none",
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    []
  );

  const handleWebPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (gesture.lock === "none") {
      if (Math.abs(dy) >= SWIPE_LOCK_PX && Math.abs(dy) >= Math.abs(dx)) {
        gesture.lock = "vertical";
      } else if (Math.abs(dx) >= SWIPE_LOCK_PX && Math.abs(dx) > Math.abs(dy)) {
        gesture.lock = "horizontal";
      }
    }
    if (gesture.lock === "vertical") {
      event.preventDefault();
    }
  }, []);

  const handleWebPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      const committed = finishWebSwipe(gesture, event.clientX, event.clientY);
      if (committed) {
        event.preventDefault();
        event.stopPropagation();
      }
      gestureRef.current = null;
    },
    [finishWebSwipe]
  );

  const handleWebPointerCancel = useCallback(() => {
    gestureRef.current = null;
  }, []);

  const handleWebClickCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }, []);

  const slideShellSize =
    Platform.OS === "web"
      ? ({ width: "100%", height: "100%" } as const)
      : { width: stageWidth, height: stageHeight };

  const renderSlide = useCallback(
    (entry: ImmersiveVideoPlaylistEntry, slideIndex: number) => {
      const post = getPost(entry.postId);
      const immersiveContext = post ? buildImmersiveContext(post) : undefined;
      const isActive = slideIndex === activeIndex;
      const shouldRender = shouldRenderIndex(slideIndex);

      if (!shouldRender || !post || !immersiveContext?.postActions) {
        return (
          <View
            style={[styles.slideShell, slideShellSize]}
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

      const slideRoutePlayback = routePlayback || !playbackHandoff;

      return (
        <View
          style={[styles.slideShell, slideShellSize]}
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
            routePlayback={slideRoutePlayback}
            postActions={immersiveContext.postActions}
            onClose={onClose}
            commentsOverlayOpen={isActive && commentsOverlayOpen}
          />
        </View>
      );
    },
    [
      activeIndex,
      buildImmersiveContext,
      commentsOverlayOpen,
      getPost,
      initialHandoff,
      initialHandoffPlaybackId,
      onClose,
      routePlayback,
      shouldRenderIndex,
      slideShellSize,
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
          className="frennix-immersive-video-playlist-scroll"
          data-frennix-playlist-active-index={String(activeIndex)}
          onPointerDown={handleWebPointerDown}
          onPointerMove={handleWebPointerMove}
          onPointerUp={handleWebPointerUp}
          onPointerCancel={handleWebPointerCancel}
          onClickCapture={handleWebClickCapture}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            overflow: "hidden",
            touchAction: "none",
            backgroundColor: colors.background,
          }}
        >
          {entries.map((entry, slideIndex) => {
            if (!shouldRenderIndex(slideIndex)) return null;
            const isActive = slideIndex === activeIndex;
            return (
              <div
                key={entry.playbackId}
                data-frennix-video-playlist-page={isActive ? "active" : "preload"}
                aria-hidden={isActive ? undefined : true}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                  visibility: isActive ? "visible" : "hidden",
                  pointerEvents: isActive ? "auto" : "none",
                  zIndex: isActive ? 1 : 0,
                }}
              >
                {renderSlide(entry, slideIndex)}
              </div>
            );
          })}
          {footer ? <div style={styles.webFooterHost}>{footer}</div> : null}
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
  webFooterHost: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    zIndex: 2,
    pointerEvents: "none",
  },
});
