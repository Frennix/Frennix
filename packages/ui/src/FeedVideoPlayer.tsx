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
import { Volume2, VolumeX } from "lucide-react-native";
import {
  getActiveFeedVideoId,
  isActiveFeedVideo,
  isFeedVideoPlaybackAllowed,
  isFeedVideoSoundEnabled,
  registerFeedVideoPauseHandler,
  releaseFeedVideoDueToVisibility,
  requestFeedVideoPlay,
  setFeedVideoSoundEnabled,
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
 * Inline feed video — autoplay muted when visible, pause when scrolled away,
 * one active video at a time. Tap toggles play/pause; speaker toggles sound.
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
  const [inView, setInView] = useState(false);
  const [userPaused, setUserPausedState] = useState(false);
  const userPausedRef = useRef(false);
  const setUserPaused = useCallback((paused: boolean) => {
    userPausedRef.current = paused;
    setUserPausedState(paused);
  }, []);
  const [muted, setMuted] = useState(() => !isFeedVideoSoundEnabled());
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
  }, []);

  const handleScrollOutOfView = useCallback(() => {
    pauseMediaElement();
    setInView(false);
    setUserPaused(false);
    if (playbackId) {
      releaseFeedVideoDueToVisibility(playbackId);
    }
  }, [pauseMediaElement, playbackId, setUserPaused]);

  const handleScrollIntoView = useCallback(() => {
    setInView(true);
    if (!userPausedRef.current && playbackId && isFeedVideoPlaybackAllowed()) {
      requestFeedVideoPlay(playbackId);
    }
  }, [playbackId]);

  const shouldPlay = Boolean(
    inView &&
      !userPaused &&
      playbackId &&
      isFeedVideoPlaybackAllowed() &&
      isActiveVideo &&
      slideActive &&
      !failed
  );

  const intersectionEnabled = Boolean(
    playbackId && slideActive && !failed && isFeedVideoPlaybackAllowed()
  );

  const intersectionTargetRef =
    Platform.OS === "web"
      ? (webVideoRef as RefObject<Element | null>)
      : (nativeIntersectionRef as unknown as RefObject<Element | null>);

  useFeedVideoIntersectionObserver(
    intersectionTargetRef,
    intersectionEnabled,
    handleScrollOutOfView,
    handleScrollIntoView
  );

  useEffect(() => {
    if (!playbackId) return;
    return registerFeedVideoPauseHandler(playbackId, pauseMediaElement);
  }, [playbackId, pauseMediaElement]);

  useEffect(() => {
    if (!inView || userPaused || !playbackId || !slideActive || failed) return;
    if (!isActiveFeedVideo(playbackId) && getActiveFeedVideoId() === null) {
      requestFeedVideoPlay(playbackId);
    }
  }, [failed, inView, isActiveVideo, playbackId, slideActive, userPaused]);

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

  const handleVideoTap = useCallback(() => {
    if (!playbackId || !inView) return;
    if (userPausedRef.current || !shouldPlay) {
      setUserPaused(false);
      requestFeedVideoPlay(playbackId);
      return;
    }
    setUserPaused(true);
    pauseMediaElement();
  }, [inView, pauseMediaElement, playbackId, setUserPaused, shouldPlay]);

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
    setUserPaused(false);
    setInView(false);
    setRetryKey((key) => key + 1);
  }, [setUserPaused]);

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
              <Pressable
                style={styles.mediaTapArea}
                onPress={handleVideoTap}
                onLongPress={onOpenFullscreen}
                delayLongPress={450}
                accessibilityRole="button"
                accessibilityLabel={shouldPlay ? "Pause video" : "Play video"}
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
            </View>
          </View>
        )}
      </MediaAspectFrame>

      <View
        {...(Platform.OS === "web" ? { className: "feed-video-mute-layer" } : null)}
        style={styles.muteLayer}
        pointerEvents="box-none"
      >
        {muteControl}
      </View>
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
});
