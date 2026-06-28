import { createElement, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { MediaAspectFrame } from "./MediaAspectFrame";
import { MediaLoadError } from "./MediaLoadError";
import { FEED_VIDEO_FALLBACK_RATIO } from "./mediaLayout";
import { colors, spacing } from "./theme";
import { useVideoPoster, type VideoPosterState } from "./useVideoPoster";
import { VideoPreview } from "./VideoPreview";

interface FeedVideoPlayerProps {
  uri: string;
  thumbnailUrl?: string | null;
  posterState?: VideoPosterState;
  /** Autoplay muted when true (feed visibility + active carousel slide). */
  shouldPlay?: boolean;
  style?: ViewStyle;
  onOpenFullscreen?: () => void;
}

/**
 * Inline feed video — poster first, autoplay when mostly visible, tap for fullscreen.
 * Muted by default; tap mute control to toggle audio.
 */
export function FeedVideoPlayer({
  uri,
  thumbnailUrl,
  posterState,
  shouldPlay = false,
  style,
  onOpenFullscreen,
}: FeedVideoPlayerProps) {
  const internalPoster = useVideoPoster(posterState ? undefined : uri, posterState ? null : thumbnailUrl);
  const resolvedPoster = posterState ?? internalPoster;
  const [muted, setMuted] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const nativeVideoRef = useRef<{ pauseAsync: () => Promise<void>; playAsync: () => Promise<void>; setIsMutedAsync: (v: boolean) => Promise<void> } | null>(null);

  const dimensionsUri = resolvedPoster.posterUri ?? thumbnailUrl ?? undefined;
  const showPoster = !shouldPlay || failed;

  useEffect(() => {
    setFailed(false);
  }, [uri, retryKey]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const video = webVideoRef.current;
    if (!video) return;

    if (shouldPlay && !failed) {
      video.muted = muted;
      void video.play().catch(() => setFailed(true));
    } else {
      video.pause();
    }
  }, [shouldPlay, muted, failed, uri, retryKey]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const video = nativeVideoRef.current;
    if (!video) return;

    void (async () => {
      try {
        await video.setIsMutedAsync(muted);
        if (shouldPlay && !failed) await video.playAsync();
        else await video.pauseAsync();
      } catch {
        setFailed(true);
      }
    })();
  }, [shouldPlay, muted, failed, uri, retryKey]);

  const toggleMute = useCallback(() => {
    setMuted((current) => !current);
  }, []);

  const handleRetry = useCallback(() => {
    setFailed(false);
    setRetryKey((key) => key + 1);
  }, []);

  if (failed) {
    return (
      <MediaAspectFrame
        dimensionsUri={dimensionsUri}
        layout="feed"
        style={style}
        fallbackRatio={FEED_VIDEO_FALLBACK_RATIO}
      >
        {() => <MediaLoadError label="Video unavailable" onRetry={handleRetry} />}
      </MediaAspectFrame>
    );
  }

  if (showPoster && !shouldPlay) {
    return (
      <VideoPreview
        videoUri={uri}
        posterState={resolvedPoster}
        thumbnailUrl={thumbnailUrl}
        style={style}
        layout="feed"
        onPlay={onOpenFullscreen}
      />
    );
  }

  const videoBody =
    Platform.OS === "web" ? (
      createElement("video", {
        key: retryKey,
        ref: (node: HTMLVideoElement | null) => {
          webVideoRef.current = node;
        },
        src: uri,
        muted,
        playsInline: true,
        loop: true,
        preload: "metadata",
        poster: resolvedPoster.posterUri ?? thumbnailUrl ?? undefined,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "contain",
          backgroundColor: colors.background,
        },
        onWaiting: () => setBuffering(true),
        onPlaying: () => setBuffering(false),
        onCanPlay: () => setBuffering(false),
        onError: () => setFailed(true),
      })
    ) : (
      (() => {
        try {
          const { Video, ResizeMode } = require("expo-av") as typeof import("expo-av");
          return (
            <Video
              key={retryKey}
              ref={(ref) => {
                nativeVideoRef.current = ref;
              }}
              source={{ uri }}
              style={styles.videoFill}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={shouldPlay}
              isMuted={muted}
              isLooping
              useNativeControls={false}
              posterSource={
                resolvedPoster.posterUri ? { uri: resolvedPoster.posterUri } : undefined
              }
              usePoster={Boolean(resolvedPoster.posterUri)}
              onPlaybackStatusUpdate={(status) => {
                if (!status.isLoaded) {
                  if ("error" in status && status.error) setFailed(true);
                  return;
                }
                setBuffering(status.isBuffering);
              }}
            />
          );
        } catch {
          return <MediaLoadError label="Video unavailable" onRetry={handleRetry} />;
        }
      })()
    );

  return (
    <MediaAspectFrame
      dimensionsUri={dimensionsUri}
      layout="feed"
      style={style}
      fallbackRatio={FEED_VIDEO_FALLBACK_RATIO}
    >
      {() => (
        <Pressable
          style={styles.container}
          onPress={onOpenFullscreen}
          accessibilityRole="button"
          accessibilityLabel="Open video full screen"
        >
          {videoBody}

          {buffering ? (
            <View style={styles.bufferingOverlay} pointerEvents="none">
              <ActivityIndicator color={colors.accent} size="large" />
            </View>
          ) : null}

          <Pressable
            style={styles.muteButton}
            onPress={(event) => {
              event.stopPropagation?.();
              toggleMute();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={muted ? "Unmute video" : "Mute video"}
          >
            <Text style={styles.muteIcon}>{muted ? "🔇" : "🔊"}</Text>
          </Pressable>
        </Pressable>
      )}
    </MediaAspectFrame>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.background,
  },
  videoFill: {
    width: "100%",
    height: "100%",
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 11, 0.35)",
  },
  muteButton: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 11, 0.75)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  muteIcon: {
    fontSize: 16,
    lineHeight: 18,
  },
});
