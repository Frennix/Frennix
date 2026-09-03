/** Max concurrent feed videos buffering ahead of playback (current + ~2 nearby). */
export const FEED_VIDEO_MAX_PRELOAD_SLOTS = 3;

/** Delay before showing stall spinner while video is expected to play. */
export const FEED_VIDEO_STALL_SPINNER_MS = 400;

type PreloadListener = () => void;
const preloadListeners = new Set<PreloadListener>();

const playbackZoneIds = new Set<string>();
/** playbackId -> claimedAt (ms) */
const preloadSlotClaims = new Map<string, number>();

function notifyPreloadListeners() {
  preloadListeners.forEach((listener) => listener());
}

export function subscribeFeedVideoPreloadSlots(listener: PreloadListener) {
  preloadListeners.add(listener);
  return () => {
    preloadListeners.delete(listener);
  };
}

export function setFeedVideoPlaybackZone(playbackId: string, inZone: boolean) {
  if (inZone) {
    playbackZoneIds.add(playbackId);
    preloadSlotClaims.set(playbackId, Date.now());
  } else {
    playbackZoneIds.delete(playbackId);
  }
  evictPreloadSlots();
  notifyPreloadListeners();
}

export function setFeedVideoPreloadCandidate(playbackId: string, inPreloadZone: boolean) {
  if (inPreloadZone) {
    claimPreloadSlot(playbackId);
  } else if (!playbackZoneIds.has(playbackId)) {
    preloadSlotClaims.delete(playbackId);
    evictPreloadSlots();
    notifyPreloadListeners();
  }
}

export function isFeedVideoPreloadGranted(playbackId: string | undefined | null): boolean {
  if (!playbackId) return false;
  return playbackZoneIds.has(playbackId) || preloadSlotClaims.has(playbackId);
}

export function releaseFeedVideoPreloadSlot(playbackId: string) {
  preloadSlotClaims.delete(playbackId);
  playbackZoneIds.delete(playbackId);
  notifyPreloadListeners();
}

function claimPreloadSlot(playbackId: string): boolean {
  if (playbackZoneIds.has(playbackId)) {
    preloadSlotClaims.set(playbackId, Date.now());
    return true;
  }
  if (preloadSlotClaims.has(playbackId)) {
    preloadSlotClaims.set(playbackId, Date.now());
    return true;
  }
  evictPreloadSlots();
  if (preloadSlotClaims.size >= FEED_VIDEO_MAX_PRELOAD_SLOTS) {
    return false;
  }
  preloadSlotClaims.set(playbackId, Date.now());
  notifyPreloadListeners();
  return true;
}

function evictPreloadSlots() {
  while (preloadSlotClaims.size > FEED_VIDEO_MAX_PRELOAD_SLOTS) {
    let oldestId: string | null = null;
    let oldestAt = Infinity;
    preloadSlotClaims.forEach((claimedAt, id) => {
      if (playbackZoneIds.has(id)) return;
      if (claimedAt < oldestAt) {
        oldestAt = claimedAt;
        oldestId = id;
      }
    });
    if (!oldestId) break;
    preloadSlotClaims.delete(oldestId);
  }
}

export function isFeedVideoBackgroundPreloadDisabled(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (connection?.saveData) return true;
  const type = connection?.effectiveType;
  return type === "slow-2g" || type === "2g";
}
