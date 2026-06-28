import { useCallback, useEffect, useRef, useState } from "react";
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
import type { PostType } from "@frennix/types";
import { prefetchCachedImages } from "./CachedImage";
import { PostMedia } from "./PostMedia";
import { colors, spacing, typography } from "./theme";

interface PostMediaCarouselProps {
  mediaUrls: string[];
  postType?: PostType;
  thumbnailUrl?: string | null;
  style?: ViewStyle;
  onMediaPress?: (uri: string, index: number) => void;
  pageIndex?: number;
  onPageIndexChange?: (index: number) => void;
}

export function PostMediaCarousel({
  mediaUrls,
  postType,
  thumbnailUrl,
  style,
  onMediaPress,
  pageIndex,
  onPageIndexChange,
}: PostMediaCarouselProps) {
  const [internalIndex, setInternalIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const listRef = useRef<FlatList<string>>(null);
  const activeIndex = pageIndex ?? internalIndex;

  const handleLayout = useCallback((width: number) => {
    if (width > 0) setContainerWidth(width);
  }, []);

  const commitIndex = useCallback(
    (nextIndex: number) => {
      const clamped = Math.min(Math.max(nextIndex, 0), Math.max(mediaUrls.length - 1, 0));
      if (pageIndex === undefined) setInternalIndex(clamped);
      onPageIndexChange?.(clamped);
    },
    [mediaUrls.length, onPageIndexChange, pageIndex]
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
    if (!containerWidth || mediaUrls.length <= 1) return;
    const neighbors = [mediaUrls[activeIndex + 1], mediaUrls[activeIndex - 1]].filter(Boolean) as string[];
    if (neighbors.length) void prefetchCachedImages(neighbors);
  }, [activeIndex, mediaUrls, containerWidth]);

  if (!mediaUrls.length) return null;

  if (mediaUrls.length === 1) {
    return (
      <View
        style={[styles.wrapper, style]}
        onLayout={(event) => handleLayout(event.nativeEvent.layout.width)}
      >
        <PostMedia
          uri={mediaUrls[0]}
          postType={postType}
          thumbnailUrl={thumbnailUrl}
          style={styles.media}
          layout="feed"
          onImagePress={onMediaPress ? () => onMediaPress(mediaUrls[0], 0) : undefined}
        />
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
      {containerWidth > 0 ? (
        <FlatList
          ref={listRef}
          data={mediaUrls}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          directionalLockEnabled={Platform.OS === "ios"}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(uri, itemIndex) => `${uri}-${itemIndex}`}
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
          style={styles.list}
          renderItem={({ item, index: itemIndex }) => (
            <View style={{ width: containerWidth }}>
              <PostMedia
                uri={item}
                postType={itemIndex === 0 ? postType : "photo"}
                thumbnailUrl={itemIndex === 0 ? thumbnailUrl : null}
                style={styles.media}
                layout="feed"
                pressDelayMs={200}
                onImagePress={onMediaPress ? () => onMediaPress(item, itemIndex) : undefined}
              />
            </View>
          )}
        />
      ) : (
        <PostMedia
          uri={mediaUrls[0]}
          postType={postType}
          thumbnailUrl={thumbnailUrl}
          style={styles.media}
          layout="feed"
          pressDelayMs={200}
          onImagePress={onMediaPress ? () => onMediaPress(mediaUrls[0], 0) : undefined}
        />
      )}

      <View style={styles.dots} pointerEvents="none">
        {mediaUrls.map((uri, dotIndex) => (
          <View
            key={`${uri}-${dotIndex}`}
            style={[styles.dot, dotIndex === activeIndex && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.counter} pointerEvents="none">
        <Text style={styles.counterText}>
          {activeIndex + 1}/{mediaUrls.length}
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
  list: {
    width: "100%",
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
