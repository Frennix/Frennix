import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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
  Text,
  View,
} from "react-native";
import { FastForward, Pause, Play, Rewind, Volume2, VolumeX } from "lucide-react-native";
import {
  restoreFeedVideoFromFullscreen,
  setFeedVideoFullscreenHandoff,
  isFeedVideoSoundEnabled,
  type FeedVideoFullscreenHandoff,
} from "./feedVideoPlaybackCoordinator";
import {
  adoptFeedVideoDomForFullscreen,
  configureFeedWebVideoElement,
  getRegisteredFeedVideoElement,
  returnFeedVideoDomFromFullscreen,
} from "./feedVideoDom";
import { MediaLoadError } from "./MediaLoadError";
import { ProgressiveImage } from "./ProgressiveImage";
import { colors } from "./theme";
import { useVideoPoster } from "./useVideoPoster";
import {
  VIDEO_FIRST_FRAME_TIMEOUT_MS,
  classifyVideoMediaError,
  logVideoMediaFailure,
  mediaExtensionFromUri,
  shouldAutoRetryVideoLoad,
  type VideoMediaFailureReason,
} from "./videoMediaDelivery";

/** Match ImageLightbox close chrome — fixed mute sits just left of the ✕. */
const LIGHTBOX_CLOSE_SIZE = 34;
const LIGHTBOX_CLOSE_RIGHT_INSET = 8;
const LIGHTBOX_CONTROL_GAP = 12;
const FULLSCREEN_MUTE_SIZE = 34;
const FULLSCREEN_MUTE_ICON = 17;
const FULLSCREEN_MUTE_RIGHT =
  LIGHTBOX_CLOSE_RIGHT_INSET + LIGHTBOX_CLOSE_SIZE + LIGHTBOX_CONTROL_GAP;
const FULLSCREEN_CONTROLS_HIDE_MS = 2500;
const SEEK_STEP_SECONDS = 10;
const TRANSPORT_ICON = 28;
const TRANSPORT_BUTTON = 52;

interface FullscreenVideoSlideProps {
  uri: string;
  thumbnailUrl?: string | null;
  stageWidth: number;
  stageHeight: number;
  isActive: boolean;
  /** Feed → fullscreen timestamp handoff for the active slide. */
  playbackHandoff?: FeedVideoFullscreenHandoff;
  /** Immersive social viewer — hide transport/scrubber chrome; parent renders controls. */
  immersiveMode?: boolean;
  /** Dedicated /video route — playback is independent from feed autoplay coordinator. */
  routePlayback?: boolean;
}

export type FullscreenVideoPlaybackSnapshot = {
  currentTime: number;
  muted: boolean;
  wasPlaying: boolean;
};

export type FullscreenVideoSlideHandle = {
  getPlaybackSnapshot: () => FullscreenVideoPlaybackSnapshot;
  pause: () => void;
  play: () => void;
  toggleMute: () => void;
  isMuted: () => boolean;
};

function formatVideoTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function configureInlineWebVideo(video: HTMLVideoElement) {
  configureFeedWebVideoElement(video);
}

/** Full-screen gallery video — Frennix-owned controls only; no native controls layer. */
export const FullscreenVideoSlide = forwardRef<
  FullscreenVideoSlideHandle,
  FullscreenVideoSlideProps
