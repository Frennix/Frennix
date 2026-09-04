import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import type { PostType, PostMediaItem } from "@frennix/types";
import { normalizePostMediaItems } from "@frennix/types";
import { prefetchCachedImages } from "./CachedImage";
import { MediaAspectFrame } from "./MediaAspectFrame";
import { PostMedia } from "./PostMedia";
import {
  FEED_FALLBACK_BUCKET,
  FEED_PORTRAIT_FRAME_RATIO,
  feedBucketAspectRatio,
  resolveFeedCarouselFrameSizing,
  type FeedMediaBucket,
} from "./mediaLayout";
import { colors, spacing, typography } from "./theme";

const WEB_HORIZONTAL_SCROLL_STYLE: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({
        touchAction: "pan-x pinch-zoom",
      } as ViewStyle)
    : undefined;

interface PostMediaCarouselProps {
  mediaUrls: string[];
  postType?: PostType;
  thumbnailUrl?: string | null;
  style?: ViewStyle;
  onMediaPress?: (uri: string, index: number) => void;
  /** Mobile web /video/[postId] href builder for inline feed videos. */
  videoRouteHrefForIndex?: (index: number) => string | undefined;
  onVideoRouteNavigate?: (index: number) => void;
  pageIndex?: number;
  onPageIndexChange?: (index: number) => void;
  /** Post row is near viewport — gates lazy load. */
  mediaVisible?: boolean;
  /** Scope id for feed video playback coordination (typically post id). */
  playbackScopeId?: string;
  onPrimaryMediaReady?: (source: "image" | "video") => void;
}

function renderCarouselSlide({
  item,
  itemIndex,
  activeIndex,
  onMediaPress,
  videoRouteHrefForIndex,
  onVideoRouteNavigate,
  mediaVisible,
  playbackScopeId,
  onPrimaryMediaReady,
  fillParent,
  feedFrameBucket,
}: {
  item: PostMediaItem;
  itemIndex: number;
  activeIndex: number;
  onMediaPress?: (uri: string, index: number) => void;
  videoRouteHrefForIndex?: (index: number) => string | undefined;
  onVideoRouteNavigate?: (index: number) => void;
  mediaVisible?: boolean;
  playbackScopeId?: string;
  onPrimaryMediaReady?: (source: "image" | "video") => void;
  fillParent?: boolean;
  feedFrameBucket?: import("./mediaLayout").FeedMediaBucket;
}) {
  return (
    <PostMedia
      uri={item.url}
      postType={item.kind === "video" ? "video" : "photo"}
      thumbnailUrl={item.thumbnailUrl}
      style={styles.media}
      layout="feed"
      pressDelayMs={200}
      slideActive={itemIndex === activeIndex}
      mediaVisible={mediaVisible}
      playbackScopeId={playbackScopeId}
      mediaIndex={itemIndex}
      fillParent={fillParent}
      feedFrameBucket={feedFrameBucket}
      onImagePress={
        item.kind === "image" && onMediaPress
          ? () => onMediaPress(item.url, itemIndex)
          : undefined
      }
      onVideoPress={
        item.kind === "video" && onMediaPress && !videoRouteHrefForIndex
          ? () => onMediaPress(item.url, itemIndex)
          : undefined
      }
      videoRouteHref={item.kind === "video" ? videoRouteHrefForIndex?.(itemIndex) : undefined}
      onVideoRouteNavigate={
        item.kind === "video" ? () => onVideoRouteNavigate?.(itemIndex) : undefined
      }
      onVisualReady={
        itemIndex === 0 && onPrimaryMediaReady
          ? () => onPrimaryMediaReady(item.kind === "video" ? "video" : "image")
          : undefined
      }
    />
  );
}

