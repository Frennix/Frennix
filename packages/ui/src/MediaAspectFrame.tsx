import { useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Skeleton } from "./Skeleton";
import {
  FEED_MIN_MEDIA_HEIGHT,
  FEED_PHOTO_FALLBACK_RATIO,
  INLINE_DEFAULT_HEIGHT,
  type MediaLayout,
} from "./mediaLayout";
import { computeImageDisplayHeight, useImageDimensions } from "./useImageDimensions";
import { colors, radius } from "./theme";

type MediaAspectFrameProps = {
  /** URI used to resolve intrinsic width/height (photo, poster, or thumbnail). */
  dimensionsUri?: string;
  layout?: MediaLayout;
  style?: StyleProp<ViewStyle>;
  maxHeight?: number;
  /** height / width when dimensions are unknown */
  fallbackRatio?: number;
  /** When set, frame height always uses width × ratio (ignores intrinsic media dimensions). */
  fixedAspectRatio?: number;
  children: (frame: { ready: boolean }) => ReactNode;
};

export function MediaAspectFrame({
  dimensionsUri,
  layout = "inline",
  style,
  maxHeight,
  fallbackRatio = FEED_PHOTO_FALLBACK_RATIO,
  fixedAspectRatio,
  children,
}: MediaAspectFrameProps) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const probeDimensionsUri = fixedAspectRatio != null ? undefined : dimensionsUri;
  const { dimensions, failed } = useImageDimensions(probeDimensionsUri);

  const isFeed = layout === "feed";
  const usesFixedAspect = fixedAspectRatio != null;

  const displayHeight = useMemo(() => {
    if (!layoutWidth) {
      return isFeed ? FEED_MIN_MEDIA_HEIGHT : INLINE_DEFAULT_HEIGHT;
    }
    if (usesFixedAspect) {
      return layoutWidth * fixedAspectRatio;
    }
    if (dimensions) {
      return computeImageDisplayHeight(
        layoutWidth,
        dimensions.width,
        dimensions.height,
        maxHeight
      );
    }
    if (isFeed) {
      return Math.max(layoutWidth * fallbackRatio, FEED_MIN_MEDIA_HEIGHT);
    }
    return INLINE_DEFAULT_HEIGHT;
  }, [dimensions, fallbackRatio, fixedAspectRatio, isFeed, layoutWidth, maxHeight, usesFixedAspect]);

  const frameStyle = useMemo(
    () => [
      styles.frame,
      isFeed ? styles.frameFeed : styles.frameInline,
      style,
      layoutWidth > 0 ? { height: displayHeight } : isFeed ? styles.frameFeedLoading : { height: displayHeight },
    ],
    [displayHeight, isFeed, layoutWidth, style]
  );

  const ready =
    usesFixedAspect
      ? layoutWidth > 0
      : Boolean(dimensions) || failed || (isFeed && layoutWidth > 0);

  return (
    <View
      style={frameStyle}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        if (width > 0 && width !== layoutWidth) setLayoutWidth(width);
      }}
    >
      {!ready ? <Skeleton width="100%" height="100%" style={styles.skeleton} /> : null}
      {children({ ready: ready || layoutWidth > 0 })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  frameFeed: {
    borderRadius: 0,
    backgroundColor: colors.background,
  },
  frameFeedLoading: {
    minHeight: FEED_MIN_MEDIA_HEIGHT,
  },
  frameInline: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceElevated,
  },
  skeleton: {
    ...StyleSheet.absoluteFillObject,
  },
});
