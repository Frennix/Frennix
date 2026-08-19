import { Platform } from "react-native";
import { FEED_SCROLL_ROOT_ID, FEED_VIDEO_VISIBILITY_THRESHOLD } from "./useFeedVideoIntersectionObserver";

export type FeedVideoDebugEvent =
  | "play-requested"
  | "play-started"
  | "pause-called"
  | "pause-result"
  | "scroll-out-trigger"
  | "io-callback"
  | "io-attached"
  | "io-attach-miss"
  | "io-disabled"
  | "media-event"
  | "scroll-measure"
  | "scroll-root-audit"
  | "video-audit"
  | "should-play-change";

type FeedVideoDebugEntry = {
  at: string;
  event: FeedVideoDebugEvent;
  playbackId?: string;
  data: Record<string, unknown>;
};

declare global {
  interface Window {
    __FRENNIX_FEED_VIDEO_DEBUG__?: boolean;
    __FRENNIX_FEED_VIDEO_DEBUG_LOG__?: FeedVideoDebugEntry[];
    __FRENNIX_FEED_VIDEO_DEBUG_DUMP__?: () => FeedVideoDebugEntry[];
    __FRENNIX_FEED_VIDEO_DEBUG_REPORT__?: () => string;
  }
}

const LOG_CAP = 400;
const DEBUG_STORAGE_KEY = "frennix-feed-video-debug";

type LastIoState = {
  at: string;
  playbackId?: string;
  intersectionRatio: number;
  isIntersecting: boolean;
  belowThreshold: boolean;
  hasMetThreshold: boolean;
  root: ReturnType<typeof describeElement>;
};

let lastIoState: LastIoState | null = null;
let lastAttachedIoRoot: ReturnType<typeof describeElement> = null;

function readUrlDebugFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("feedVideoDebug") === "1") return true;
    if (window.location.hash.includes("feedVideoDebug=1")) return true;
  } catch {
    // ignore malformed URLs
  }
  return false;
}

/** Persists ?feedVideoDebug=1 for the rest of the session (preview builds). */
export function persistFeedVideoDebugFlagFromUrl() {
  if (typeof window === "undefined" || !readUrlDebugFlag()) return;
  try {
    localStorage.setItem(DEBUG_STORAGE_KEY, "1");
  } catch {
    window.__FRENNIX_FEED_VIDEO_DEBUG__ = true;
  }
}

export function isFeedVideoDebugEnabled(): boolean {
  if (Platform.OS !== "web") return false;
  if (typeof window !== "undefined") {
    if (window.__FRENNIX_FEED_VIDEO_DEBUG__ === true) return true;
    if (readUrlDebugFlag()) return true;
    try {
      if (localStorage.getItem(DEBUG_STORAGE_KEY) === "1") return true;
    } catch {
      // localStorage may be blocked in private mode.
    }
  }
  return typeof __DEV__ !== "undefined" && __DEV__;
}

/** Shows the on-screen copy panel (preview / local diagnostic builds only). */
export function isFeedVideoDebugPanelEnabled(): boolean {
  return isFeedVideoDebugEnabled();
}

function pushLog(entry: FeedVideoDebugEntry) {
  if (!isFeedVideoDebugEnabled() || typeof window === "undefined") return;
  const log = window.__FRENNIX_FEED_VIDEO_DEBUG_LOG__ ?? [];
  log.push(entry);
  if (log.length > LOG_CAP) log.splice(0, log.length - LOG_CAP);
  window.__FRENNIX_FEED_VIDEO_DEBUG_LOG__ = log;
  window.__FRENNIX_FEED_VIDEO_DEBUG_DUMP__ = () => [...log];
  window.__FRENNIX_FEED_VIDEO_DEBUG_REPORT__ = () => formatFeedVideoDebugReport();
  // eslint-disable-next-line no-console
  console.log(`[feed-video] ${entry.event}`, entry.playbackId ?? "", entry.data);
}

export function logFeedVideo(
  event: FeedVideoDebugEvent,
  playbackId: string | undefined,
  data: Record<string, unknown>
) {
  pushLog({
    at: new Date().toISOString(),
    event,
    playbackId,
    data,
  });
}

function describeElement(el: Element | null | undefined) {
  if (!el || typeof el.getBoundingClientRect !== "function") {
    return null;
  }
  const rect = el.getBoundingClientRect();
  const style = typeof getComputedStyle !== "undefined" ? getComputedStyle(el) : null;
  const scrollEl = el as HTMLElement;
  return {
    tag: el.tagName,
    id: el.id || null,
    className: typeof el.className === "string" ? el.className.slice(0, 120) : null,
    rect: {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      bottom: Math.round(rect.bottom),
    },
    scrollTop: scrollEl.scrollTop ?? null,
    scrollHeight: scrollEl.scrollHeight ?? null,
    clientHeight: scrollEl.clientHeight ?? null,
    overflowY: style?.overflowY ?? null,
    overflowX: style?.overflowX ?? null,
  };
}

