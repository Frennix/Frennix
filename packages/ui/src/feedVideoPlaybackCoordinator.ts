type PauseHandler = () => void;

let playbackAllowed = true;
let activeVideoId: string | null = null;
const pauseHandlers = new Map<string, PauseHandler>();

export function buildFeedVideoPlaybackId(scopeId: string, mediaIndex: number) {
  return `${scopeId}:${mediaIndex}`;
}

export function setFeedVideoPlaybackAllowed(allowed: boolean) {
  if (playbackAllowed === allowed) return;
  playbackAllowed = allowed;
  if (!allowed) {
    pauseAllFeedVideos();
  }
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
  feedVideoSoundEnabled = enabled;
}
