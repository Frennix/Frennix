import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { CachedImage } from "./CachedImage";
import { MediaAspectFrame } from "./MediaAspectFrame";
import { FEED_MAX_PORTRAIT_RATIO, type MediaLayout } from "./mediaLayout";
import { colors, radius } from "./theme";
import type { VideoPosterState } from "./useVideoPoster";
import { useVideoPoster } from "./useVideoPoster";
import { VideoPosterFallback } from "./VideoPosterFallback";
import { WebVideoFrame } from "./WebVideoFrame";

interface VideoPreviewProps {
  videoUri: string;
  thumbnailUrl?: string | null;
  posterState?: VideoPosterState;
  style?: ViewStyle;
  layout?: MediaLayout;
  compact?: boolean;
  onPlay?: () => void;
  /** When false, show poster/thumbnail only (no center play overlay). */
  showPlayButton?: boolean;
  /** Optional control pinned to the bottom-right (feed mute button, etc.). */
  bottomRightOverlay?: ReactNode;
  /** Feed poster content only — caller provides MediaAspectFrame. */
  unframed?: boolean;
}

export function VideoPreview({
  videoUri,
  thumbnailUrl,
  posterState,
  style,
  layout = "inline",
  compact,
  onPlay,
  showPlayButton = true,
  bottomRightOverlay,
  unframed = false,
}: VideoPreviewProps) {
  const internalPoster = useVideoPoster(posterState ? undefined : videoUri, posterState ? null : thumbnailUrl);
  const { posterUri, ready, useVideoFrameFallback } = posterState ?? internalPoster;
  const [posterImageFailed, setPosterImageFailed] = useState(false);

  const isFeed = layout === "feed" && !compact;
  const dimensionsUri = posterUri ?? thumbnailUrl ?? undefined;
  const posterFit = "cover";

  useEffect(() => {
    setPosterImageFailed(false);
  }, [posterUri]);

  const showStoredPoster = Boolean(posterUri && !posterImageFailed);
  const showVideoFrame = Boolean(videoUri && (useVideoFrameFallback || posterImageFailed));
  const showLoading = !ready && !showStoredPoster && !showVideoFrame;
  const showFallback = ready && !showStoredPoster && !showVideoFrame;

  const previewBody = (
    <>
      {showStoredPoster ? (
        <CachedImage
          uri={posterUri!}
          placeholderUri={thumbnailUrl}
          style={styles.poster}
          contentFit={posterFit}
          recyclingKey={`poster-${posterUri}`}
          onError={() => setPosterImageFailed(true)}
        />
      ) : showVideoFrame ? (
        <WebVideoFrame uri={videoUri} style={styles.poster} compact={compact} fit={posterFit} />
      ) : showLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size={isFeed ? "large" : compact ? "small" : "large"} />
        </View>
      ) : (
        <VideoPosterFallback style={styles.poster} compact={compact} />
      )}

      {showPlayButton ? (
        <View style={[styles.overlay, isFeed && styles.overlayFeed]} pointerEvents="none">
          <View style={[styles.playButton, isFeed && styles.playButtonFeed, compact && styles.playButtonCompact]}>
            <Text style={[styles.playIcon, isFeed && styles.playIconFeed, compact && styles.playIconCompact]}>
              ▶
            </Text>
          </View>
        </View>
      ) : null}
    </>
  );

  const pressable = (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        isFeed ? styles.containerFeed : styles.containerInline,
        compact && styles.compact,
        !isFeed && !compact && styles.containerInlineFixed,
        style,
        pressed && onPlay && styles.pressed,
      ]}
      onPress={onPlay}
      disabled={!onPlay}
      accessibilityRole={onPlay ? "button" : undefined}
      accessibilityLabel={onPlay ? "Play video" : undefined}
    >
      {previewBody}
    </Pressable>
  );

  if (isFeed && unframed) {
    return (
      <Pressable
        style={({ pressed }) => [
          StyleSheet.absoluteFillObject,
          styles.containerFeed,
          pressed && onPlay && styles.pressed,
        ]}
        onPress={onPlay}
        disabled={!onPlay}
        accessibilityRole={onPlay ? "button" : undefined}
        accessibilityLabel={onPlay ? "Play video" : undefined}
      >
        {previewBody}
      </Pressable>
    );
  }

  if (isFeed) {
    return (
      <MediaAspectFrame
        dimensionsUri={dimensionsUri}
        layout="feed"
        style={style}
        maxPortraitRatio={FEED_MAX_PORTRAIT_RATIO}
      >
        {() => (
          <View style={[styles.containerFeed, styles.feedFill, styles.feedShell]}>
            <Pressable
              style={({ pressed }) => [styles.feedFill, pressed && onPlay && styles.pressed]}
              onPress={onPlay}
              disabled={!onPlay}
              accessibilityRole={onPlay ? "button" : undefined}
              accessibilityLabel={onPlay ? "Play video" : undefined}
            >
              {previewBody}
            </Pressable>
            {bottomRightOverlay ? (
              <View style={styles.bottomRightOverlaySlot} pointerEvents="box-none">
                {bottomRightOverlay}
              </View>
            ) : null}
          </View>
        )}
      </MediaAspectFrame>
    );
  }

  return pressable;
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
  },
  containerInline: {
    borderRadius: radius.md,
  },
  containerInlineFixed: {
    height: 220,
  },
  containerFeed: {
    borderRadius: 0,
    backgroundColor: colors.background,
  },
  feedFill: {
    width: "100%",
    height: "100%",
  },
  feedShell: {
    position: "relative",
  },
  bottomRightOverlaySlot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
    pointerEvents: "box-none",
  },
  compact: {
    height: "100%",
    borderRadius: 0,
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  loading: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 11, 0.25)",
  },
  overlayFeed: {
    backgroundColor: "rgba(10, 10, 11, 0.15)",
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(10, 10, 11, 0.78)",
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 4,
  },
  playButtonFeed: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    paddingLeft: 5,
  },
  playButtonCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingLeft: 3,
  },
  playIcon: {
    fontSize: 22,
    color: colors.accent,
    lineHeight: 24,
  },
  playIconFeed: {
    fontSize: 30,
    lineHeight: 32,
  },
  playIconCompact: {
    fontSize: 16,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.92,
  },
});