/** Confirms whether #feed-scroll-list exists and which element is actually scrolling. */
export function auditFeedScrollRoot(playbackId?: string) {
  if (!isFeedVideoDebugEnabled() || typeof document === "undefined") return null;

  const byId = document.getElementById(FEED_SCROLL_ROOT_ID);
  const candidates = Array.from(document.querySelectorAll(`#${FEED_SCROLL_ROOT_ID}, [id="${FEED_SCROLL_ROOT_ID}"]`));
  const overflowScrollers = Array.from(document.querySelectorAll("*")).filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    const style = getComputedStyle(el);
    const scrollable =
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight + 4;
    return scrollable && el.id.includes("feed");
  });

  const audit = {
    feedScrollRootId: FEED_SCROLL_ROOT_ID,
    rootFound: Boolean(byId),
    rootMatchCount: candidates.length,
    root: describeElement(byId),
    feedOverflowScrollers: overflowScrollers.slice(0, 8).map(describeElement),
    feedRootContainer: describeElement(document.getElementById("feed-root-container")),
    feedScrollShell: describeElement(document.getElementById("feed-scroll-shell")),
  };

  logFeedVideo("scroll-root-audit", playbackId, audit);
  return audit;
}

export function measureVideoInFeedViewport(video: HTMLVideoElement | null) {
  if (!video || typeof document === "undefined") {
    return {
      videoFound: false,
      ratio: 0,
      visibleHeight: 0,
      height: 0,
    };
  }

  const videoRect = video.getBoundingClientRect();
  const root = document.getElementById(FEED_SCROLL_ROOT_ID);
  const height = videoRect.height;

  if (!root || height <= 0) {
    return {
      videoFound: true,
      rootFound: Boolean(root),
      ratio: 0,
      visibleHeight: 0,
      height,
      videoRect: describeElement(video)?.rect ?? null,
      rootRect: describeElement(root)?.rect ?? null,
    };
  }

  const rootRect = root.getBoundingClientRect();
  const visibleTop = Math.max(rootRect.top, videoRect.top);
  const visibleBottom = Math.min(rootRect.bottom, videoRect.bottom);
  const visibleHeight = Math.max(0, visibleBottom - visibleTop);
  const ratio = visibleHeight / height;

  return {
    videoFound: true,
    rootFound: true,
    ratio,
    visibleHeight,
    height,
    belowThreshold: ratio < FEED_VIDEO_VISIBILITY_THRESHOLD,
    videoRect: describeElement(video)?.rect ?? null,
    rootRect: describeElement(root)?.rect ?? null,
    rootScrollTop: (root as HTMLElement).scrollTop ?? null,
  };
}

/** Lists every <video> in the feed and flags any that are still playing audio. */
export function auditFeedVideoElements(playbackId: string | undefined, uri: string) {
  if (!isFeedVideoDebugEnabled() || typeof document === "undefined") return null;

  const feedRoot = document.getElementById("feed-root-container");
  const scope = feedRoot ?? document.body;
  const videos = Array.from(scope.querySelectorAll("video"));

  const rows = videos.map((video, index) => {
    const src = video.currentSrc || video.getAttribute("src") || "";
    const sameUri = src === uri || src.includes(uri) || uri.includes(src);
    const postCard = video.closest("[data-post-id], [nativeid], [id]");
    return {
      index,
      sameUri,
      src: src.slice(0, 120),
      paused: video.paused,
      muted: video.muted,
      volume: video.volume,
      currentTime: Math.round(video.currentTime * 100) / 100,
      readyState: video.readyState,
      inDom: document.contains(video),
      rect: describeElement(video)?.rect ?? null,
      postAncestorId:
        postCard instanceof HTMLElement ? postCard.id || postCard.getAttribute("nativeid") : null,
      isActiveElement: video === document.activeElement,
      producingAudibleOutput: !video.paused && !video.muted && video.volume > 0,
    };
  });

  const audit = {
    uri: uri.slice(0, 120),
    videoCount: videos.length,
    sameUriCount: rows.filter((row) => row.sameUri).length,
    audibleCount: rows.filter((row) => row.producingAudibleOutput).length,
    rows,
  };

  logFeedVideo("video-audit", playbackId, audit);
  return audit;
}

let activeDebugVideo: HTMLVideoElement | null = null;
let activeDebugPlaybackId: string | null = null;

export function setActiveFeedVideoDebugTarget(
  playbackId: string | null,
  video: HTMLVideoElement | null
) {
  activeDebugPlaybackId = playbackId;
  activeDebugVideo = video;
}