export function PostMediaCarousel({
  mediaUrls,
  postType,
  thumbnailUrl,
  style,
  onMediaPress,
  videoRouteHrefForIndex,
  onVideoRouteNavigate,
  pageIndex,
  onPageIndexChange,
  mediaVisible = true,
  playbackScopeId,
  onPrimaryMediaReady,
}: PostMediaCarouselProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const listRef = useRef<FlatList<PostMediaItem>>(null);
  const activeIndex = pageIndex ?? internalIndex;

  const mediaItems = useMemo(
    () => normalizePostMediaItems(mediaUrls, { postType, thumbnailUrl }),
    [mediaUrls, postType, thumbnailUrl]
  );

  const frameProbeUri = mediaItems[0]?.thumbnailUrl ?? mediaItems[0]?.url;

  const handleLayout = useCallback((width: number) => {
    if (width > 0) setContainerWidth(width);
  }, []);

  const commitIndex = useCallback(
    (nextIndex: number) => {
      const clamped = Math.min(Math.max(nextIndex, 0), Math.max(mediaItems.length - 1, 0));
      if (pageIndex === undefined) setInternalIndex(clamped);
      onPageIndexChange?.(clamped);
    },
    [mediaItems.length, onPageIndexChange, pageIndex]
  );

  const updateIndexFromOffset = useCallback(
    (offsetX: number) => {
      if (!containerWidth) return;
      const nextIndex = Math.round(offsetX / containerWidth);
      commitIndex(nextIndex);
    },
    [commitIndex, containerWidth]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateIndexFromOffset(event.nativeEvent.contentOffset.x);
    },
    [updateIndexFromOffset]
  );

  useEffect(() => {
    if (pageIndex === undefined || !containerWidth) return;
    listRef.current?.scrollToOffset({ offset: pageIndex * containerWidth, animated: false });
    if (pageIndex !== internalIndex) setInternalIndex(pageIndex);
  }, [pageIndex, containerWidth, internalIndex]);

  useEffect(() => {
    if (!containerWidth || mediaItems.length <= 1) return;
    const neighbors = [
      mediaItems[activeIndex + 1]?.url,
      mediaItems[activeIndex - 1]?.url,
    ].filter(Boolean) as string[];
    if (neighbors.length) void prefetchCachedImages(neighbors);
  }, [activeIndex, mediaItems, containerWidth]);

  if (!mediaItems.length) return null;

  if (mediaItems.length === 1) {
    const item = mediaItems[0];
    return (
      <View
        style={[styles.wrapper, style]}
        onLayout={(event) => handleLayout(event.nativeEvent.layout.width)}
      >
        {renderCarouselSlide({
          item,
          itemIndex: 0,
          activeIndex,
          onMediaPress,
          videoRouteHrefForIndex,
          onVideoRouteNavigate,
          mediaVisible,
          playbackScopeId,
          onPrimaryMediaReady,
        })}
      </View>
    );
  }

  const getItemLayout = (_: unknown, itemIndex: number) => ({
    length: containerWidth,
    offset: containerWidth * itemIndex,
    index: itemIndex,
  });

  return (
    <View
      style={[styles.wrapper, style]}
      onLayout={(event) => handleLayout(event.nativeEvent.layout.width)}
    >
      <MediaAspectFrame
        dimensionsUri={frameProbeUri}
        layout="feed"
        style={styles.media}
      >
        {({ bucket }) => {
          const frameBucket = (bucket ?? FEED_FALLBACK_BUCKET) as FeedMediaBucket;
          const { frameHeight, frameAspectRatio } = resolveFeedCarouselFrameSizing(
            containerWidth,
            frameBucket
          );
          const frameSizingStyle: ViewStyle =
            containerWidth > 0
              ? { height: frameHeight }
              : ({ aspectRatio: frameAspectRatio, width: "100%" } as ViewStyle);

          return (
            <View style={[styles.sharedFrameInner, frameSizingStyle]}>
              {containerWidth > 0 ? (
                <FlatList
                  ref={listRef}
                  data={mediaItems}
                  horizontal
                  pagingEnabled
                  nestedScrollEnabled
                  directionalLockEnabled={Platform.OS === "ios"}
                  showsHorizontalScrollIndicator={false}
                  style={[styles.list, { height: frameHeight }, WEB_HORIZONTAL_SCROLL_STYLE]}
                  keyExtractor={(item, itemIndex) => `${item.url}-${itemIndex}`}
                  getItemLayout={getItemLayout}
                  snapToInterval={containerWidth}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  onScroll={handleScroll}
                  scrollEventThrottle={16}
                  onMomentumScrollEnd={handleScroll}
                  initialNumToRender={2}
                  maxToRenderPerBatch={2}
                  windowSize={3}
                  removeClippedSubviews={Platform.OS !== "web"}
                  renderItem={({ item, index: itemIndex }) => (
                    <View style={{ width: containerWidth, height: frameHeight }}>
                      {renderCarouselSlide({
                        item,
                        itemIndex,
                        activeIndex,
                        onMediaPress,
                        videoRouteHrefForIndex,
                        onVideoRouteNavigate,
                        mediaVisible,
                        playbackScopeId,
                        onPrimaryMediaReady,
                        fillParent: true,
                        feedFrameBucket: frameBucket,
                      })}
                    </View>
                  )}
                />
              ) : (
                <View
                  style={[
                    styles.widthProbePlaceholder,
                    { aspectRatio: feedBucketAspectRatio(FEED_FALLBACK_BUCKET) },
                  ]}
                />
              )}
            </View>
          );
        }}
      </MediaAspectFrame>

      <View style={styles.dots} pointerEvents="none">
        {mediaItems.map((item, dotIndex) => (
          <View
            key={`${item.url}-${dotIndex}`}
            style={[
              styles.dot,
              dotIndex === activeIndex && styles.dotActive,
              item.kind === "video" && styles.dotVideo,
            ]}
          />
        ))}
      </View>

      <View style={styles.counter} pointerEvents="none">
        <Text style={styles.counterText}>
          {activeIndex + 1}/{mediaItems.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    width: "100%",
  },
  sharedFrameInner: {
    width: "100%",
    height: "100%",
  },
  widthProbePlaceholder: {
    width: "100%",
    aspectRatio: 1 / FEED_PORTRAIT_FRAME_RATIO,
  },
  list: {
    width: "100%",
    height: "100%",
  },
  media: {
    width: "100%",
    borderRadius: 0,
  },
  dots: {
    position: "absolute",
    bottom: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 8,
  },
  dotVideo: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
  },
  counter: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(10, 10, 11, 0.75)",
  },
  counterText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: "700",
  },
});
