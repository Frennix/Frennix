import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import type { PostType } from "@frennix/types";
import { PostMediaCarousel } from "./PostMediaCarousel";
import { Skeleton } from "./Skeleton";
import { colors } from "./theme";
import { FEED_MIN_MEDIA_HEIGHT } from "./mediaLayout";

const VIEWPORT_ROOT_MARGIN = "320px 0px";

interface FeedMediaSlotProps {
  mediaUrls: string[];
  postType?: PostType;
  thumbnailUrl?: string | null;
  style?: ViewStyle;
  onMediaPress?: (uri: string) => void;
  /** When false, show a skeleton until the row is near the viewport. Once active, stays mounted. */
  visible?: boolean;
}

function FeedMediaSkeleton({ style }: { style?: ViewStyle }) {
  return (
    <View style={[styles.skeletonWrap, style]}>
      <Skeleton width="100%" height="100%" />
    </View>
  );
}

/** Defers heavy media mounts until the row is near the viewport (feed scroll perf). */
export function FeedMediaSlot({
  mediaUrls,
  postType,
  thumbnailUrl,
  style,
  onMediaPress,
  visible = true,
}: FeedMediaSlotProps) {
  const containerRef = useRef<View>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (visible) setActive(true);
  }, [visible]);

  useEffect(() => {
    if (Platform.OS !== "web" || active || typeof document === "undefined") return;

    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node || typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: VIEWPORT_ROOT_MARGIN, threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [active, mediaUrls]);

  if (!active) {
    return (
      <View ref={containerRef} collapsable={false} style={style}>
        <FeedMediaSkeleton />
      </View>
    );
  }

  return (
    <PostMediaCarousel
      mediaUrls={mediaUrls}
      postType={postType}
      thumbnailUrl={thumbnailUrl}
      style={style}
      onMediaPress={onMediaPress}
    />
  );
}

const styles = StyleSheet.create({
  skeletonWrap: {
    width: "100%",
    minHeight: FEED_MIN_MEDIA_HEIGHT,
    backgroundColor: colors.background,
  },
});
