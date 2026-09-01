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
  View,
} from "react-native";
import { Volume2, VolumeX, Maximize2 } from "lucide-react-native";
import {
  isActiveFeedVideo,
  isFeedVideoPlaybackAllowed,
  isFeedVideoSoundEnabled,
  registerFeedVideoPauseHandler,
  registerFeedVideoSyncHandlers,
  releaseFeedVideoDueToVisibility,
  requestFeedVideoPlay,
  setFeedVideoSoundEnabled,
  subscribeFeedVideoPlaybackAllowed,
  subscribeFeedVideoSoundPreference,
} from "./feedVideoPlaybackCoordinator";
import { MediaAspectFrame } from "./MediaAspectFrame";
import { MediaLoadError } from "./MediaLoadError";
import { FEED_VIDEO_FALLBACK_RATIO } from "./mediaLayout";
import { colors } from "./theme";
import { useFeedVideoIntersectionObserver } from "./useFeedVideoIntersectionObserver";
import { useVideoPoster, type VideoPosterState } from "./useVideoPoster";

/** Instagram-scale speaker control for inline feed video. */
const MUTE_BUTTON_SIZE = 36;
const MUTE_ICON_SIZE = 17;
const MUTE_INSET = 14;
/** Distinguish tap from vertical feed scroll on mobile web. */
const OPEN_VIEWER_TAP_MOVE_PX = 10;

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
  onVisualReady?: () => void;
}

/**
 * Inline feed video — autoplay muted when visible, pause when scrolled away,
 * one active video at a time. Tap opens fullscreen; speaker toggles sound.
 */
