import { createElement, useState } from "react";
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { PostType } from "@frennix/types";
import { inferPostMediaKind } from "@frennix/types";
import { FeedVideoPlayer } from "./FeedVideoPlayer";
import { buildFeedVideoPlaybackId } from "./feedVideoPlaybackCoordinator";
import { MediaAspectFrame } from "./MediaAspectFrame";
import { MediaLoadError } from "./MediaLoadError";
import { ProgressiveImage } from "./ProgressiveImage";
import { VideoPreview } from "./VideoPreview";
import { VideoPosterFallback } from "./VideoPosterFallback";
import { useVideoPoster } from "./useVideoPoster";
import { WebVideoFrame } from "./WebVideoFrame";
import { FEED_MAX_PORTRAIT_RATIO, FEED_VIDEO_FALLBACK_RATIO, type MediaLayout } from "./mediaLayout";
import { feedMediaRules } from "./feed-layout/feedMediaRules";
import { colors, radius } from "./theme";

interface PostMediaProps {
  uri: string;
  postType?: PostType;
  thumbnailUrl?: string | null;
  style?: ViewStyle;
  layout?: MediaLayout;
  onImagePress?: () => void;
  onVideoPress?: () => void;
  /** Mobile web /video/[postId] href for feed inline video. */
  videoRouteHref?: string;
  onVideoRouteNavigate?: () => void;
  pressDelayMs?: number;
  maxHeight?: number;
  /** Active carousel slide — inactive slides stop feed video playback. */
  slideActive?: boolean;
  /** Scope id for feed video playback coordination (typically post id). */
  playbackScopeId?: string;
  /** Index within the post media carousel. */
  mediaIndex?: number;
  /** @deprecated Row visibility no longer autoplays feed video. */
  mediaVisible?: boolean;
  onVisualReady?: () => void;
}

function isVideoMedia(postType?: PostType, uri?: string) {
  return inferPostMediaKind(uri ?? "", { postType, index: 0 }) === "video";
}

function VideoPlayer({
  uri,
  posterUri,
  useVideoFrameFallback,
  style,
  layout = "inline",
}: {
  uri: string;
  posterUri: string | null;
  useVideoFrameFallback: boolean;
  style: StyleProp<ViewStyle>;
  layout?: MediaLayout;
}) {
  const isFeed = layout === "feed";
  const borderRadius = isFeed ? 0 : radius.md;

  if (Platform.OS === "web" && useVideoFrameFallback && !posterUri) {
    return (
      <View style={[style, styles.webFrameWrapper, isFeed && styles.webFrameFeed]}>
        <WebVideoFrame uri={uri} fit={isFeed ? "contain" : "cover"} />
      </View>
    );
  }

  if (Platform.OS === "web") {
    return createElement("video", {
      src: uri,
      controls: true,
      playsInline: true,
      preload: layout === "feed" ? "none" : "metadata",
      poster: posterUri ?? undefined,
      style: {
        width: "100%",
        height: "100%",
        borderRadius,
        backgroundColor: isFeed ? colors.background : colors.surfaceElevated,
        objectFit: "contain",
      },
    });
  }

  try {
    const { Video, ResizeMode } = require("expo-av") as typeof import("expo-av");
    return (
      <Video
        source={{ uri }}
        style={[style, styles.videoFill]}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        isLooping={false}
        posterSource={posterUri ? { uri: posterUri } : undefined}
        usePoster={Boolean(posterUri)}
      />
    );
  } catch {
    return (
      <View style={[style, styles.fallback]}>
        <VideoPosterFallback label="Video unavailable" />
      </View>
    );
  }
}