export function getActiveFeedVideoDebugTarget() {
  return {
    playbackId: activeDebugPlaybackId,
    video: activeDebugVideo,
  };
}

export function recordFeedVideoIoCallback(input: {
  playbackId?: string;
  intersectionRatio: number;
  isIntersecting: boolean;
  belowThreshold: boolean;
  hasMetThreshold: boolean;
  root: Element | null;
}) {
  lastIoState = {
    at: new Date().toISOString(),
    playbackId: input.playbackId,
    intersectionRatio: input.intersectionRatio,
    isIntersecting: input.isIntersecting,
    belowThreshold: input.belowThreshold,
    hasMetThreshold: input.hasMetThreshold,
    root: describeElement(input.root),
  };
}

export function recordFeedVideoIoAttached(root: Element | null) {
  lastAttachedIoRoot = describeElement(root);
}

function listFeedVideoElements() {
  if (typeof document === "undefined") return [];
  const feedRoot = document.getElementById("feed-root-container");
  const scope = feedRoot ?? document.body;
  return Array.from(scope.querySelectorAll("video"));
}

function describeVideoElement(video: HTMLVideoElement, index: number, activeVideo: HTMLVideoElement | null) {
  const style = typeof getComputedStyle !== "undefined" ? getComputedStyle(video) : null;
  const rect = describeElement(video)?.rect ?? null;
  const root = document.getElementById(FEED_SCROLL_ROOT_ID);
  const measure = measureVideoInFeedViewport(video);
  const hiddenByStyle =
    style != null &&
    (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) < 0.05);
  const producingAudibleOutput = !video.paused && !video.muted && video.volume > 0;

  return {
    index,
    isTrackedActiveVideo: video === activeVideo,
    src: (video.currentSrc || video.getAttribute("src") || "").slice(0, 160),
    paused: video.paused,
    muted: video.muted,
    volume: video.volume,
    currentTime: Math.round(video.currentTime * 100) / 100,
    readyState: video.readyState,
    inDom: document.contains(video),
    hiddenByStyle,
    rect,
    intersectionRatio: measure.ratio ?? null,
    isIntersectingInFeedViewport: measure.belowThreshold === false,
    producingAudibleOutput,
    likelyHiddenAudibleSource: producingAudibleOutput && (hiddenByStyle || measure.belowThreshold === true),
  };
}

