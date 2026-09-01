import type { PostType } from "@frennix/types";

const STORAGE_KEY = "frennix:video-viewer-return";
const MAX_AGE_MS = 30 * 60 * 1000;

export type VideoViewerReturnState = {
  postId: string;
  mediaIndex: number;
  currentTime: number;
  muted: boolean;
  wasPlaying: boolean;
  mediaUrls: string[];
  postType?: PostType;
  thumbnailUrl?: string | null;
  playbackId?: string;
  savedAt: number;
};

export function saveVideoViewerReturnState(
  state: Omit<VideoViewerReturnState, "savedAt">
): void {
  if (typeof sessionStorage === "undefined") return;

  const payload: VideoViewerReturnState = {
    ...state,
    savedAt: Date.now(),
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage may be unavailable
  }
}

export function peekVideoViewerReturnState(): VideoViewerReturnState | null {
  if (typeof sessionStorage === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VideoViewerReturnState;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function consumeVideoViewerReturnState(): VideoViewerReturnState | null {
  const pending = peekVideoViewerReturnState();
  if (!pending) return null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return pending;
}

export function clearVideoViewerReturnState(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
