import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Skeleton } from "./Skeleton";
import {
  INLINE_DEFAULT_HEIGHT,
  classifyFeedMediaBucket,
  computeFeedMediaFrameHeight,
  computePhotoDisplayFrame,
  feedBucketAspectRatio,
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
  /** URI used to resolve intrinsic width/height (thumbnail, photo, or poster). */
  dimensionsUri?: string;
  layout?: MediaLayout;
  style?: StyleProp<ViewStyle>;
  maxHeight?: number;
  /** height / width when dimensions are unknown */
  fallbackRatio?: number;
  /** When feed dimensions are unknown, assume this Instagram bucket (videos → portrait 4:5). */
  feedFallbackBucket?: FeedMediaBucket;
  /** Parent-locked bucket (carousel) — prevents per-slide frame changes. */
  feedFrameBucket?: FeedMediaBucket;
  /** Photos use the original aspect ratio. Videos keep the feed buckets. */
  sizing?: "bucket" | "photo";
  /** Skip outer sizing — fill a parent MediaAspectFrame (carousel slides). */
  fillParent?: boolean;
  children: (frame: MediaAspectFrameState) => ReactNode;
};

export function MediaAspectFrame({
  dimensionsUri,
  layout = "inline",
  style,
  maxHeight,
  fallbackRatio: _fallbackRatio,
  feedFallbackBucket = "portrait",
  feedFrameBucket,
  sizing = "bucket",
  fillParent = false,
  children,
}: MediaAspectFrameProps) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const { dimensions, failed } = useImageDimensions(dimensionsUri);
  const [stableBucket, setStableBucket] = useState<FeedMediaBucket | null>(null);

  const isFeed = layout === "feed";
  const photoSizing = sizing === "photo";

  useEffect(() => {
    setStableBucket(null);
  }, [dimensionsUri]);

  useEffect(() => {
    if (feedFrameBucket || stableBucket) return;
    if (dimensions) {
      setStableBucket(classifyFeedMediaBucket(dimensions.width, dimensions.height));
      return;
    }
    if (failed) {
      setStableBucket(feedFallbackBucket);
    }
  }, [dimensions, failed, feedFallbackBucket, feedFrameBucket, stableBucket]);

  const effectiveBucket = feedFrameBucket ?? stableBucket ?? feedFallbackBucket;

  const bucket = useMemo<FeedMediaBucket | null>(() => {
    if (!isFeed) return null;
    return effectiveBucket;
  }, [effectiveBucket, isFeed]);

  const displayHeight = useMemo(() => {
    if (fillParent) return 0;
    if (!layoutWidth) return 0;
    if (isFeed && photoSizing) {
      return computePhotoDisplayFrame(
        layoutWidth,
        dimensions?.width ?? 0,
        dimensions?.height ?? 0
      ).height;
    }
    if (isFeed) {
      return computeFeedMediaFrameHeight(
        layoutWidth,
        dimensions?.width ?? 0,
        dimensions?.height ?? 0,
        effectiveBucket
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
  }, [dimensions, effectiveBucket, fillParent, isFeed, layoutWidth, maxHeight, photoSizing]);

  const frameStyle = useMemo(
    () => [
      styles.frame,
      isFeed ? styles.frameFeed : styles.frameInline,
      fillParent ? styles.frameFillParent : null,
      style,
      fillParent
        ? null
        : layoutWidth > 0
          ? { height: displayHeight }
          : isFeed
            ? ({
                aspectRatio: photoSizing
                  ? dimensions
                    ? dimensions.width / dimensions.height
                    : 1
                  : feedBucketAspectRatio(effectiveBucket),
                width: "100%",
              } as ViewStyle)
            : { height: displayHeight || INLINE_DEFAULT_HEIGHT },
    ],
    [dimensions, displayHeight, effectiveBucket, fillParent, isFeed, layoutWidth, photoSizing, style]
  );

  const frameReady =
    fillParent || Boolean(feedFrameBucket) || Boolean(dimensions) || failed || (isFeed && layoutWidth > 0);

  const webFrameProps =
    Platform.OS === "web" && isFeed && !fillParent
      ? photoSizing
        ? ({ "data-frennix-feed-photo-frame": "true" } as object)
        : bucket
          ? ({ "data-frennix-feed-media-frame": bucket } as object)
          : null
      : null;

  if (fillParent) {
    return (
      <View style={[styles.frameFillParent, style]}>
        {children({ ready: true, bucket: feedFrameBucket ?? bucket })}
      </View>
    );
  }

  return (
    <View
      style={frameStyle}
      {...webFrameProps}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width > 0 && width !== layoutWidth) setLayoutWidth(width);
      }}
    >
      {!frameReady ? <Skeleton width="100%" height="100%" style={styles.skeleton} /> : null}
      {children({ ready: frameReady, bucket })}
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
  frameFillParent: {
    width: "100%",
    height: "100%",
    flex: 1,
    overflow: "hidden",
    alignSelf: "stretch",
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
