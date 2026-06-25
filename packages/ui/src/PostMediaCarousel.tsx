import { useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import type { PostType } from "@frennix/types";
import { PostMedia } from "./PostMedia";
import { colors, spacing, typography } from "./theme";

interface PostMediaCarouselProps {
  mediaUrls: string[];
  postType?: PostType;
  thumbnailUrl?: string | null;
  style?: ViewStyle;
  onMediaPress?: (uri: string) => void;
}

export function PostMediaCarousel({
  mediaUrls,
  postType,
  thumbnailUrl,
  style,
  onMediaPress,
}: PostMediaCarouselProps) {
  const [index, setIndex] = useState(0);
  const widthRef = useRef(0);

  if (!mediaUrls.length) return null;

  if (mediaUrls.length === 1) {
    return (
      <PostMedia
        uri={mediaUrls[0]}
        postType={postType}
        thumbnailUrl={thumbnailUrl}
        style={style}
        layout="feed"
        onImagePress={onMediaPress ? () => onMediaPress(mediaUrls[0]) : undefined}
      />
    );
  }

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!widthRef.current) return;
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / widthRef.current);
    if (nextIndex !== index) setIndex(nextIndex);
  }

  return (
    <View
      style={[styles.wrapper, style]}
      onLayout={(event) => {
        widthRef.current = event.nativeEvent.layout.width;
      }}
    >
      <FlatList
        data={mediaUrls}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(uri, itemIndex) => `${uri}-${itemIndex}`}
        onMomentumScrollEnd={handleScroll}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={3}
        removeClippedSubviews={false}
        renderItem={({ item, index: itemIndex }) => (
          <View style={[styles.slide, widthRef.current ? { width: widthRef.current } : undefined]}>
            <PostMedia
              uri={item}
              postType={itemIndex === 0 ? postType : "photo"}
              thumbnailUrl={itemIndex === 0 ? thumbnailUrl : null}
              style={styles.media}
              layout="feed"
              onImagePress={onMediaPress ? () => onMediaPress(item) : undefined}
            />
          </View>
        )}
      />

      <View style={styles.dots} pointerEvents="none">
        {mediaUrls.map((uri, dotIndex) => (
          <View
            key={`${uri}-${dotIndex}`}
            style={[styles.dot, dotIndex === index && styles.dotActive]}
          />
        ))}
      </View>

      <View style={styles.counter} pointerEvents="none">
        <Text style={styles.counterText}>
          {index + 1}/{mediaUrls.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  slide: {
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
