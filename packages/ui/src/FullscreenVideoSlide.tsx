import {
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Volume2, VolumeX } from "lucide-react-native";
import {
  restoreFeedVideoFromFullscreen,
  type FeedVideoFullscreenHandoff,
} from "./feedVideoPlaybackCoordinator";
import { MediaLoadError } from "./MediaLoadError";
import { ProgressiveImage } from "./ProgressiveImage";
import { colors } from "./theme";
import { useVideoPoster } from "./useVideoPoster";

/** Match ImageLightbox close chrome — fixed mute sits just left of the ✕. */
const LIGHTBOX_CLOSE_SIZE = 34;
const LIGHTBOX_CLOSE_RIGHT_INSET = 8;
const LIGHTBOX_CONTROL_GAP = 12;
const FULLSCREEN_MUTE_SIZE = 34;
const FULLSCREEN_MUTE_ICON = 17;
const FULLSCREEN_MUTE_RIGHT =
  LIGHTBOX_CLOSE_RIGHT_INSET + LIGHTBOX_CLOSE_SIZE + LIGHTBOX_CONTROL_GAP;
const FULLSCREEN_CONTROLS_HIDE_MS = 2500;

interface FullscreenVideoSlideProps {
  uri: string;
  thumbnailUrl?: string | null;
  stageWidth: number;
  stageHeight: number;
  isActive: boolean;
  /** Feed → fullscreen timestamp handoff for the active slide. */
  playbackHandoff?: FeedVideoFullscreenHandoff;
}

function configureInlineWebVideo(video: HTMLVideoElement) {
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("x-webkit-airplay", "deny");
  video.disablePictureInPicture = true;
  video.disableRemotePlayback = true;
  try {
    video.controlsList.add("nofullscreen");
    video.controlsList.add("noremoteplayback");
    video.controlsList.add("nodownload");
  } catch {
    // controlsList unsupported — CSS/webkitbeginfullscreen guard still applies.
  }
}

