import { colors } from "./theme";

const INLINE_CLASS = "feed-inline-video feed-inline-video-cover";
const FULLSCREEN_CLASS = "fullscreen-video-slide";

type FeedVideoDomEntry = {
  video: HTMLVideoElement;
  mount: HTMLElement;
};

const feedVideoDom = new Map<string, FeedVideoDomEntry>();
const adoptedPlaybackIds = new Set<string>();

type DomAdoptedListener = () => void;
const domAdoptedListeners = new Set<DomAdoptedListener>();

function notifyDomAdopted() {
  domAdoptedListeners.forEach((listener) => listener());
}

export function configureFeedWebVideoElement(video: HTMLVideoElement) {
  video.controls = false;
  video.removeAttribute("controls");
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "true");
  video.setAttribute("x-webkit-airplay", "deny");
  video.disablePictureInPicture = true;
  video.disableRemotePlayback = true;
}

export function subscribeFeedVideoDomAdopted(listener: DomAdoptedListener) {
  domAdoptedListeners.add(listener);
  return () => {
    domAdoptedListeners.delete(listener);
  };
}

export function isFeedVideoDomAdopted(playbackId: string | undefined | null): boolean {
  return Boolean(playbackId && adoptedPlaybackIds.has(playbackId));
}

export function registerFeedVideoDom(
  playbackId: string,
  video: HTMLVideoElement,
  mount: HTMLElement
) {
  feedVideoDom.set(playbackId, { video, mount });
}

export function unregisterFeedVideoDom(playbackId: string, video: HTMLVideoElement) {
  const entry = feedVideoDom.get(playbackId);
  if (entry?.video === video) {
    feedVideoDom.delete(playbackId);
  }
  adoptedPlaybackIds.delete(playbackId);
}

export function getRegisteredFeedVideoElement(playbackId: string): HTMLVideoElement | null {
  return feedVideoDom.get(playbackId)?.video ?? null;
}

export type FeedVideoFullscreenPresentation = {
  width: number;
  height: number;
  objectFit: "cover" | "contain";
  immersiveMode?: boolean;
};

export function adoptFeedVideoDomForFullscreen(
  playbackId: string,
  targetMount: HTMLElement,
  presentation: FeedVideoFullscreenPresentation
): HTMLVideoElement | null {
  const entry = feedVideoDom.get(playbackId);
  if (!entry) return null;

  const { video } = entry;
  if (targetMount !== video.parentElement) {
    targetMount.appendChild(video);
  }

  video.classList.remove(...INLINE_CLASS.split(/\s+/));
  video.classList.add(FULLSCREEN_CLASS);
  configureFeedWebVideoElement(video);
  video.style.width = `${presentation.width}px`;
  video.style.height = `${presentation.height}px`;
  video.style.objectFit = presentation.objectFit;
  video.style.objectPosition = "center";
  video.style.backgroundColor = colors.background;
  video.style.pointerEvents = presentation.immersiveMode ? "none" : "auto";

  adoptedPlaybackIds.add(playbackId);
  notifyDomAdopted();
  return video;
}

export function returnFeedVideoDomFromFullscreen(playbackId: string): HTMLVideoElement | null {
  const entry = feedVideoDom.get(playbackId);
  if (!entry) return null;

  const { video, mount } = entry;
  if (mount !== video.parentElement) {
    mount.appendChild(video);
  }

  video.classList.remove(FULLSCREEN_CLASS);
  video.classList.add(...INLINE_CLASS.split(/\s+/));
  configureFeedWebVideoElement(video);
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.objectFit = "cover";
  video.style.objectPosition = "center";
  video.style.backgroundColor = colors.background;
  video.style.pointerEvents = "none";

  adoptedPlaybackIds.delete(playbackId);
  notifyDomAdopted();
  return video;
}