export function PostMedia({
  uri,
  postType,
  thumbnailUrl,
  style,
  layout = "inline",
  onImagePress,
  onVideoPress,
  videoRouteHref,
  onVideoRouteNavigate,
  pressDelayMs,
  maxHeight,
  slideActive = true,
  playbackScopeId,
  mediaIndex = 0,
  mediaVisible = true,
  onVisualReady,
}: PostMediaProps) {
  const isVideo = isVideoMedia(postType, uri);
  const [playing, setPlaying] = useState(false);
  const posterState = useVideoPoster(isVideo ? uri : undefined, thumbnailUrl);
  const dimensionsUri = isVideo
    ? posterState.posterUri ?? thumbnailUrl ?? undefined
    : uri;

  if (isVideo && layout === "feed") {
    const playbackId =
      playbackScopeId != null
        ? buildFeedVideoPlaybackId(playbackScopeId, mediaIndex)
        : undefined;

    return (
      <FeedVideoPlayer
        uri={uri}
        thumbnailUrl={thumbnailUrl}
        posterState={posterState}
        playbackId={playbackId}
        slideActive={slideActive && mediaVisible}
        style={style}
        onOpenFullscreen={videoRouteHref ? undefined : onVideoPress}
        videoRouteHref={videoRouteHref}
        onVideoRouteNavigate={onVideoRouteNavigate}
        onVisualReady={onVisualReady}
      />
    );
  }

  if (isVideo && !playing) {
    return (
      <VideoPreview
        videoUri={uri}
        posterState={posterState}
        thumbnailUrl={thumbnailUrl}
        style={style}
        layout={layout}
        onPlay={() => {
          if (onVideoPress) onVideoPress();
          else setPlaying(true);
        }}
      />
    );
  }

  if (isVideo) {
    return (
      <MediaAspectFrame
        dimensionsUri={dimensionsUri}
        layout={layout}
        style={style}
        fallbackRatio={FEED_VIDEO_FALLBACK_RATIO}
      >
        {() => (
          <VideoPlayer
            uri={uri}
            posterUri={posterState.posterUri}
            useVideoFrameFallback={posterState.useVideoFrameFallback}
            style={styles.videoFill}
            layout={layout}
          />
        )}
      </MediaAspectFrame>
    );
  }

  return (
    <FeedImage
      uri={uri}
      thumbnailUrl={thumbnailUrl}
      style={style}
      layout={layout}
      onImagePress={onImagePress}
      pressDelayMs={pressDelayMs}
      maxHeight={maxHeight}
      onVisualReady={onVisualReady}
    />
  );
}

function FeedImage({
  uri,
  thumbnailUrl,
  style,
  layout,
  onImagePress,
  pressDelayMs,
  maxHeight,
  onVisualReady,
}: {
  uri: string;
  thumbnailUrl?: string | null;
  style: StyleProp<ViewStyle>;
  layout: MediaLayout;
  onImagePress?: () => void;
  pressDelayMs?: number;
  maxHeight?: number;
  onVisualReady?: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const content = (
    <MediaAspectFrame
      dimensionsUri={uri}
      layout={layout}
      style={style}
      maxHeight={maxHeight}
      maxPortraitRatio={layout === "feed" ? FEED_MAX_PORTRAIT_RATIO : undefined}
    >
      {({ portraitCapped }) => (
        <>
          {imageFailed ? (
            <MediaLoadError
              label="Photo unavailable"
              style={styles.imageFallback}
              onRetry={() => {
                setImageFailed(false);
                setRetryKey((key) => key + 1);
              }}
            />
          ) : (
            <ProgressiveImage
              key={retryKey}
              uri={uri}
              placeholderUri={thumbnailUrl}
              style={styles.image}
              contentFit={
                layout === "feed"
                  ? portraitCapped
                    ? "cover"
                    : feedMediaRules.contentFit
                  : "contain"
              }
              accessibilityLabel="Post photo"
              onError={() => setImageFailed(true)}
              onLoad={onVisualReady}
            />
          )}
        </>
      )}
    </MediaAspectFrame>
  );

  if (onImagePress) {
    return (
      <TouchableOpacity
        activeOpacity={0.95}
        delayPressIn={pressDelayMs ?? 0}
        onPress={onImagePress}
        accessibilityRole="button"
        accessibilityLabel="View full image"
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    ...StyleSheet.absoluteFillObject,
  },
  fallback: { alignItems: "center", justifyContent: "center", flex: 1 },
  webFrameWrapper: { overflow: "hidden", borderRadius: radius.md, flex: 1, width: "100%" },
  webFrameFeed: { borderRadius: 0 },
  videoFill: { width: "100%", height: "100%" },
});

export { isVideoMedia };
