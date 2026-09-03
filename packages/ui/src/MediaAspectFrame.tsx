import { useMemo, useState, type ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Skeleton } from "./Skeleton";
import {
  FEED_MIN_MEDIA_HEIGHT,
  FEED_PHOTO_FALLBACK_RATIO,
  INLINE_DEFAULT_HEIGHT,
  classifyFeedMediaBucket,
  computeFeedMediaFrameHeight,
  type FeedMediaBucket,
  type MediaLayout,
} from "./mediaLayout";
import { computeImageDisplayHeight, useImageDimensions } from "./useImageDimensions";
import { colors, radius } from "./theme";

export type MediaAspectFrameState = {
  ready: boolean;
  bucket: FeedMediaBucket | null;
};

type MediaAspectFrameProps = {
  /** URI used to resolve intrinsic width/height (photo, poster, or thumbnail). */
  dimensionsUri?: string;
  layout?: MediaLayout;
  style?: StyleProp<ViewStyle>;
  maxHeight?: number;
  /** height / width when dimensions are unknown */
  fallbackRatio?: number;
  /** When feed dimensions are unknown, assume this Instagram bucket (videos → portrait 4:5). */
  feedFallbackBucket?: FeedMediaBucket;
  children: (frame: MediaAspectFrameState) => ReactNode;
};

export function MediaAspectFrame({
  dimensionsUri,
  layout = "inline",
  style,
  maxHeight,
  fallbackRatio = FEED_PHOTO_FALLBACK_RATIO,
  feedFallbackBucket = "portrait",
  children,
}: MediaAspectFrameProps) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const { dimensions, failed } = useImageDimensions(dimensionsUri);

  const isFeed = layout === "feed";

  const bucket = useMemo<FeedMediaBucket | null>(() => {
    if (!isFeed) return null;
    if (dimensions) return classifyFeedMediaBucket(dimensions.width, dimensions.height);
    return feedFallbackBucket;
  }, [dimensions, feedFallbackBucket, isFeed]);

  const displayHeight = useMemo(() => {
    if (!layoutWidth) {
      return isFeed ? FEED_MIN_MEDIA_HEIGHT : INLINE_DEFAULT_HEIGHT;
    }
    if (isFeed) {
      return computeFeedMediaFrameHeight(
        layoutWidth,
        dimensions?.width ?? 0,
        dimensions?.height ?? 0,
        feedFallbackBucket
      );
    }
    if (dimensions) {
      return computeImageDisplayHeight(
        layoutWidth,
        dimensions.width,
        dimensions.height,
        maxHeight
      );
    }
    return INLINE_DEFAULT_HEIGHT;
  }, [dimensions, feedFallbackBucket, isFeed, layoutWidth, maxHeight]);

  const frameStyle = useMemo(
    () => [
      styles.frame,
      isFeed ? styles.frameFeed : styles.frameInline,
      style,
      layoutWidth > 0 ? { height: displayHeight } : isFeed ? styles.frameFeedLoading : { height: displayHeight },
    ],
    [displayHeight, isFeed, layoutWidth, style]
  );

  const ready = Boolean(dimensions) || failed || (isFeed && layoutWidth > 0);

  const webFrameProps =
    Platform.OS === "web" && isFeed && bucket
      ? ({
          "data-frennix-feed-media-frame": bucket,
        } as object)
      : null;

  return (
    <View
      style={frameStyle}
      {...webFrameProps}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width > 0 && width !== layoutWidth) setLayoutWidth(width);
      }}
    >
      {!ready ? <Skeleton width="100%" height="100%" style={styles.skeleton} /> : null}
      {children({ ready: ready || layoutWidth > 0, bucket })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    overflow: "hidden",
    alignItems: "stretch",
    justifyContent: "flex-start",
  },
  frameFeed: {
    borderRadius: 0,
    backgroundColor: colors.background,
    alignSelf: "stretch",
  },
  frameFeedLoading: {
    minHeight: FEED_MIN_MEDIA_HEIGHT,
  },
  frameInline: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  skeleton: {
    ...StyleSheet.absoluteFillObject,
  },
});