export function collectFeedVideoDebugSnapshot() {
  const { playbackId: activeVideoId, video: activeVideo } = getActiveFeedVideoDebugTarget();
  const videos = listFeedVideoElements();
  const videoRows = videos.map((video, index) => describeVideoElement(video, index, activeVideo));
  const scrollRoot = document.getElementById(FEED_SCROLL_ROOT_ID);
  const activeMeasure = measureVideoInFeedViewport(activeVideo);
  const audibleVideos = videoRows.filter((row) => row.producingAudibleOutput);
  const hiddenAudibleVideos = videoRows.filter((row) => row.likelyHiddenAudibleSource);
  const playingVideos = videoRows.filter((row) => !row.paused);
  const events = typeof window !== "undefined" ? window.__FRENNIX_FEED_VIDEO_DEBUG_LOG__ ?? [] : [];

  return {
    capturedAt: new Date().toISOString(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    activeVideoId,
    activeVideoInDom: activeVideo ? document.contains(activeVideo) : false,
    activeVideoState: activeVideo
      ? {
          paused: activeVideo.paused,
          muted: activeVideo.muted,
          currentTime: Math.round(activeVideo.currentTime * 100) / 100,
          src: (activeVideo.currentSrc || activeVideo.src).slice(0, 160),
        }
      : null,
    htmlVideoElementCount: videos.length,
    playingVideoIndexes: playingVideos.map((row) => row.index),
    audibleVideoIndexes: audibleVideos.map((row) => row.index),
    hiddenAudibleVideoIndexes: hiddenAudibleVideos.map((row) => row.index),
    secondHiddenVideoProducingAudio: hiddenAudibleVideos.length > 0,
    feedScrollListFound: Boolean(scrollRoot),
    feedScrollList: describeElement(scrollRoot),
    intersectionObserverRootUsed: lastAttachedIoRoot,
    lastIntersectionObserverCallback: lastIoState,
    activeVideoViewportMeasure: activeMeasure,
    videoElements: videoRows,
    pauseCalledEvents: events.filter((entry) => entry.event === "pause-called"),
    pauseResultEvents: events.filter((entry) => entry.event === "pause-result"),
    mediaEvents: events.filter((entry) => entry.event === "media-event"),
    scrollOutTriggers: events.filter((entry) => entry.event === "scroll-out-trigger"),
    ioCallbacks: events.filter((entry) => entry.event === "io-callback").slice(-20),
    scrollMeasures: events.filter((entry) => entry.event === "scroll-measure").slice(-20),
    fullEventLog: events,
  };
}

export function formatFeedVideoDebugReport(snapshot = collectFeedVideoDebugSnapshot()): string {
  const lines: string[] = [
    "Frennix Feed Video Debug Report",
    `Captured: ${snapshot.capturedAt}`,
    "",
    "=== SNAPSHOT ===",
    `Active video ID: ${snapshot.activeVideoId ?? "(none)"}`,
    `HTML video element count: ${snapshot.htmlVideoElementCount}`,
    `Playing video indexes: ${snapshot.playingVideoIndexes.join(", ") || "(none)"}`,
    `Audible video indexes: ${snapshot.audibleVideoIndexes.join(", ") || "(none)"}`,
    `Hidden audible source detected: ${snapshot.secondHiddenVideoProducingAudio ? "YES" : "no"}`,
    `#feed-scroll-list found: ${snapshot.feedScrollListFound ? "yes" : "NO"}`,
    `IntersectionObserver root used: ${JSON.stringify(snapshot.intersectionObserverRootUsed)}`,
    "",
    "=== ACTIVE VIDEO ===",
    JSON.stringify(snapshot.activeVideoState, null, 2),
    "",
    "=== ACTIVE VIDEO VIEWPORT MEASURE ===",
    JSON.stringify(snapshot.activeVideoViewportMeasure, null, 2),
    "",
    "=== LAST IO CALLBACK ===",
    JSON.stringify(snapshot.lastIntersectionObserverCallback, null, 2),
    "",
    "=== FEED SCROLL LIST RECT ===",
    JSON.stringify(snapshot.feedScrollList, null, 2),
    "",
    "=== ALL VIDEO ELEMENTS ===",
    JSON.stringify(snapshot.videoElements, null, 2),
    "",
    "=== PAUSE-CALLED EVENTS ===",
    JSON.stringify(snapshot.pauseCalledEvents, null, 2),
    "",
    "=== MEDIA EVENTS ===",
    JSON.stringify(snapshot.mediaEvents, null, 2),
    "",
    "=== FULL EVENT LOG ===",
    JSON.stringify(snapshot.fullEventLog, null, 2),
  ];

  return lines.join("\n");
}

export async function copyFeedVideoDebugReportToClipboard(): Promise<boolean> {
  if (typeof document === "undefined") return false;
  const text = formatFeedVideoDebugReport();

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy copy path
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export function debugFeedVideoOnScroll() {
  if (!isFeedVideoDebugEnabled() || !activeDebugVideo) return;

  const video = activeDebugVideo;
  if (!document.contains(video)) {
    logFeedVideo("scroll-measure", activeDebugPlaybackId ?? undefined, {
      videoInDom: false,
      note: "Active debug video ref is detached from DOM",
    });
    return;
  }

  const measure = measureVideoInFeedViewport(video);
  logFeedVideo("scroll-measure", activeDebugPlaybackId ?? undefined, {
    ...measure,
    videoPaused: video.paused,
    videoMuted: video.muted,
    ioWouldFirePause: measure.belowThreshold === true,
  });
}

export function attachFeedVideoMediaEventLoggers(
  video: HTMLVideoElement,
  playbackId: string | undefined
) {
  if (!isFeedVideoDebugEnabled()) return () => undefined;

  const events = ["play", "pause", "ended", "volumechange"] as const;

  const handlers = events.map((eventName) => {
    const handler = () => {
      logFeedVideo("media-event", playbackId, {
        eventName,
        paused: video.paused,
        muted: video.muted,
        volume: video.volume,
        currentTime: Math.round(video.currentTime * 100) / 100,
        inDom: document.contains(video),
      });
      if (eventName === "play" || eventName === "volumechange") {
        auditFeedVideoElements(playbackId, video.currentSrc || video.src);
      }
    };
    video.addEventListener(eventName, handler);
    return { eventName, handler };
  });

  return () => {
    handlers.forEach(({ eventName, handler }) => {
      video.removeEventListener(eventName, handler);
    });
  };
}

export function logFeedVideoPauseAttempt(
  playbackId: string | undefined,
  video: HTMLVideoElement | null,
  reason: string
) {
  logFeedVideo("pause-called", playbackId, {
    reason,
    hasVideoRef: Boolean(video),
    beforePaused: video?.paused ?? null,
    beforeMuted: video?.muted ?? null,
    inDom: video ? document.contains(video) : null,
  });

  if (!video) return;

  video.pause();

  logFeedVideo("pause-result", playbackId, {
    reason,
    afterPaused: video.paused,
    afterMuted: video.muted,
    inDom: document.contains(video),
  });
}
