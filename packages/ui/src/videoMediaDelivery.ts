/** Shared feed/fullscreen video load policy — no signed URLs in this app (public storage). */

export const VIDEO_FIRST_FRAME_TIMEOUT_MS = 25_000;
export const VIDEO_MAX_AUTO_RETRIES = 1;

export type VideoMediaFailureReason =
  | "aborted"
  | "network"
  | "decode"
  | "unsupported"
  | "timeout"
  | "unknown";

export type VideoMediaFailureContext = {
  surface: "feed" | "fullscreen";
  reason: VideoMediaFailureReason;
  /** File extension only — never log full URLs. */
  ext?: string | null;
  playbackId?: string;
  attempt?: number;
};

export function mediaExtensionFromUri(uri?: string | null): string | null {
  if (!uri) return null;
  const match = uri.match(/\.([a-z0-9]+)(?:\?|$)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function classifyVideoMediaError(
  video: HTMLVideoElement | null | undefined
): VideoMediaFailureReason {
  const code = video?.error?.code;
  if (code == null) return "unknown";
  switch (code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return "aborted";
    case MediaError.MEDIA_ERR_NETWORK:
      return "network";
    case MediaError.MEDIA_ERR_DECODE:
      return "decode";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "unsupported";
    default:
      return "unknown";
  }
}

/** Non-sensitive diagnostic — safe for console / client diagnostics. */
export function logVideoMediaFailure(context: VideoMediaFailureContext): void {
  const payload = {
    category: "video-media",
    reason: context.reason,
    surface: context.surface,
    ext: context.ext ?? null,
    playbackId: context.playbackId ?? null,
    attempt: context.attempt ?? 0,
  };
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    console.warn("[video-media]", payload);
  }
}

export function shouldAutoRetryVideoLoad(
  reason: VideoMediaFailureReason,
  attempt: number
): boolean {
  if (attempt >= VIDEO_MAX_AUTO_RETRIES) return false;
  if (reason === "aborted") return false;
  return true;
}

export function userFacingVideoUnavailableLabel(_reason: VideoMediaFailureReason): string {
  return "Video unavailable";
}
