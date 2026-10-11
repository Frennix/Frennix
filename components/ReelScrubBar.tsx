import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { FullscreenVideoSlideHandle } from "@frennix/ui";
import { colors, spacing, typography } from "@frennix/ui";

const TRACK_HEIGHT = 3;
const TOUCH_HEIGHT = 44;
const THUMB_SIZE = 10;
const HORIZONTAL_LOCK_PX = 8;
const SEEK_THROTTLE_MS = 80;

function formatVideoTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function seekVideoElement(video: HTMLVideoElement, time: number, exact: boolean) {
  const max = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : time;
  const next = clamp(time, 0, Math.max(0, max));
  const fastSeek = (video as HTMLVideoElement & { fastSeek?: (value: number) => void }).fastSeek;
  if (!exact && typeof fastSeek === "function") {
    try {
      fastSeek.call(video, next);
      return next;
    } catch {
      // fall through
    }
  }
  video.currentTime = next;
  return next;
}

type ReelScrubBarProps = {
  videoRef: RefObject<FullscreenVideoSlideHandle | null>;
  isActive: boolean;
  onScrubbingChange?: (scrubbing: boolean) => void;
};

export function ReelScrubBar({ videoRef, isActive, onScrubbingChange }: ReelScrubBarProps) {
  const rootRef = useRef<View>(null);
  const trackRef = useRef<View>(null);
  const fillElRef = useRef<HTMLDivElement | null>(null);
  const thumbElRef = useRef<HTMLDivElement | null>(null);
  const currentTimeElRef = useRef<HTMLSpanElement | null>(null);
  const durationElRef = useRef<HTMLSpanElement | null>(null);
  const wasPlayingRef = useRef(false);
  const lockedRef = useRef(false);
  const pendingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const targetTimeRef = useRef(0);
  const durationRef = useRef(0);
  const currentTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastSeekAtRef = useRef(0);
  const [idleCurrentTime, setIdleCurrentTime] = useState(0);
  const [idleDuration, setIdleDuration] = useState(0);

  const paintScrubber = useCallback((time: number, duration: number) => {
    const progress = duration > 0 ? clamp(time / duration, 0, 1) * 100 : 0;
    if (fillElRef.current) fillElRef.current.style.width = `${progress}%`;
    if (thumbElRef.current) thumbElRef.current.style.left = `${progress}%`;
    if (currentTimeElRef.current) currentTimeElRef.current.textContent = formatVideoTime(time);
    if (durationElRef.current) durationElRef.current.textContent = formatVideoTime(duration);
  }, []);

  const timeFromClientX = useCallback((clientX: number) => {
    const node = trackRef.current as unknown as { getBoundingClientRect?: () => DOMRect } | null;
    const rect = node?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0) return null;
    const max = durationRef.current > 0 ? durationRef.current : videoRef.current?.getDuration() ?? 0;
    if (max <= 0) return null;
    durationRef.current = max;
    return clamp((clientX - rect.left) / rect.width, 0, 1) * max;
  }, [videoRef]);

  const flushLiveSeek = useCallback((exact: boolean) => {
    const video = videoRef.current?.getVideoElement?.();
    const nextTime = targetTimeRef.current;
    if (video) {
      const applied = seekVideoElement(video, nextTime, exact);
      currentTimeRef.current = applied;
      lastSeekAtRef.current = exact ? 0 : performance.now();
      return;
    }
    videoRef.current?.seekTo(nextTime, exact ? undefined : { silent: true });
    currentTimeRef.current = nextTime;
    lastSeekAtRef.current = exact ? 0 : performance.now();
  }, [videoRef]);

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const ensureRaf = useCallback(() => {
    if (rafRef.current != null) return;
    const tick = () => {
      rafRef.current = null;
      if (!lockedRef.current) return;
      paintScrubber(targetTimeRef.current, durationRef.current);
      const now = performance.now();
      if (now - lastSeekAtRef.current >= SEEK_THROTTLE_MS) {
        flushLiveSeek(false);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [flushLiveSeek, paintScrubber]);

  const syncFromVideo = useCallback(() => {
    if (lockedRef.current) return;
    const handle = videoRef.current;
    if (!handle) return;
    const snapshot = handle.getPlaybackSnapshot();
    const nextDuration = handle.getDuration();
    currentTimeRef.current = snapshot.currentTime;
    if (nextDuration > 0) durationRef.current = nextDuration;
    setIdleCurrentTime(snapshot.currentTime);
    if (nextDuration > 0) setIdleDuration(nextDuration);
    paintScrubber(snapshot.currentTime, durationRef.current);
  }, [paintScrubber, videoRef]);

  useEffect(() => {
    if (!isActive || lockedRef.current) return;
    syncFromVideo();
    const timer = setInterval(syncFromVideo, 250);
    return () => clearInterval(timer);
  }, [isActive, syncFromVideo]);

  useEffect(() => {
    if (isActive) return;
    stopRaf();
    lockedRef.current = false;
    pendingRef.current = false;
    setIdleCurrentTime(0);
    setIdleDuration(0);
    durationRef.current = 0;
    currentTimeRef.current = 0;
    paintScrubber(0, 0);
  }, [isActive, paintScrubber, stopRaf]);

  const beginScrub = useCallback(
    (clientX: number, target: { setPointerCapture?: (id: number) => void } | null) => {
      const snapshot = videoRef.current?.getPlaybackSnapshot();
      wasPlayingRef.current = Boolean(snapshot?.wasPlaying);
      const duration = videoRef.current?.getDuration() ?? durationRef.current;
      if (duration > 0) durationRef.current = duration;
      const nextTime = timeFromClientX(clientX);
      if (nextTime == null) return;
      lockedRef.current = true;
      pendingRef.current = false;
      targetTimeRef.current = nextTime;
      const root = rootRef.current as unknown as HTMLElement | null;
      root?.setAttribute("data-frennix-reel-scrub-locked", "true");
      if (root?.style) root.style.touchAction = "none";
      if (pointerIdRef.current != null) {
        target?.setPointerCapture?.(pointerIdRef.current);
      }
      onScrubbingChange?.(true);
      videoRef.current?.pause();
      paintScrubber(nextTime, durationRef.current);
      flushLiveSeek(false);
      ensureRaf();
    },
    [ensureRaf, flushLiveSeek, onScrubbingChange, paintScrubber, timeFromClientX, videoRef]
  );

  const endScrub = useCallback(() => {
    if (!lockedRef.current) {
      pendingRef.current = false;
      pointerIdRef.current = null;
      return;
    }
    stopRaf();
    lockedRef.current = false;
    pendingRef.current = false;
    pointerIdRef.current = null;
    const root = rootRef.current as unknown as HTMLElement | null;
    root?.removeAttribute("data-frennix-reel-scrub-locked");
    if (root?.style) root.style.touchAction = "pan-y";
    flushLiveSeek(true);
    const finalTime = targetTimeRef.current;
    currentTimeRef.current = finalTime;
    setIdleCurrentTime(finalTime);
    setIdleDuration(durationRef.current);
    paintScrubber(finalTime, durationRef.current);
    onScrubbingChange?.(false);
    if (wasPlayingRef.current) {
      videoRef.current?.play();
    }
  }, [flushLiveSeek, onScrubbingChange, paintScrubber, stopRaf, videoRef]);

  const progress = idleDuration > 0 ? clamp(idleCurrentTime / idleDuration, 0, 1) : 0;

  return (
    <View
      ref={rootRef}
      style={styles.root}
      {...(Platform.OS === "web"
        ? ({
            "data-frennix-reel-scrubber": "true",
            "data-frennix-reel-scrubber-row": "true",
            onPointerDown: (event: {
              clientX: number;
              clientY: number;
              pointerId?: number;
            }) => {
              pendingRef.current = true;
              lockedRef.current = false;
              startXRef.current = event.clientX;
              startYRef.current = event.clientY;
              pointerIdRef.current = event.pointerId ?? null;
            },
            onPointerMove: (event: {
              clientX: number;
              clientY: number;
              pointerId?: number;
              currentTarget?: { setPointerCapture?: (id: number) => void };
              preventDefault?: () => void;
              stopPropagation?: () => void;
            }) => {
              if (lockedRef.current) {
                event.preventDefault?.();
                event.stopPropagation?.();
                const nextTime = timeFromClientX(event.clientX);
                if (nextTime == null) return;
                targetTimeRef.current = nextTime;
                ensureRaf();
                return;
              }
              if (!pendingRef.current) return;
              const dx = event.clientX - startXRef.current;
              const dy = event.clientY - startYRef.current;
              if (Math.abs(dx) < HORIZONTAL_LOCK_PX && Math.abs(dy) < HORIZONTAL_LOCK_PX) return;
              if (Math.abs(dx) > Math.abs(dy)) {
                event.preventDefault?.();
                event.stopPropagation?.();
                pointerIdRef.current = event.pointerId ?? pointerIdRef.current;
                beginScrub(event.clientX, event.currentTarget ?? null);
              } else {
                pendingRef.current = false;
              }
            },
            onPointerUp: (event: { clientX: number; stopPropagation?: () => void }) => {
              event.stopPropagation?.();
              if (lockedRef.current) {
                const nextTime = timeFromClientX(event.clientX);
                if (nextTime != null) targetTimeRef.current = nextTime;
                endScrub();
                return;
              }
              if (pendingRef.current) {
                const nextTime = timeFromClientX(event.clientX);
                if (nextTime != null) {
                  targetTimeRef.current = nextTime;
                  paintScrubber(nextTime, durationRef.current || videoRef.current?.getDuration() || 0);
                  const video = videoRef.current?.getVideoElement?.();
                  if (video) seekVideoElement(video, nextTime, true);
                  else videoRef.current?.seekTo(nextTime);
                  setIdleCurrentTime(nextTime);
                }
              }
              pendingRef.current = false;
              pointerIdRef.current = null;
            },
            onPointerCancel: endScrub,
          } as object)
        : null)}
      accessibilityRole="adjustable"
      accessibilityLabel="Reel progress"
      accessibilityValue={{
        min: 0,
        max: Math.round(idleDuration),
        now: Math.round(idleCurrentTime),
      }}
    >
      <View style={styles.timesRow} pointerEvents="none">
        {Platform.OS === "web" ? (
          <>
            <span ref={currentTimeElRef} style={webTimeStyle}>
              {formatVideoTime(idleCurrentTime)}
            </span>
            <span ref={durationElRef} style={webTimeStyle}>
              {formatVideoTime(idleDuration)}
            </span>
          </>
        ) : (
          <>
            <Text style={styles.time}>{formatVideoTime(idleCurrentTime)}</Text>
            <Text style={styles.time}>{formatVideoTime(idleDuration)}</Text>
          </>
        )}
      </View>

      <View ref={trackRef} style={styles.trackHit}>
        {Platform.OS === "web" ? (
          <div style={webTrackStyle}>
            <div
              ref={fillElRef}
              style={{ ...webFillStyle, width: `${progress * 100}%` }}
            />
            <div
              ref={thumbElRef}
              style={{ ...webThumbStyle, left: `${progress * 100}%` }}
            />
          </div>
        ) : (
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
            <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
          </View>
        )}
      </View>
    </View>
  );
}

const webTimeStyle: CSSProperties = {
  color: "rgba(255,255,255,0.82)",
  fontVariantNumeric: "tabular-nums",
  fontSize: 11,
  fontWeight: 600,
  lineHeight: "14px",
};

const webTrackStyle: CSSProperties = {
  position: "relative",
  height: TRACK_HEIGHT,
  borderRadius: 999,
  background: "rgba(255,255,255,0.28)",
  overflow: "visible",
};

const webFillStyle: CSSProperties = {
  height: TRACK_HEIGHT,
  borderRadius: 999,
  background: "#FFFFFF",
};

const webThumbStyle: CSSProperties = {
  position: "absolute",
  top: (TRACK_HEIGHT - THUMB_SIZE) / 2,
  width: THUMB_SIZE,
  height: THUMB_SIZE,
  marginLeft: -THUMB_SIZE / 2,
  borderRadius: THUMB_SIZE / 2,
  background: "#FFFFFF",
};

const styles = StyleSheet.create({
  root: {
    width: "100%",
    paddingTop: spacing.xs,
    paddingBottom: 2,
    zIndex: 46,
    ...(Platform.OS === "web"
      ? ({
          touchAction: "pan-y",
          userSelect: "none",
          WebkitUserSelect: "none",
        } as object)
      : null),
  },
  timesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  time: {
    ...typography.caption,
    color: "rgba(255,255,255,0.82)",
    fontVariant: ["tabular-nums"],
    fontSize: 11,
    fontWeight: "600",
  },
  trackHit: {
    height: TOUCH_HEIGHT,
    justifyContent: "center",
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "visible",
  },
  fill: {
    height: TRACK_HEIGHT,
    borderRadius: 999,
    backgroundColor: colors.white,
  },
  thumb: {
    position: "absolute",
    top: (TRACK_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    marginLeft: -THUMB_SIZE / 2,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.white,
  },
});