>(function FullscreenVideoSlide(
  {
    uri,
    thumbnailUrl,
    stageWidth,
    stageHeight,
    isActive,
    playbackHandoff,
    immersiveMode = false,
    routePlayback = false,
  },
  ref
) {
  const posterState = useVideoPoster(uri, thumbnailUrl);
  const [muted, setMuted] = useState(
    () => playbackHandoff?.muted ?? (immersiveMode ? !isFeedVideoSoundEnabled() : false)
  );
  useEffect(() => {
    if (!isActive || playbackHandoff || !immersiveMode) return;
    const preferredMuted = !isFeedVideoSoundEnabled();
    setMuted((current) => (current === preferredMuted ? current : preferredMuted));
  }, [immersiveMode, isActive, playbackHandoff]);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const autoRetryAttemptRef = useRef(0);
  const [handoffReady, setHandoffReady] = useState(!playbackHandoff);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [controlsPinned, setControlsPinned] = useState(false);
  const [hasRenderedFrame, setHasRenderedFrame] = useState(false);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const webVideoMountRef = useRef<HTMLDivElement | null>(null);
  const [usingAdoptedFeedVideo, setUsingAdoptedFeedVideo] = useState(() =>
    Platform.OS === "web" &&
    Boolean(
      playbackHandoff?.playbackId &&
        getRegisteredFeedVideoElement(playbackHandoff.playbackId)
    )
  );
  const inlineReadyAtHandoffRef = useRef(false);
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

  const reportVideoFailure = useCallback(
    (reason: VideoMediaFailureReason, video?: HTMLVideoElement | null) => {
      logVideoMediaFailure({
        surface: "fullscreen",
        reason,
        ext: mediaExtensionFromUri(uri),
        playbackId: playbackHandoff?.playbackId,
        attempt: autoRetryAttemptRef.current,
      });
      if (shouldAutoRetryVideoLoad(reason, autoRetryAttemptRef.current)) {
        autoRetryAttemptRef.current += 1;
        setHasRenderedFrame(false);
        setBuffering(false);
        setRetryKey((key) => key + 1);
        return;
      }
      setBuffering(false);
      setFailed(true);
    },
    [playbackHandoff?.playbackId, uri]
  );

  useEffect(() => {
    autoRetryAttemptRef.current = 0;
  }, [uri]);

  useEffect(() => {
    setFailed(false);
    const registered =
      playbackHandoff?.playbackId &&
      getRegisteredFeedVideoElement(playbackHandoff.playbackId);
    const inlineReady =
      registered != null &&
      registered.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    inlineReadyAtHandoffRef.current = Boolean(inlineReady);
    handoffAppliedRef.current = Boolean(registered);
    setHandoffReady(!playbackHandoff || Boolean(inlineReady));
    setHasRenderedFrame(Boolean(inlineReady));
    setBuffering(false);
    setControlsVisible(true);
    setControlsPinned(false);
    setIsPaused(registered ? registered.paused : true);
    setCurrentTime(registered?.currentTime ?? playbackHandoff?.currentTime ?? 0);
    setDuration(
      registered && Number.isFinite(registered.duration) ? registered.duration : 0
    );
    clearHideControlsTimer();
  }, [uri, retryKey, playbackHandoff, clearHideControlsTimer]);

  const applyPlaybackHandoff = useCallback(() => {
    if (handoffAppliedRef.current || !playbackHandoff) return;
    const video = webVideoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) return;

    const videoDuration = video.duration;
    const target = Number.isFinite(videoDuration)
      ? Math.min(playbackHandoff.currentTime, Math.max(0, videoDuration - 0.05))
      : playbackHandoff.currentTime;

    video.currentTime = target;
    video.muted = playbackHandoff.muted;
    setMuted(playbackHandoff.muted);
    setCurrentTime(target);
    setDuration(Number.isFinite(videoDuration) ? videoDuration : 0);
    handoffAppliedRef.current = true;
    setHandoffReady(true);
  }, [playbackHandoff]);

  const syncVideoState = useCallback(() => {
    const video = webVideoRef.current;
    if (!video) return;
    setIsPaused(video.paused);
    setCurrentTime(video.currentTime);
    if (Number.isFinite(video.duration)) {
      setDuration(video.duration);
    }
  }, []);

  useLayoutEffect(() => {
    if (Platform.OS !== "web" || !isActive || usingAdoptedFeedVideo) return;
    const video = webVideoRef.current;
    if (!video) return;

    video.classList.add("fullscreen-video-slide");
    configureInlineWebVideo(video);

    const blockNativeFullscreen = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      configureInlineWebVideo(video);
      if (typeof video.webkitExitFullscreen === "function") {
        void video.webkitExitFullscreen();
      }
    };

    video.addEventListener("webkitbeginfullscreen", blockNativeFullscreen, true);
    scheduleControlsHide();

    return () => {
      video.removeEventListener("webkitbeginfullscreen", blockNativeFullscreen, true);
    };
  }, [isActive, retryKey, uri, scheduleControlsHide, usingAdoptedFeedVideo]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const video = webVideoRef.current;
    if (!video || !handoffReady) return;

    video.muted = muted;
    if (!isActive || failed) {
      video.pause();
      return;
    }

    if (usingAdoptedFeedVideo) {
      if (
        playbackHandoff &&
        handoffAppliedRef.current &&
        !playbackHandoff.wasPlaying &&
        !routePlayback
      ) {
        video.pause();
      }
      return;
    }

    void video.play().catch(() => reportVideoFailure("network", video));
    if (
      playbackHandoff &&
      handoffAppliedRef.current &&
      !playbackHandoff.wasPlaying &&
      !routePlayback
    ) {
      video.pause();
    }
  }, [
    handoffReady,
    isActive,
    muted,
    failed,
    uri,
    retryKey,
    playbackHandoff,
    routePlayback,
    usingAdoptedFeedVideo,
    reportVideoFailure,
  ]);

  useEffect(() => {
    if (Platform.OS !== "web" || !isActive || failed || hasRenderedFrame || usingAdoptedFeedVideo) {
      return;
    }
    const timer = setTimeout(() => {
      if (hasRenderedFrame) return;
      reportVideoFailure("timeout", webVideoRef.current);
    }, VIDEO_FIRST_FRAME_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [
    failed,
    hasRenderedFrame,
    isActive,
    reportVideoFailure,
    retryKey,
    uri,
    usingAdoptedFeedVideo,
  ]);

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
      if (routePlayback || !playbackHandoff?.playbackId || Platform.OS !== "web") return;
      if (usingAdoptedFeedVideo) return;
      const video = webVideoRef.current;
      if (!video) return;
      restoreFeedVideoFromFullscreen(playbackHandoff.playbackId, video.currentTime, video.muted);
    };
  }, [playbackHandoff, clearHideControlsTimer, routePlayback, usingAdoptedFeedVideo]);

  const handleRetry = useCallback(() => {
    autoRetryAttemptRef.current = 0;
    setFailed(false);
    setRetryKey((key) => key + 1);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((current) => !current);
    revealControls();
  }, [revealControls]);

  useImperativeHandle(
    ref,
    () => ({
      getPlaybackSnapshot: (): FullscreenVideoPlaybackSnapshot => {
        const video = webVideoRef.current;
        if (Platform.OS === "web" && video) {
          return {
            currentTime: video.currentTime,
            muted: video.muted,
            wasPlaying: !video.paused,
          };
        }
        return {
          currentTime,
          muted,
          wasPlaying: !isPaused,
        };
      },
      pause: () => {
        const video = webVideoRef.current;
        if (video) video.pause();
        else nativeVideoRef.current?.pauseAsync().catch(() => undefined);
      },
      play: () => {
        const video = webVideoRef.current;
        if (video) void video.play().catch(() => reportVideoFailure("network", video));
        else nativeVideoRef.current?.playAsync().catch(() => setFailed(true));
      },
      toggleMute,
      isMuted: () => {
        const video = webVideoRef.current;
        return video ? video.muted : muted;
      },
    }),
    [currentTime, isPaused, muted, toggleMute]
  );

  const togglePlayPause = useCallback(() => {
    const video = webVideoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => reportVideoFailure("network", video));
    } else {
      video.pause();
    }
    revealControls();
  }, [revealControls]);

  const seekBy = useCallback(
    (delta: number) => {
      const video = webVideoRef.current;
      if (!video) return;
      const max = Number.isFinite(video.duration) ? video.duration : duration;
      const next = Math.min(Math.max(0, video.currentTime + delta), Math.max(0, max - 0.05));
      video.currentTime = next;
      setCurrentTime(next);
      revealControls();
    },
    [duration, revealControls]
  );

  const seekTo = useCallback(
    (value: number) => {
      const video = webVideoRef.current;
      if (!video) return;
      const max = Number.isFinite(video.duration) ? video.duration : duration;
      const next = Math.min(Math.max(0, value), Math.max(0, max));
      video.currentTime = next;
      setCurrentTime(next);
      revealControls();
    },
    [duration, revealControls]
  );

  const handleWebPause = useCallback(() => {
    setIsPaused(true);
    setControlsPinned(true);
    setControlsVisible(true);
    clearHideControlsTimer();
    syncVideoState();
  }, [clearHideControlsTimer, syncVideoState]);

  const handleWebPlay = useCallback(() => {
    setIsPaused(false);
    setHasRenderedFrame(true);
    setControlsPinned(false);
    setControlsVisible(true);
    scheduleControlsHide();
    syncVideoState();
  }, [scheduleControlsHide, syncVideoState]);

  const handleTimeUpdate = useCallback(() => {
    syncVideoState();
    const video = webVideoRef.current;
    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      setHasRenderedFrame(true);
    }
  }, [syncVideoState]);

  const handleLoadedMetadata = useCallback(() => {
    syncVideoState();
    applyPlaybackHandoff();
  }, [applyPlaybackHandoff, syncVideoState]);

  useLayoutEffect(() => {
    if (Platform.OS !== "web" || !isActive || routePlayback || !playbackHandoff?.playbackId) {
      return;
    }

    const mount = webVideoMountRef.current;
    if (!mount) return;

    const adopted = adoptFeedVideoDomForFullscreen(playbackHandoff.playbackId, mount, {
      width: stageWidth,
      height: stageHeight,
      objectFit: immersiveMode ? "cover" : "contain",
      immersiveMode,
    });

    if (!adopted) return;

    webVideoRef.current = adopted;
    setUsingAdoptedFeedVideo(true);
    handoffAppliedRef.current = true;
    inlineReadyAtHandoffRef.current =
      adopted.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
    setHandoffReady(true);
    setHasRenderedFrame(inlineReadyAtHandoffRef.current);
    setBuffering(false);
    setIsPaused(adopted.paused);
    setCurrentTime(adopted.currentTime);
    if (Number.isFinite(adopted.duration)) {
      setDuration(adopted.duration);
    }
    setMuted(adopted.muted);
    configureInlineWebVideo(adopted);

    const blockNativeFullscreen = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      configureInlineWebVideo(adopted);
      if (typeof adopted.webkitExitFullscreen === "function") {
        void adopted.webkitExitFullscreen();
      }
    };
    const onCanPlay = () => setBuffering(false);
    const onWaiting = () => {
      if (inlineReadyAtHandoffRef.current) return;
      setBuffering(true);
    };
    const onPlaying = () => {
      setBuffering(false);
      setHasRenderedFrame(true);
    };
    const onError = () => reportVideoFailure(classifyVideoMediaError(adopted), adopted);

    adopted.addEventListener("webkitbeginfullscreen", blockNativeFullscreen, true);
    adopted.addEventListener("loadedmetadata", handleLoadedMetadata);
    adopted.addEventListener("canplay", onCanPlay);
    adopted.addEventListener("waiting", onWaiting);
    adopted.addEventListener("playing", onPlaying);
    adopted.addEventListener("play", handleWebPlay);
    adopted.addEventListener("pause", handleWebPause);
    adopted.addEventListener("timeupdate", handleTimeUpdate);
    adopted.addEventListener("error", onError);
    scheduleControlsHide();

    return () => {
      adopted.removeEventListener("webkitbeginfullscreen", blockNativeFullscreen, true);
      adopted.removeEventListener("loadedmetadata", handleLoadedMetadata);
      adopted.removeEventListener("canplay", onCanPlay);
      adopted.removeEventListener("waiting", onWaiting);
      adopted.removeEventListener("playing", onPlaying);
      adopted.removeEventListener("play", handleWebPlay);
      adopted.removeEventListener("pause", handleWebPause);
      adopted.removeEventListener("timeupdate", handleTimeUpdate);
      adopted.removeEventListener("error", onError);
      returnFeedVideoDomFromFullscreen(playbackHandoff.playbackId);
      setFeedVideoFullscreenHandoff(null);
      setUsingAdoptedFeedVideo(false);
      if (webVideoRef.current === adopted) {
        webVideoRef.current = null;
      }
    };
  }, [
    handleLoadedMetadata,
    handleTimeUpdate,
    handleWebPause,
    handleWebPlay,
    immersiveMode,
    isActive,
    playbackHandoff,
    routePlayback,
    scheduleControlsHide,
    stageHeight,
    stageWidth,
  ]);

  const SpeakerIcon = muted ? VolumeX : Volume2;
  const chromeControlsVisible = controlsVisible || controlsPinned;
  const progressMax = duration > 0 ? duration : 1;
  const posterUri = posterState.posterUri ?? thumbnailUrl ?? null;
  const showPosterOverlay =
    Platform.OS === "web" &&
    isActive &&
    Boolean(posterUri) &&
    (!hasRenderedFrame || (buffering && !inlineReadyAtHandoffRef.current));
  const showLoadingOverlay =
    Platform.OS === "web" &&
    isActive &&
    !posterUri &&
    !hasRenderedFrame &&
    !usingAdoptedFeedVideo;

  const webChromeMute =
    Platform.OS === "web" &&
    isActive &&
    !immersiveMode &&
    typeof document !== "undefined"
      ? createPortal(
          <Pressable
            className={`fullscreen-video-mute-button${chromeControlsVisible ? "" : " fullscreen-chrome-hidden"}`}
            style={[
              styles.webChromeMute,
              Platform.OS === "web"
                ? ({
                    opacity: chromeControlsVisible ? 1 : 0,
                    transition: "opacity 0.35s ease",
                  } as object)
                : null,
            ]}
            onPress={(event) => {
              event.stopPropagation?.();
              toggleMute();
            }}
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
        <>
          {createElement("div", {
            ref: (node: HTMLDivElement | null) => {
              webVideoMountRef.current = node;
            },
            className: "fullscreen-video-mount",
            style: {
              width: stageWidth,
              height: stageHeight,
              position: "relative",
              overflow: "hidden",
              backgroundColor: colors.background,
            },
          })}

          {!usingAdoptedFeedVideo
            ? createElement("video", {
                key: retryKey,
                className: "fullscreen-video-slide",
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
                disablePictureInPicture: true,
                disableRemotePlayback: true,
                preload: isActive ? "auto" : "metadata",
                poster: posterState.posterUri ?? thumbnailUrl ?? undefined,
                style: {
                  width: stageWidth,
                  height: stageHeight,
                  objectFit: "contain",
                  backgroundColor: colors.background,
                  ...(Platform.OS === "web" && immersiveMode
                    ? ({ pointerEvents: "none" } as const)
                    : null),
                },
                onLoadedMetadata: handleLoadedMetadata,
                onCanPlay: () => {
                  setBuffering(false);
                  applyPlaybackHandoff();
                },
                onWaiting: () => setBuffering(true),
                onPlaying: () => {
                  setBuffering(false);
                  setHasRenderedFrame(true);
                },
                onPlay: handleWebPlay,
                onPause: handleWebPause,
                onTimeUpdate: handleTimeUpdate,
                onError: () =>
                  reportVideoFailure(classifyVideoMediaError(webVideoRef.current), webVideoRef.current),
              })
            : null}

          <Pressable
            style={styles.tapSurface}
            onPress={immersiveMode ? togglePlayPause : revealControls}
            accessibilityRole="button"
            accessibilityLabel={immersiveMode ? "Play or pause video" : "Show video controls"}
          />

          {!immersiveMode ? (
          <View
            pointerEvents={chromeControlsVisible ? "box-none" : "none"}
            style={[
              styles.controlsOverlay,
              Platform.OS === "web"
                ? ({
                    opacity: chromeControlsVisible ? 1 : 0,
                    transition: "opacity 0.35s ease",
                  } as object)
                : { opacity: chromeControlsVisible ? 1 : 0 },
            ]}
          >
            <View style={styles.centerTransport} pointerEvents="box-none">
              <Pressable
                style={styles.transportButton}
                onPress={(event) => {
                  event.stopPropagation?.();
                  seekBy(-SEEK_STEP_SECONDS);
                }}
                accessibilityRole="button"
                accessibilityLabel="Rewind 10 seconds"
              >
                <Rewind color="#FFFFFF" size={TRANSPORT_ICON} strokeWidth={2} />
              </Pressable>

              <Pressable
                style={styles.transportButtonPrimary}
                onPress={(event) => {
                  event.stopPropagation?.();
                  togglePlayPause();
                }}
                accessibilityRole="button"
                accessibilityLabel={isPaused ? "Play video" : "Pause video"}
              >
                {isPaused ? (
                  <Play color="#FFFFFF" size={TRANSPORT_ICON + 4} strokeWidth={2} fill="#FFFFFF" />
                ) : (
                  <Pause color="#FFFFFF" size={TRANSPORT_ICON + 4} strokeWidth={2} fill="#FFFFFF" />
                )}
              </Pressable>

              <Pressable
                style={styles.transportButton}
                onPress={(event) => {
                  event.stopPropagation?.();
                  seekBy(SEEK_STEP_SECONDS);
                }}
                accessibilityRole="button"
                accessibilityLabel="Forward 10 seconds"
              >
                <FastForward color="#FFFFFF" size={TRANSPORT_ICON} strokeWidth={2} />
              </Pressable>
            </View>

            <View style={styles.bottomBar} pointerEvents="auto">
              <Text style={styles.timeText}>{formatVideoTime(currentTime)}</Text>
              {createElement("input", {
                type: "range",
                min: 0,
                max: progressMax,
                step: 0.1,
                value: currentTime,
                "aria-label": "Video progress",
                className: "fullscreen-video-scrubber",
                style: styles.scrubberInput as object,
                onChange: (event: Event) => {
                  const target = event.target as HTMLInputElement;
                  seekTo(Number(target.value));
                },
                onInput: (event: Event) => {
                  const target = event.target as HTMLInputElement;
                  seekTo(Number(target.value));
                },
              })}
              <Text style={styles.timeText}>{formatVideoTime(duration)}</Text>
            </View>
          </View>
          ) : null}
        </>
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

      {showPosterOverlay ? (
        <View style={styles.posterOverlay} pointerEvents="none">
          <ProgressiveImage
            uri={posterUri!}
            placeholderUri={thumbnailUrl}
            style={{ width: stageWidth, height: stageHeight }}
            contentFit="contain"
            accessibilityLabel="Video poster"
          />
          {buffering ? (
            <View style={styles.posterSpinner} pointerEvents="none">
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : null}
        </View>
      ) : null}

      {showLoadingOverlay ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      ) : null}

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

      {buffering && !showPosterOverlay && !showLoadingOverlay ? (
        <View style={styles.bufferingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : null}

      {webChromeMute}
    </View>
  );
});

