type PauseHandler = () => void;

let playbackAllowed = true;
let activeVideoId: string | null = null;
const pauseHandlers = new Map<string, PauseHandler>();

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
  pauseHandlers.forEach((pause) => pause());
  activeVideoId = null;
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
