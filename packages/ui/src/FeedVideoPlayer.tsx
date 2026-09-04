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
  isFeedVideoFullscreenHandoff,
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
import {
  FEED_VIDEO_STALL_SPINNER_MS,
  isFeedVideoBackgroundPreloadDisabled,
  isFeedVideoPreloadGranted,
  releaseFeedVideoPreloadSlot,
  setFeedVideoPlaybackZone,
  setFeedVideoPreloadCandidate,
  subscribeFeedVideoPreloadSlots,
} from "./feedVideoPreloadCoordinator";
import {
  configureFeedWebVideoElement,
  isFeedVideoDomAdopted,
  registerFeedVideoDom,
  subscribeFeedVideoDomAdopted,
  unregisterFeedVideoDom,
} from "./feedVideoDom";
import { MediaAspectFrame } from "./MediaAspectFrame";
import { MediaLoadError } from "./MediaLoadError";
import { ProgressiveImage } from "./ProgressiveImage";
import {
  VIDEO_FIRST_FRAME_TIMEOUT_MS,
  VIDEO_REVEAL_FALLBACK_MS,
  VIDEO_REVEAL_POLL_MS,
  classifyVideoMediaError,
  feedVideoReadyToReveal,
  logVideoMediaFailure,
  mediaExtensionFromUri,
  shouldAutoRetryVideoLoad,
  shouldShowFeedVideoLoadingPlaceholder,
  shouldShowFeedVideoPosterLayer,
  type VideoMediaFailureReason,
} from "./videoMediaDelivery";
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
  /** Native / desktop overlay open — omitted when videoRouteHref is set on web. */
  onOpenFullscreen?: () => void;
  /** Mobile web dedicated /video/[postId] href — real anchor navigation. */
  videoRouteHref?: string;
  /** Side effect before following videoRouteHref (feed scroll save, playback handoff). */
  onVideoRouteNavigate?: () => void;
  onVisualReady?: () => void;
  fillParent?: boolean;
  feedFrameBucket?: import("./mediaLayout").FeedMediaBucket;
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
  videoRouteHref,
  onVideoRouteNavigate,
  onVisualReady,
  fillParent = false,
  feedFrameBucket,
}: FeedVideoPlayerProps) {
  const internalPoster = useVideoPoster(posterState ? undefined : uri, posterState ? null : thumbnailUrl);
  const resolvedPoster = posterState ?? internalPoster;
  const [inView, setInView] = useState(false);
  const inViewRef = useRef(false);
  inViewRef.current = inView;
  const [muted, setMuted] = useState(() => !isFeedVideoSoundEnabled());
  const [playbackAllowed, setPlaybackAllowed] = useState(() => isFeedVideoPlaybackAllowed());
  const [showStallSpinner, setShowStallSpinner] = useState(false);
  const [preloadGranted, setPreloadGranted] = useState(false);
  const [hasRenderedFrame, setHasRenderedFrame] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const autoRetryAttemptRef = useRef(0);
  const webVideoRef = useRef<HTMLVideoElement | null>(null);
  const webVideoMountRef = useRef<HTMLDivElement | null>(null);
  const [videoDomAdopted, setVideoDomAdopted] = useState(false);
  const shouldPlayRef = useRef(false);
  const preloadGrantedRef = useRef(false);
  preloadGrantedRef.current = preloadGranted;
  const stallSpinnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const clearStallSpinnerTimer = useCallback(() => {
    if (stallSpinnerTimerRef.current) {
      clearTimeout(stallSpinnerTimerRef.current);
      stallSpinnerTimerRef.current = null;
    }
  }, []);

  const scheduleStallSpinner = useCallback(() => {
    if (!shouldPlayRef.current) return;
    clearStallSpinnerTimer();
    stallSpinnerTimerRef.current = setTimeout(() => {
      if (shouldPlayRef.current) {
        setShowStallSpinner(true);
      }
    }, FEED_VIDEO_STALL_SPINNER_MS);
  }, [clearStallSpinnerTimer]);

  const clearStallSpinner = useCallback(() => {
    clearStallSpinnerTimer();
    setShowStallSpinner(false);
  }, [clearStallSpinnerTimer]);

  const reportVideoFailure = useCallback(
    (reason: VideoMediaFailureReason, video?: HTMLVideoElement | null) => {
      logVideoMediaFailure({
        surface: "feed",
        reason,
        ext: mediaExtensionFromUri(uri),
        playbackId,
        attempt: autoRetryAttemptRef.current,
      });
      if (shouldAutoRetryVideoLoad(reason, autoRetryAttemptRef.current)) {
        autoRetryAttemptRef.current += 1;
        setHasRenderedFrame(false);
        clearStallSpinner();
        setRetryKey((key) => key + 1);
        return;
      }
      clearStallSpinner();
      setFailed(true);
    },
    [clearStallSpinner, playbackId, uri]
  );

  const notifyVisualReady = useCallback(() => {
    if (visualReadyRef.current) return;
    visualReadyRef.current = true;
    onVisualReady?.();
  }, [onVisualReady]);

  const isActiveVideo = Boolean(playbackId && isActiveFeedVideo(playbackId));

  const pauseMediaElement = useCallback(() => {
    if (playbackId && isFeedVideoFullscreenHandoff(playbackId)) return;
    if (Platform.OS === "web") {
      webVideoRef.current?.pause();
    } else {
      void nativeVideoRef.current?.pauseAsync();
    }
  }, [playbackId]);

  const handleScrollOutOfView = useCallback(() => {
    pauseMediaElement();
    clearStallSpinner();
    setInView(false);
    if (playbackId) {
      setFeedVideoPlaybackZone(playbackId, false);
      releaseFeedVideoDueToVisibility(playbackId);
    }
  }, [clearStallSpinner, pauseMediaElement, playbackId]);

  const handleScrollIntoView = useCallback(() => {
    setInView(true);
    if (playbackId) {
      setFeedVideoPlaybackZone(playbackId, true);
      if (isFeedVideoPlaybackAllowed()) {
        requestFeedVideoPlay(playbackId);
      }
    }
  }, [playbackId]);

  const handleEnterPreloadZone = useCallback(() => {
    if (!playbackId || isFeedVideoBackgroundPreloadDisabled()) return;
    setFeedVideoPreloadCandidate(playbackId, true);
  }, [playbackId]);

  const handleExitPreloadZone = useCallback(() => {
    if (!playbackId) return;
    setFeedVideoPreloadCandidate(playbackId, false);
  }, [playbackId]);

  const shouldPlay = Boolean(
    inView &&
      playbackId &&
      (isFeedVideoPlaybackAllowed() || isFeedVideoFullscreenHandoff(playbackId)) &&
      (isActiveVideo || isFeedVideoFullscreenHandoff(playbackId)) &&
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

      reportVideoFailure("network", videoEl);
    });
  }, [reportVideoFailure]);

  const intersectionEnabled = Boolean(
    playbackId && slideActive && !failed && isFeedVideoPlaybackAllowed()
  );

  const shouldEnterAbove = useCallback(() => !inViewRef.current, []);

  const intersectionTargetRef =
    Platform.OS === "web"
      ? (webVideoMountRef as RefObject<Element | null>)
      : (nativeIntersectionRef as unknown as RefObject<Element | null>);

  useFeedVideoIntersectionObserver(
    intersectionTargetRef,
    intersectionEnabled,
    handleScrollOutOfView,
    handleScrollIntoView,
    shouldEnterAbove,
    {
      onEnterPreloadZone: handleEnterPreloadZone,
      onExitPreloadZone: handleExitPreloadZone,
    }
  );

  useEffect(() => {
    if (!playbackId) return;
    const syncPreloadGranted = () => {
      setPreloadGranted(isFeedVideoPreloadGranted(playbackId));
    };
    syncPreloadGranted();
    return subscribeFeedVideoPreloadSlots(syncPreloadGranted);
  }, [playbackId]);

  useEffect(() => {
    return () => {
      clearStallSpinnerTimer();
      if (playbackId) {
        releaseFeedVideoPreloadSlot(playbackId);
      }
    };
  }, [clearStallSpinnerTimer, playbackId]);

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
    autoRetryAttemptRef.current = 0;
    setFailed(false);
    setHasRenderedFrame(false);
    clearStallSpinner();
  }, [clearStallSpinner, uri]);

  useEffect(() => {
    setFailed(false);
    setHasRenderedFrame(false);
    clearStallSpinner();
  }, [clearStallSpinner, retryKey]);

  const presentationPosterUri = resolvedPoster.posterUri ?? thumbnailUrl ?? null;

  const revealVideoFrame = useCallback(() => {
    const video = webVideoRef.current;
    if (!video || !feedVideoReadyToReveal(video.readyState)) return false;
    setHasRenderedFrame(true);
    video.style.opacity = "1";
    clearStallSpinner();
    notifyVisualReady();
    return true;
  }, [clearStallSpinner, notifyVisualReady]);

  const scheduleVideoFrameCallbackReveal = useCallback(
    (video: HTMLVideoElement) => {
      const rvfc = video.requestVideoFrameCallback;
      if (typeof rvfc !== "function") return;
      rvfc.call(video, () => {
        revealVideoFrame();
      });
    },
    [revealVideoFrame]
  );

  useEffect(() => {
    if (!playbackId) return;
    return subscribeFeedVideoDomAdopted(() => {
      setVideoDomAdopted(isFeedVideoDomAdopted(playbackId));
    });
  }, [playbackId]);

  useLayoutEffect(() => {
    if (Platform.OS !== "web") return;
    const mount = webVideoMountRef.current;
    if (!mount) return;

    if (playbackId && isFeedVideoDomAdopted(playbackId)) {
      const existing = webVideoRef.current;
      if (existing && existing.parentElement !== mount) {
        mount.appendChild(existing);
      }
      setVideoDomAdopted(true);
      return;
    }

    const video = document.createElement("video");
    video.className = "feed-inline-video feed-inline-video-cover";
    configureFeedWebVideoElement(video);
    video.src = uri;
    video.muted = mutedRef.current;
    video.loop = true;
    video.playsInline = true;
    video.preload =
      shouldPlayRef.current || preloadGrantedRef.current ? "auto" : "metadata";
    const posterUri = resolvedPoster.posterUri ?? thumbnailUrl ?? undefined;
    if (posterUri) video.poster = posterUri;
    Object.assign(video.style, {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: "center",
      backgroundColor: "transparent",
      opacity: "0",
      pointerEvents: "none",
    });

    const onLoadedMetadata = () => {
      notifyVisualReady();
      if (shouldPlayRef.current) attemptWebAutoplay();
    };
    const onLoadedData = () => {
      if (revealVideoFrame()) return;
      scheduleVideoFrameCallbackReveal(video);
    };
    const onCanPlay = () => {
      revealVideoFrame();
      if (shouldPlayRef.current) attemptWebAutoplay();
    };
    const onWaiting = () => {
      if (playbackId && isFeedVideoFullscreenHandoff(playbackId)) return;
      scheduleStallSpinner();
    };
    const onPlaying = () => {
      clearStallSpinner();
      revealVideoFrame();
    };
    let sawTimeUpdate = false;
    const onTimeUpdate = () => {
      if (sawTimeUpdate) return;
      sawTimeUpdate = true;
      revealVideoFrame();
    };
    const onError = () => reportVideoFailure(classifyVideoMediaError(video), video);

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("error", onError);

    mount.appendChild(video);
    webVideoRef.current = video;
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      video.style.opacity = "1";
      setHasRenderedFrame(true);
      clearStallSpinner();
    }
    setVideoDomAdopted(false);
    if (playbackId) {
      registerFeedVideoDom(playbackId, video, mount);
    }

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("loadeddata", onLoadedData);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("error", onError);

      if (playbackId && isFeedVideoFullscreenHandoff(playbackId)) {
        return;
      }

      video.pause();
      video.remove();
      if (webVideoRef.current === video) {
        webVideoRef.current = null;
      }
      if (playbackId) {
        unregisterFeedVideoDom(playbackId, video);
      }
    };
  }, [
    attemptWebAutoplay,
    notifyVisualReady,
    playbackId,
    revealVideoFrame,
    scheduleStallSpinner,
    clearStallSpinner,
    scheduleVideoFrameCallbackReveal,
    resolvedPoster.posterUri,
    retryKey,
    thumbnailUrl,
    uri,
  ]);

  useLayoutEffect(() => {
    return () => {
      if (playbackId && isFeedVideoFullscreenHandoff(playbackId)) return;
      webVideoRef.current?.pause();
    };
  }, [playbackId]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const video = webVideoRef.current;
    if (!video || (!preloadGranted && !shouldPlay)) return;
    if (video.preload !== "auto") {
      video.preload = "auto";
    }
    if (
      video.readyState === HTMLMediaElement.HAVE_NOTHING &&
      !isFeedVideoFullscreenHandoff(playbackId)
    ) {
      video.load();
    }
  }, [playbackId, preloadGranted, shouldPlay, uri, retryKey]);

  useEffect(() => {
    if (Platform.OS !== "web" || hasRenderedFrame || failed) return;

    const startedAt = Date.now();
    const poll = setInterval(() => {
      const video = webVideoRef.current;
      if (!video) return;
      if (revealVideoFrame()) {
        clearInterval(poll);
        return;
      }
      if (Date.now() - startedAt >= VIDEO_REVEAL_FALLBACK_MS) {
        clearInterval(poll);
        if (feedVideoReadyToReveal(video.readyState)) {
          revealVideoFrame();
        }
      }
    }, VIDEO_REVEAL_POLL_MS);

    return () => clearInterval(poll);
  }, [failed, hasRenderedFrame, revealVideoFrame, retryKey, uri]);

  useEffect(() => {
    if (Platform.OS !== "web" || !shouldPlay || hasRenderedFrame || failed) return;
    if (playbackId && isFeedVideoFullscreenHandoff(playbackId)) return;

    const timer = setTimeout(() => {
      if (hasRenderedFrame || !shouldPlayRef.current) return;
      const video = webVideoRef.current;
      if (video && feedVideoReadyToReveal(video.readyState)) {
        revealVideoFrame();
        return;
      }
      reportVideoFailure("timeout", video);
    }, VIDEO_FIRST_FRAME_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [
    failed,
    hasRenderedFrame,
    playbackId,
    reportVideoFailure,
    revealVideoFrame,
    retryKey,
    shouldPlay,
    uri,
  ]);

  useEffect(() => {
    if (!shouldPlay) {
      clearStallSpinner();
    }
  }, [clearStallSpinner, shouldPlay]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const video = webVideoRef.current;
    if (!video || isFeedVideoFullscreenHandoff(playbackId)) return;
    video.muted = muted;
  }, [muted, playbackId]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const video = webVideoRef.current;
    if (!video) return;
    video.style.opacity = hasRenderedFrame ? "1" : "0";
  }, [hasRenderedFrame]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const video = webVideoRef.current;
    if (!video) return;
    if (playbackId && isFeedVideoFullscreenHandoff(playbackId)) return;

    if (shouldPlay) {
      attemptWebAutoplay();
      return;
    }

    video.pause();
  }, [attemptWebAutoplay, playbackId, shouldPlay, muted, failed, uri, retryKey]);

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

  const useRouteLink = Platform.OS === "web" && Boolean(videoRouteHref);
  const canOpenViewer = Boolean(useRouteLink || onOpenFullscreen);

  const handleRouteLinkClick = useCallback(
    (event: {
      button?: number;
      metaKey?: boolean;
      ctrlKey?: boolean;
      shiftKey?: boolean;
      altKey?: boolean;
      clientX: number;
      clientY: number;
      preventDefault?: () => void;
      stopPropagation?: () => void;
    }) => {
      const start = openTapStartRef.current;
      openTapStartRef.current = null;
      if (start) {
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.hypot(dx, dy) > OPEN_VIEWER_TAP_MOVE_PX) {
          event.preventDefault?.();
          return;
        }
      }
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        (typeof event.button === "number" && event.button !== 0)
      ) {
        return;
      }
      event.preventDefault?.();
      event.stopPropagation?.();
      onVideoRouteNavigate?.();
    },
    [onVideoRouteNavigate]
  );

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
    autoRetryAttemptRef.current = 0;
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
    canOpenViewer && useRouteLink && videoRouteHref ? (
      createElement(
        "a",
        {
          href: videoRouteHref,
          className: "feed-video-expand-button",
          "aria-label": "Open video full screen",
          onPointerDown: handleWebOpenPointerDown,
          onClick: (event: { clientX: number; clientY: number; preventDefault?: () => void; stopPropagation?: () => void }) => {
            event.stopPropagation?.();
            handleRouteLinkClick(event);
          },
        },
        createElement(Maximize2, {
          color: "#FFFFFF",
          size: 16,
          strokeWidth: 2,
        })
      )
    ) : canOpenViewer && onOpenFullscreen ? (
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
      <View style={styles.shell} collapsable={false}>
        <MediaAspectFrame
          dimensionsUri={dimensionsUri}
          layout="feed"
          style={style}
          feedFallbackBucket="portrait"
          fillParent={fillParent}
          feedFrameBucket={feedFrameBucket}
        >
          {() => <MediaLoadError label="Video unavailable" onRetry={handleRetry} />}
        </MediaAspectFrame>
        {canOpenViewer ? (
          <>
            {useRouteLink && videoRouteHref
              ? createElement("a", {
                  href: videoRouteHref,
                  className: "feed-video-route-link",
                  "aria-label": "Open video full screen",
                  onPointerDown: handleWebOpenPointerDown,
                  onPointerCancel: handleWebOpenPointerCancel,
                  onClick: handleRouteLinkClick,
                  style: {
                    position: "absolute",
                    inset: 0,
                    zIndex: 2,
                  },
                })
              : null}
            {!useRouteLink && onOpenFullscreen ? (
              <Pressable
                style={styles.openHitLayer}
                onPress={openViewer}
                accessibilityRole="button"
                accessibilityLabel="Open video full screen"
              />
            ) : null}
            <View style={styles.muteLayer} pointerEvents="box-none">
              {expandControl}
            </View>
          </>
        ) : null}
      </View>
    );
  }

  const showPosterBackdrop =
    shouldShowFeedVideoPosterLayer(presentationPosterUri, hasRenderedFrame) &&
    !videoDomAdopted &&
    !isFeedVideoFullscreenHandoff(playbackId);
  const showLoadingPlaceholder =
    shouldShowFeedVideoLoadingPlaceholder(
      presentationPosterUri,
      hasRenderedFrame,
      !videoDomAdopted &&
        !isFeedVideoFullscreenHandoff(playbackId) &&
        (shouldPlay || inView || preloadGranted)
    );
  const showBufferingSpinner =
    (showStallSpinner || (showLoadingPlaceholder && !hasRenderedFrame)) &&
    shouldPlay &&
    !videoDomAdopted &&
    !isFeedVideoFullscreenHandoff(playbackId);

  const videoBody =
    Platform.OS === "web" ? (
      <>
        {createElement("div", {
          ref: (node: HTMLDivElement | null) => {
            webVideoMountRef.current = node;
          },
          className: "feed-video-mount",
          style: {
            width: "100%",
            height: "100%",
            position: "relative",
            overflow: "hidden",
            backgroundColor: "transparent",
            zIndex: 1,
          },
        })}
        {videoDomAdopted && presentationPosterUri ? (
          <View style={styles.adoptedPoster} pointerEvents="none">
            <ProgressiveImage
              uri={presentationPosterUri}
              placeholderUri={thumbnailUrl}
              style={styles.videoFill}
              contentFit="cover"
              accessibilityLabel="Video frame"
            />
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
              style={styles.videoFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay={shouldPlay}
              isMuted={muted}
              isLooping
              useNativeControls={false}
              posterSource={
                presentationPosterUri ? { uri: presentationPosterUri } : undefined
              }
              usePoster={Boolean(presentationPosterUri)}
              onPlaybackStatusUpdate={(status) => {
                if (!status.isLoaded) {
                  if ("error" in status && status.error) setFailed(true);
                  return;
                }
                if (status.isPlaying && status.durationMillis != null) {
                  setHasRenderedFrame(true);
                  clearStallSpinner();
                }
                if (status.isBuffering) {
                  scheduleStallSpinner();
                } else {
                  clearStallSpinner();
                }
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
        feedFallbackBucket="portrait"
        fillParent={fillParent}
        feedFrameBucket={feedFrameBucket}
      >
        {() => (
          <View
            ref={Platform.OS === "web" ? undefined : nativeIntersectionRef}
            collapsable={false}
            style={styles.container}
          >
            <View style={styles.mediaLayer} pointerEvents="box-none">
              <View style={styles.videoSurface} pointerEvents="none">
                {showPosterBackdrop ? (
                  <View style={styles.posterLayer} pointerEvents="none">
                    <ProgressiveImage
                      uri={presentationPosterUri!}
                      placeholderUri={thumbnailUrl}
                      style={styles.videoFill}
                      contentFit="cover"
                      accessibilityLabel="Video poster"
                    />
                  </View>
                ) : null}

                {showLoadingPlaceholder ? (
                  <View style={styles.loadingPlaceholder} pointerEvents="none" />
                ) : null}

                {videoBody}

                {showBufferingSpinner ? (
                  <View
                    style={styles.bufferingSpinnerLayer}
                    pointerEvents="none"
                    accessibilityLabel="Video loading"
                    accessibilityRole="progressbar"
                  >
                    <ActivityIndicator
                      color={colors.accent}
                      size="small"
                      accessibilityLabel="Loading video"
                    />
                  </View>
                ) : null}
              </View>

              {canOpenViewer && useRouteLink && videoRouteHref
                ? createElement("a", {
                    href: videoRouteHref,
                    className: "feed-video-route-link",
                    "aria-label": "Open video full screen",
                    onPointerDown: handleWebOpenPointerDown,
                    onPointerCancel: handleWebOpenPointerCancel,
                    onClick: handleRouteLinkClick,
                  })
                : null}

              {canOpenViewer && !useRouteLink && onOpenFullscreen ? (
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

      {canOpenViewer || playbackAllowed ? (
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
  adoptedPoster: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  posterLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: colors.background,
  },
  loadingPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: colors.surfaceElevated,
  },
  bufferingSpinnerLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    zIndex: 2,
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