const styles = StyleSheet.create({
  stage: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  tapSurface: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  centerTransport: {
    position: "absolute",
    top: "50%",
    left: "50%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    ...(Platform.OS === "web"
      ? ({
          transform: "translate(-50%, -50%)",
        } as object)
      : {
          transform: [{ translateX: -120 }, { translateY: -26 }],
        }),
  },
  transportButton: {
    width: TRANSPORT_BUTTON,
    height: TRANSPORT_BUTTON,
    borderRadius: TRANSPORT_BUTTON / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  transportButtonPrimary: {
    width: TRANSPORT_BUTTON + 8,
    height: TRANSPORT_BUTTON + 8,
    borderRadius: (TRANSPORT_BUTTON + 8) / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
  },
  bottomBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: Platform.OS === "web" ? "max(env(safe-area-inset-bottom, 0px), 18px)" : 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 3,
  },
  timeText: {
    color: "#FFFFFF",
    fontSize: 12,
    lineHeight: 14,
    fontVariant: ["tabular-nums"],
    minWidth: 36,
    textAlign: "center",
  },
  scrubberInput: Platform.select({
    web: {
      flex: 1,
      height: 28,
      margin: 0,
      appearance: "none",
      WebkitAppearance: "none",
      background: "transparent",
      position: "relative",
      zIndex: 2,
      cursor: "pointer",
    } as object,
    default: { flex: 1 },
  }),
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
    zIndex: 4,
  },
  posterOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    zIndex: 3,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    zIndex: 3,
  },
  posterSpinner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(10, 10, 11, 0.2)",
  },
});
