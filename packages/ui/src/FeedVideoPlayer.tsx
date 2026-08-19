import {
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type ViewStyle,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  isActiveFeedVideo,
  isFeedVideoPlaybackAllowed,
  registerFeedVideoPauseHandler,
  releaseFeedVideoDueToVisibility,
  requestFeedVideoPlay,
} from "./feedVideoPlaybackCoordinator";
import { MediaAspectFrame } from "./MediaAspectFrame";
import { MediaLoadError } from "./MediaLoadError";
import { FEED_VIDEO_FALLBACK_RATIO } from "./mediaLayout";
import { colors, spacing } from "./theme";
import { useFeedVideoIntersectionObserver } from "./useFeedVideoIntersectionObserver";
import { useVideoPoster, type VideoPosterState } from "./useVideoPoster";
import { VideoPreview } from "./VideoPreview";

interface FeedVideoPlayerProps {
  uri: string;
  thumbnailUrl?: string | null;
  posterState?: VideoPosterState;
  /** Unique id for single-active-video coordination. */
  playbackId?: string;
  /** Active carousel slide — inactive slides cannot keep playing. */
  slideActive?: boolean;
  style?: ViewStyle;
  onOpenFullscreen?: () => void;
}

/**
 * Inline feed video — tap to play, pause when scrolled away, one active video at a time.
 * Muted by default; tap mute control to toggle audio. Tap playing video for fullscreen.
 */
export function FeedVideoPlayer({
  uri,
  thumbnailUrl,
  posterState,
  playbackId,
  slideActive = true,
  style,
  onOpenFullscreen,
}: FeedVideoPlayerProps) {
  const internalPoster = useVideoPoster(posterState ? undefined : uri, posterState ? null : thumbnailUrl);
  const resolvedPoster = posterState ?? internalPoster;
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const nativeIntersectionRef = useRef<View>(null);
  const nativeVideoRef = useRef<{
    pauseAsync: () => Promise<void>;
    playAsync: () => Promise<void>;
    setIsMutedAsync: (v: boolean) => Promise<void>;
  } | null>(null);

  const isActiveVideo = Boolean(playbackId && isActiveFeedVideo(playbackId));

  const pauseMediaElement = useCallback(() => {
    if (Platform.OS === "web") {
      webVideoRef.current?.pause();
    } else {
      void nativeVideoRef.current?.pauseAsync();
    }
    setIsPlaying(false);
  }, []);

  const handleScrollOutOfView = useCallback(() => {
    pauseMediaElement();
    if (playbackId) {
      releaseFeedVideoDueToVisibility(playbackId);
    }
  }, [pauseMediaElement, playbackId]);

  const shouldPlay = Boolean(
    isPlaying &&
      playbackId &&
      isFeedVideoPlaybackAllowed() &&
      isActiveVideo &&
      slideActive &&
      !failed
  );

  const intersectionTargetRef =
    Platform.OS === "web"
      ? (webVideoRef as RefObject<Element | null>)
      : (nativeIntersectionRef as unknown as RefObject<Element | null>);

  useFeedVideoIntersectionObserver(intersectionTargetRef, shouldPlay, handleScrollOutOfView);

  useEffect(() => {
    if (!playbackId) return;
    return registerFeedVideoPauseHandler(playbackId, pauseMediaElement);
  }, [playbackId, pauseMediaElement]);

  useEffect(() => {
    if (!isPlaying || slideActive) return;
    pauseMediaElement();
    if (playbackId) {
      releaseFeedVideoDueToVisibility(playbackId);
    }
  }, [isPlaying, slideActive, pauseMediaElement, playbackId]);

  useEffect(() => {
    if (isPlaying && playbackId && !isActiveFeedVideo(playbackId)) {
      pauseMediaElement();
    }
  }, [isPlaying, playbackId, pauseMediaElement, isActiveVideo]);

  const dimensionsUri = resolvedPoster.posterUri ?? thumbnailUrl ?? undefined;
  const showPoster = !shouldPlay;

  useEffect(() => {
    setFailed(false);
  }, [uri, retryKey]);

  useLayoutEffect(() => {
    return () => {
      webVideoRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const video = webVideoRef.current;
    if (!video) return;

    if (shouldPlay) {
      video.muted = muted;
      void video.play().catch(() => setFailed(true));
      return;
    }

    video.pause();
  }, [shouldPlay, muted, failed, uri, retryKey]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const video = nativeVideoRef.current;
    if (!video) return;

    void (async () => {
      try {
        await video.setIsMutedAsync(muted);
        if (shouldPlay) await video.playAsync();
        else await video.pauseAsync();
      } catch {
        setFailed(true);
      }
    })();
  }, [shouldPlay, muted, failed, uri, retryKey]);

  const handleTapPlay = useCallback(() => {
    if (!playbackId) return;
    requestFeedVideoPlay(playbackId);
    setIsPlaying(true);
  }, [playbackId]);

  const toggleMute = useCallback(() => {
    setMuted((current) => !current);
  }, []);

  const handleRetry = useCallback(() => {
    setFailed(false);
    setIsPlaying(false);
    setRetryKey((key) => key + 1);
  }, []);

  const muteControl = (
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
  );

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
        <View
          ref={Platform.OS === "web" ? undefined : nativeIntersectionRef}
          collapsable={false}
          style={styles.container}
        >
          {showPoster ? (
            <VideoPreview
              videoUri={uri}
              posterState={resolvedPoster}
              thumbnailUrl={thumbnailUrl}
              layout="feed"
              unframed
              showPlayButton={false}
              onPlay={handleTapPlay}
            />
          ) : (
            <Pressable
              style={styles.mediaTapArea}
              onPress={onOpenFullscreen}
              accessibilityRole="button"
              accessibilityLabel="Open video full screen"
            >
              {videoBody}

              {buffering ? (
                <View
                  style={styles.bufferingOverlay}
                  pointerEvents="none"
                  accessibilityLabel="Video loading"
                  accessibilityRole="progressbar"
                >
                  <ActivityIndicator color={colors.accent} size="large" accessibilityLabel="Loading video" />
                </View>
              ) : null}
            </Pressable>
          )}

          <View style={styles.muteOverlaySlot} pointerEvents="box-none">
            {muteControl}
          </View>
        </View>
      )}
    </MediaAspectFrame>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.background,
    position: "relative",
  },
  mediaTapArea: {
    width: "100%",
    height: "100%",
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
  muteOverlaySlot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
    pointerEvents: "box-none",
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