export function FeedVideoPlayer({
  uri,
  thumbnailUrl,
  posterState,
  playbackId,
  slideActive = true,
  style,
  onOpenFullscreen,
  onVisualReady,
}: FeedVideoPlayerProps) {
  const internalPoster = useVideoPoster(posterState ? undefined : uri, posterState ? null : thumbnailUrl);
  const resolvedPoster = posterState ?? internalPoster;
  const [inView, setInView] = useState(false);
  const inViewRef = useRef(false);
  inViewRef.current = inView;
  const [muted, setMuted] = useState(() => !isFeedVideoSoundEnabled());
  const [playbackAllowed, setPlaybackAllowed] = useState(() => isFeedVideoPlaybackAllowed());
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const shouldPlayRef = useRef(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const nativeIntersectionRef = useRef<View>(null);
  const nativeVideoRef = useRef<{
    pauseAsync: () => Promise<void>;
    playAsync: () => Promise<void>;
    setIsMutedAsync: (v: boolean) => Promise<void>;
  } | null>(null);
  const visualReadyRef = useRef(false);
  const openTapStartRef = useRef<{ x: number; y: number } | null>(null);

  const notifyVisualReady = useCallback(() => {
    if (visualReadyRef.current) return;
    visualReadyRef.current = true;
    onVisualReady?.();
  }, [onVisualReady]);

  const isActiveVideo = Boolean(playbackId && isActiveFeedVideo(playbackId));

  const pauseMediaElement = useCallback(() => {
    if (Platform.OS === "web") {
      webVideoRef.current?.pause();
    } else {
      void nativeVideoRef.current?.pauseAsync();
    }
  }, []);

  const handleScrollOutOfView = useCallback(() => {
    pauseMediaElement();
    setInView(false);
    if (playbackId) {
      releaseFeedVideoDueToVisibility(playbackId);
    }
  }, [pauseMediaElement, playbackId]);

  const handleScrollIntoView = useCallback(() => {
    setInView(true);
    if (playbackId && isFeedVideoPlaybackAllowed()) {
      requestFeedVideoPlay(playbackId);
    }
  }, [playbackId]);

  const shouldPlay = Boolean(
    inView &&
      playbackId &&
      isFeedVideoPlaybackAllowed() &&
      isActiveVideo &&
      slideActive &&
      !failed
  );
  shouldPlayRef.current = shouldPlay;

  const attemptWebAutoplay = useCallback(() => {
    if (Platform.OS !== "web") return;
    const video = webVideoRef.current;
    if (!video || !shouldPlayRef.current) return;

    video.muted = mutedRef.current;
    void video.play().catch((error: unknown) => {
      const videoEl = webVideoRef.current;
      if (!videoEl || !shouldPlayRef.current) return;

      const isAbort =
        error instanceof DOMException &&
        (error.name === "AbortError" || error.name === "NotAllowedError");
      const notReady = videoEl.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;

      if (isAbort || notReady) return;

      setFailed(true);
    });
  }, []);

  const intersectionEnabled = Boolean(
    playbackId && slideActive && !failed && isFeedVideoPlaybackAllowed()
  );

  const shouldEnterAbove = useCallback(() => !inViewRef.current, []);

  const intersectionTargetRef =
    Platform.OS === "web"
      ? (webVideoRef as RefObject<Element | null>)
      : (nativeIntersectionRef as unknown as RefObject<Element | null>);

  useFeedVideoIntersectionObserver(
    intersectionTargetRef,
    intersectionEnabled,
    handleScrollOutOfView,
    handleScrollIntoView,
    shouldEnterAbove
  );

  useEffect(() => {
    if (!playbackId) return;
    return registerFeedVideoPauseHandler(playbackId, pauseMediaElement);
  }, [playbackId, pauseMediaElement]);

  useEffect(() => {
    if (!playbackId || Platform.OS !== "web") return;
    return registerFeedVideoSyncHandlers(playbackId, {
      getCurrentTime: () => webVideoRef.current?.currentTime ?? 0,
      setCurrentTime: (time) => {
        const video = webVideoRef.current;
        if (!video) return;
        const duration = video.duration;
        video.currentTime =
          Number.isFinite(duration) && duration > 0
            ? Math.min(time, Math.max(0, duration - 0.05))
            : time;
      },
      getMuted: () => mutedRef.current,
      setMuted: (next) => setMuted(next),
      isPaused: () => webVideoRef.current?.paused ?? true,
    });
  }, [playbackId]);

  /** Re-claim coordinator ownership whenever visible but no longer the active player. */
  useEffect(() => {
    if (!inView || !playbackId || !slideActive || failed) return;
    if (!isActiveFeedVideo(playbackId)) {
      requestFeedVideoPlay(playbackId);
    }
  }, [failed, inView, isActiveVideo, playbackId, slideActive]);

  /** Sync React state when observation is disabled (e.g. slide/media gate) without a below-threshold event. */
  useEffect(() => {
    if (intersectionEnabled) return;
    pauseMediaElement();
    setInView(false);
    if (playbackId) {
      releaseFeedVideoDueToVisibility(playbackId);
    }
  }, [intersectionEnabled, pauseMediaElement, playbackId]);

  useEffect(() => {
    if (inView && slideActive) return;
    pauseMediaElement();
    if (playbackId) {
      releaseFeedVideoDueToVisibility(playbackId);
    }
  }, [inView, slideActive, pauseMediaElement, playbackId]);

  useEffect(() => {
    if (inView && playbackId && !isActiveFeedVideo(playbackId)) {
      pauseMediaElement();
    }
  }, [inView, playbackId, pauseMediaElement, isActiveVideo]);

  useEffect(() => {
    return subscribeFeedVideoSoundPreference(() => {
      setMuted(!isFeedVideoSoundEnabled());
    });
  }, []);

  useEffect(() => {
    return subscribeFeedVideoPlaybackAllowed(() => {
      setPlaybackAllowed(isFeedVideoPlaybackAllowed());
    });
  }, []);

  const dimensionsUri = resolvedPoster.posterUri ?? thumbnailUrl ?? undefined;

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
      attemptWebAutoplay();
      return;
    }

    video.pause();
  }, [attemptWebAutoplay, shouldPlay, muted, failed, uri, retryKey]);

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

  const openViewer = useCallback(() => {
    if (!onOpenFullscreen) return;
    onOpenFullscreen();
  }, [onOpenFullscreen]);

  const handleWebOpenPointerDown = useCallback(
    (event: { clientX: number; clientY: number; stopPropagation?: () => void }) => {
      event.stopPropagation?.();
      openTapStartRef.current = { x: event.clientX, y: event.clientY };
    },
    []
  );

  const handleWebOpenPointerUp = useCallback(
    (event: { clientX: number; clientY: number; stopPropagation?: () => void }) => {
      event.stopPropagation?.();
      const start = openTapStartRef.current;
      openTapStartRef.current = null;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.hypot(dx, dy) > OPEN_VIEWER_TAP_MOVE_PX) return;
      openViewer();
    },
    [openViewer]
  );

  const handleWebOpenPointerCancel = useCallback(() => {
    openTapStartRef.current = null;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      if (!next) {
        setFeedVideoSoundEnabled(true);
      }
      return next;
    });
  }, []);

  const handleRetry = useCallback(() => {
    setFailed(false);
    setInView(false);
    setRetryKey((key) => key + 1);
  }, []);

  const SpeakerIcon = muted ? VolumeX : Volume2;

  const muteControl = (
    <Pressable
      {...(Platform.OS === "web" ? { className: "feed-video-mute-button" } : null)}
      style={styles.muteButton}
      onPress={(event) => {
        event.stopPropagation?.();
        toggleMute();
      }}
      hitSlop={6}
      pointerEvents="auto"
      accessibilityRole="button"
      accessibilityLabel={muted ? "Unmute video" : "Mute video"}
    >
      <SpeakerIcon color="#FFFFFF" size={MUTE_ICON_SIZE} strokeWidth={2} />
    </Pressable>
  );

  const expandControl =
    onOpenFullscreen ? (
      <Pressable
        {...(Platform.OS === "web" ? { className: "feed-video-expand-button" } : null)}
        style={styles.expandButton}
        onPress={(event) => {
          event.stopPropagation?.();
          openViewer();
        }}
        hitSlop={6}
        pointerEvents="auto"
        accessibilityRole="button"
        accessibilityLabel="Open video full screen"
      >
        <Maximize2 color="#FFFFFF" size={16} strokeWidth={2} />
      </Pressable>
    ) : null;

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
        className: "feed-inline-video",
        ref: (node: HTMLVideoElement | null) => {
          webVideoRef.current = node;
        },
        src: uri,
        muted,
        playsInline: true,
        loop: true,
        preload: inView ? "auto" : "metadata",
        poster: resolvedPoster.posterUri ?? thumbnailUrl ?? undefined,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "contain",
          backgroundColor: colors.background,
          pointerEvents: "none",
        },
        onLoadedMetadata: () => {
          notifyVisualReady();
          if (shouldPlayRef.current) attemptWebAutoplay();
        },
        onCanPlay: () => {
          setBuffering(false);
          if (shouldPlayRef.current) attemptWebAutoplay();
        },
        onWaiting: () => setBuffering(true),
        onPlaying: () => setBuffering(false),
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
    <View style={styles.shell} collapsable={false}>
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
            <View style={styles.mediaLayer} pointerEvents="box-none">
              <View style={styles.videoSurface} pointerEvents="none">
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
              </View>

              {onOpenFullscreen ? (
                Platform.OS === "web" ? (
                  <View
                    style={styles.openHitLayer}
                    {...({
                      className: "feed-video-open-hit-layer",
                      onPointerDown: handleWebOpenPointerDown,
                      onPointerUp: handleWebOpenPointerUp,
                      onPointerCancel: handleWebOpenPointerCancel,
                    } as object)}
                    accessibilityRole="button"
                    accessibilityLabel="Open video full screen"
                  />
                ) : (
                  <Pressable
                    style={styles.openHitLayer}
                    onPress={openViewer}
                    accessibilityRole="button"
                    accessibilityLabel="Open video full screen"
                  />
                )
              ) : null}
            </View>
          </View>
        )}
      </MediaAspectFrame>

      {(onOpenFullscreen || playbackAllowed) ? (
        <View
          {...(Platform.OS === "web" ? { className: "feed-video-mute-layer" } : null)}
          style={styles.muteLayer}
          pointerEvents="box-none"
        >
          {expandControl}
          {playbackAllowed ? muteControl : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    width: "100%",
    position: "relative",
  },
  container: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.background,
    position: "relative",
  },
  mediaLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  videoSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  openHitLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    ...(Platform.OS === "web"
      ? ({
          touchAction: "pan-y",
          cursor: "pointer",
        } as const)
      : null),
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
  muteLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
    pointerEvents: "box-none",
    ...(Platform.OS === "web"
      ? ({
          transform: [{ translateZ: 0 }],
        } as const)
      : null),
  },
  muteButton: {
    position: "absolute",
    bottom: MUTE_INSET,
    right: MUTE_INSET,
    width: MUTE_BUTTON_SIZE,
    height: MUTE_BUTTON_SIZE,
    borderRadius: MUTE_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    zIndex: 101,
    elevation: 101,
    ...(Platform.OS === "web"
      ? ({
          pointerEvents: "auto",
          transform: [{ translateZ: 1 }],
        } as const)
      : null),
  },
  expandButton: {
    position: "absolute",
    top: MUTE_INSET,
    left: MUTE_INSET,
    width: MUTE_BUTTON_SIZE,
    height: MUTE_BUTTON_SIZE,
    borderRadius: MUTE_BUTTON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    zIndex: 101,
    elevation: 101,
    ...(Platform.OS === "web"
      ? ({
          pointerEvents: "auto",
          transform: [{ translateZ: 1 }],
        } as const)
      : null),
  },
});
