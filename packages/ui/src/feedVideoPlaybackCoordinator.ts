type PauseHandler = () => void;

export type FeedVideoFullscreenHandoff = {
  playbackId: string;
  mediaIndex: number;
  currentTime: number;
  muted: boolean;
  wasPlaying: boolean;
};

type FeedVideoSyncHandlers = {
  getCurrentTime: () => number;
  setCurrentTime: (time: number) => void;
  getMuted: () => boolean;
  setMuted: (muted: boolean) => void;
  isPaused: () => boolean;
};

let playbackAllowed = true;
let activeVideoId: string | null = null;
/** Feed inline video reparented into fullscreen — must not pause or reload on overlay open. */
let fullscreenHandoffPlaybackId: string | null = null;
const pauseHandlers = new Map<string, PauseHandler>();
const syncHandlers = new Map<string, FeedVideoSyncHandlers>();

export function setFeedVideoFullscreenHandoff(playbackId: string | null) {
  fullscreenHandoffPlaybackId = playbackId;
}

export function getFeedVideoFullscreenHandoff(): string | null {
  return fullscreenHandoffPlaybackId;
}

export function isFeedVideoFullscreenHandoff(playbackId: string | undefined | null): boolean {
  return Boolean(playbackId && fullscreenHandoffPlaybackId === playbackId);
}

export function buildFeedVideoPlaybackId(scopeId: string, mediaIndex: number) {
  return `${scopeId}:${mediaIndex}`;
}

type PlaybackAllowedListener = () => void;
const playbackAllowedListeners = new Set<PlaybackAllowedListener>();

export function subscribeFeedVideoPlaybackAllowed(listener: PlaybackAllowedListener) {
  playbackAllowedListeners.add(listener);
  return () => {
    playbackAllowedListeners.delete(listener);
  };
}

export function setFeedVideoPlaybackAllowed(allowed: boolean) {
  if (playbackAllowed === allowed) return;
  playbackAllowed = allowed;
  if (!allowed) {
    pauseAllFeedVideos();
  }
  playbackAllowedListeners.forEach((listener) => listener());
}

export function isFeedVideoPlaybackAllowed() {
  return playbackAllowed;
}

export function registerFeedVideoPauseHandler(videoId: string, pause: PauseHandler) {
  pauseHandlers.set(videoId, pause);
  return () => {
    const current = pauseHandlers.get(videoId);
    if (current === pause) {
      pauseHandlers.delete(videoId);
    }
  };
}

export function registerFeedVideoSyncHandlers(videoId: string, handlers: FeedVideoSyncHandlers) {
  syncHandlers.set(videoId, handlers);
  return () => {
    const current = syncHandlers.get(videoId);
    if (current === handlers) {
      syncHandlers.delete(videoId);
    }
  };
}

export function captureFeedVideoForFullscreen(playbackId: string): FeedVideoFullscreenHandoff | null {
  const handlers = syncHandlers.get(playbackId);
  if (!handlers) return null;

  const colon = playbackId.lastIndexOf(":");
  const mediaIndex = colon >= 0 ? Number(playbackId.slice(colon + 1)) : 0;

  return {
    playbackId,
    mediaIndex: Number.isFinite(mediaIndex) ? mediaIndex : 0,
    currentTime: handlers.getCurrentTime(),
    muted: handlers.getMuted(),
    wasPlaying: !handlers.isPaused(),
  };
}

export function restoreFeedVideoFromFullscreen(
  playbackId: string,
  currentTime: number,
  muted: boolean
) {
  const handlers = syncHandlers.get(playbackId);
  if (!handlers) return;
  handlers.setCurrentTime(currentTime);
  handlers.setMuted(muted);
}

export function requestFeedVideoPlay(videoId: string) {
  if (!playbackAllowed) return;
  pauseHandlers.forEach((pause, id) => {
    if (id !== videoId) pause();
  });
  activeVideoId = videoId;
}

export function releaseFeedVideoDueToVisibility(videoId: string) {
  if (activeVideoId === videoId) {
    activeVideoId = null;
  }
}

export function isActiveFeedVideo(videoId: string) {
  return playbackAllowed && activeVideoId === videoId;
}

export function getActiveFeedVideoId() {
  return activeVideoId;
}

type SoundPreferenceListener = () => void;
const soundPreferenceListeners = new Set<SoundPreferenceListener>();

export function subscribeFeedVideoSoundPreference(listener: SoundPreferenceListener) {
  soundPreferenceListeners.add(listener);
  return () => {
    soundPreferenceListeners.delete(listener);
  };
}

export function pauseAllFeedVideos() {
  pauseHandlers.forEach((pause, id) => {
    if (fullscreenHandoffPlaybackId && id === fullscreenHandoffPlaybackId) return;
    pause();
  });
  activeVideoId =
    fullscreenHandoffPlaybackId && activeVideoId === fullscreenHandoffPlaybackId
      ? fullscreenHandoffPlaybackId
      : null;
}

/** Session flag — true after the user explicitly unmutes any feed video. */
let feedVideoSoundEnabled = false;

export function isFeedVideoSoundEnabled() {
  return feedVideoSoundEnabled;
}

export function setFeedVideoSoundEnabled(enabled: boolean) {
  if (feedVideoSoundEnabled === enabled) return;
  feedVideoSoundEnabled = enabled;
  soundPreferenceListeners.forEach((listener) => listener());
}