/** Full-screen gallery video slide — inline WebKit controls only; no native fullscreen step. */
export function FullscreenVideoSlide({
  uri,
  thumbnailUrl,
  stageWidth,
  stageHeight,
  isActive,
  playbackHandoff,
}: FullscreenVideoSlideProps) {
  const posterState = useVideoPoster(uri, thumbnailUrl);
  const [muted, setMuted] = useState(playbackHandoff?.muted ?? false);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [handoffReady, setHandoffReady] = useState(!playbackHandoff);
  const [controlsReady, setControlsReady] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [controlsPinned, setControlsPinned] = useState(false);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsPinnedRef = useRef(false);
  const handoffAppliedRef = useRef(false);
  const nativeVideoRef = useRef<{
    pauseAsync: () => Promise<void>;
    playAsync: () => Promise<void>;
    setIsMutedAsync: (v: boolean) => Promise<void>;
  } | null>(null);

  controlsPinnedRef.current = controlsPinned;

  const clearHideControlsTimer = useCallback(() => {
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  }, []);

  const scheduleControlsHide = useCallback(() => {
    clearHideControlsTimer();
    hideControlsTimerRef.current = setTimeout(() => {
      if (!controlsPinnedRef.current) {
        setControlsVisible(false);
      }
    }, FULLSCREEN_CONTROLS_HIDE_MS);
  }, [clearHideControlsTimer]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  useEffect(() => {
    setFailed(false);
    handoffAppliedRef.current = false;
    setHandoffReady(!playbackHandoff);
    setControlsReady(false);
    setControlsVisible(true);
    setControlsPinned(false);
    clearHideControlsTimer();
  }, [uri, retryKey, playbackHandoff, clearHideControlsTimer]);

  const applyPlaybackHandoff = useCallback(() => {
    if (handoffAppliedRef.current || !playbackHandoff) return;
    const video = webVideoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) return;

    const duration = video.duration;
    const target = Number.isFinite(duration)
      ? Math.min(playbackHandoff.currentTime, Math.max(0, duration - 0.05))
      : playbackHandoff.currentTime;

    video.currentTime = target;
    video.muted = playbackHandoff.muted;
    setMuted(playbackHandoff.muted);
    handoffAppliedRef.current = true;
    setHandoffReady(true);
  }, [playbackHandoff]);

  useLayoutEffect(() => {
    if (Platform.OS !== "web" || !isActive) return;
    const video = webVideoRef.current;
    if (!video) return;

    video.classList.add("fullscreen-video-slide");
    configureInlineWebVideo(video);
    video.controls = true;

    const blockNativeFullscreen = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof video.webkitExitFullscreen === "function") {
        void video.webkitExitFullscreen();
      }
    };

    video.addEventListener("webkitbeginfullscreen", blockNativeFullscreen, true);
    setControlsReady(true);
    scheduleControlsHide();

    return () => {
      video.removeEventListener("webkitbeginfullscreen", blockNativeFullscreen, true);
    };
  }, [isActive, retryKey, uri, scheduleControlsHide]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const video = webVideoRef.current;
    if (!video || !handoffReady) return;

    video.muted = muted;
    if (isActive && !failed) {
      void video.play().catch(() => setFailed(true));
      return;
    }
    video.pause();
  }, [handoffReady, isActive, muted, failed, uri, retryKey]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const video = nativeVideoRef.current;
    if (!video) return;

    void (async () => {
      try {
        await video.setIsMutedAsync(muted);
        if (isActive && !failed) await video.playAsync();
        else await video.pauseAsync();
      } catch {
        setFailed(true);
      }
    })();
  }, [isActive, muted, failed, uri, retryKey]);

  useEffect(() => {
    return () => {
      clearHideControlsTimer();
      if (!playbackHandoff?.playbackId || Platform.OS !== "web") return;
      const video = webVideoRef.current;
      if (!video) return;
      restoreFeedVideoFromFullscreen(playbackHandoff.playbackId, video.currentTime, video.muted);
    };
  }, [playbackHandoff, clearHideControlsTimer]);

  const handleRetry = useCallback(() => {
    setFailed(false);
    setRetryKey((key) => key + 1);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((current) => !current);
  }, []);

  const handleWebPause = useCallback(() => {
    setControlsPinned(true);
    setControlsVisible(true);
    clearHideControlsTimer();
  }, [clearHideControlsTimer]);

  const handleWebPlay = useCallback(() => {
    setControlsPinned(false);
    setControlsVisible(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  const SpeakerIcon = muted ? VolumeX : Volume2;
  const chromeControlsVisible = controlsVisible || controlsPinned;

  const controlsClassName = chromeControlsVisible
    ? "fullscreen-controls-visible"
    : "fullscreen-controls-hidden";

  const webChromeMute =
    Platform.OS === "web" &&
    isActive &&
    controlsReady &&
    typeof document !== "undefined"
      ? createPortal(
          <Pressable
            className={`fullscreen-video-mute-button${chromeControlsVisible ? "" : " fullscreen-chrome-hidden"}`}
            style={styles.webChromeMute}
            onPress={toggleMute}
            accessibilityRole="button"
            accessibilityLabel={muted ? "Unmute video" : "Mute video"}
          >
            <SpeakerIcon color="#FFFFFF" size={FULLSCREEN_MUTE_ICON} strokeWidth={2} />
          </Pressable>,
          document.body
        )
      : null;

  if (failed) {
    return (
      <View style={[styles.stage, { width: stageWidth, height: stageHeight }]}>
        <MediaLoadError label="Video unavailable" onRetry={handleRetry} />
      </View>
    );
  }

  return (
    <View style={[styles.stage, { width: stageWidth, height: stageHeight }]}>
      {Platform.OS === "web" ? (
        createElement("video", {
          key: retryKey,
          className: `fullscreen-video-slide ${controlsClassName}`,
          ref: (node: HTMLVideoElement | null) => {
            webVideoRef.current = node;
            if (node) configureInlineWebVideo(node);
          },
          src: uri,
          muted,
          playsInline: true,
          // @ts-expect-error RN web passes through to DOM
          "webkit-playsinline": "true",
          // @ts-expect-error legacy AirPlay guard
          "x-webkit-airplay": "deny",
          controlsList: "nodownload nofullscreen noremoteplayback",
          disablePictureInPicture: true,
          disableRemotePlayback: true,
          preload: isActive ? "auto" : "metadata",
          poster: posterState.posterUri ?? thumbnailUrl ?? undefined,
          style: {
            width: stageWidth,
            height: stageHeight,
            objectFit: "contain",
            backgroundColor: colors.background,
          },
          onLoadedMetadata: applyPlaybackHandoff,
          onCanPlay: () => {
            setBuffering(false);
            applyPlaybackHandoff();
          },
          onWaiting: () => setBuffering(true),
          onPlaying: () => {
            setBuffering(false);
          },
          onPlay: handleWebPlay,
          onPause: handleWebPause,
          onClick: revealControls,
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
                style={{ width: stageWidth, height: stageHeight }}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={isActive}
                isMuted={muted}
                useNativeControls
                posterSource={
                  posterState.posterUri ? { uri: posterState.posterUri } : undefined
                }
                usePoster={Boolean(posterState.posterUri)}
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
      )}

      {!isActive && posterState.posterUri ? (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <ProgressiveImage
            uri={posterState.posterUri}
            placeholderUri={thumbnailUrl}
            style={{ width: stageWidth, height: stageHeight }}
            contentFit="contain"
            accessibilityLabel="Video poster"
          />
        </View>
      ) : null}

      {buffering ? (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : null}

      {webChromeMute}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
    backgroundColor: colors.background,
  },
  webChromeMute: Platform.select({
    web: {
      position: "fixed",
      top: "max(env(safe-area-inset-top, 0px), 12px)",
      right: FULLSCREEN_MUTE_RIGHT,
      width: FULLSCREEN_MUTE_SIZE,
      height: FULLSCREEN_MUTE_SIZE,
      borderRadius: FULLSCREEN_MUTE_SIZE / 2,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0, 0, 0, 0.55)",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.28)",
      zIndex: 100000,
      boxShadow: "0 1px 6px rgba(0, 0, 0, 0.35)",
      cursor: "pointer",
    } as object,
    default: {},
  }),
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 11, 0.35)",
  },
});
