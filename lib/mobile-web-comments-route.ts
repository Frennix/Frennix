import { Platform } from "react-native";
import { router } from "expo-router";
import type { Post } from "@frennix/types";
import { getSharedPostTargetId } from "@frennix/ui";
import { isMobileWeb } from "@/lib/safari-visual-viewport";
import type { VideoViewerPlaybackState } from "@/lib/immersive-video-gallery";
import { saveFeedScrollReturnState } from "@/lib/web-feed-scroll-restore";
import { saveVideoViewerReturnState } from "@/lib/web-video-viewer-return";

const COMMENTS_RETURN_TARGET_KEY = "frennix:comments-return-target";

function markCommentsReturnTarget(target: "feed" | "video"): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(COMMENTS_RETURN_TARGET_KEY, target);
  } catch {
    // ignore
  }
}

/** True when comments back should restore feed scroll (feed-origin, not video-origin). */
export function shouldRestoreFeedScrollOnCommentsBack(): boolean {
  if (typeof sessionStorage === "undefined") return true;
  try {
    const target = sessionStorage.getItem(COMMENTS_RETURN_TARGET_KEY);
    sessionStorage.removeItem(COMMENTS_RETURN_TARGET_KEY);
    return target !== "video";
  } catch {
    return true;
  }
}

/** Mobile web/PWA uses a dedicated /comments/[postId] route instead of a feed portal. */
export function usesMobileWebCommentsRoute(): boolean {
  return Platform.OS === "web" && isMobileWeb();
}

export function buildCommentsRouteHref(post: Post, draft?: string): `/comments/${string}` {
  const postId = getSharedPostTargetId(post);
  return draft
    ? (`/comments/${postId}?draft=${encodeURIComponent(draft)}` as `/comments/${string}`)
    : (`/comments/${postId}` as `/comments/${string}`);
}

/** Navigate to the opaque comments screen (feed is unmounted underneath). */
export function navigateToPostComments(post: Post, draft?: string): boolean {
  if (!usesMobileWebCommentsRoute()) return false;

  markCommentsReturnTarget("feed");
  saveFeedScrollReturnState();
  router.push(buildCommentsRouteHref(post, draft));
  return true;
}

/** Navigate to comments from the immersive video viewer (saves playback for return). */
export function navigateToPostCommentsFromVideoViewer(
  post: Post,
  playback: VideoViewerPlaybackState,
  mediaUrls: string[],
  options?: { draft?: string; thumbnailUrl?: string | null; postType?: Post["post_type"] }
): boolean {
  if (!usesMobileWebCommentsRoute()) return false;

  const postId = getSharedPostTargetId(post);
  saveVideoViewerReturnState({
    postId,
    mediaIndex: playback.mediaIndex,
    currentTime: playback.currentTime,
    muted: playback.muted,
    wasPlaying: playback.wasPlaying,
    mediaUrls,
    thumbnailUrl: options?.thumbnailUrl ?? post.thumbnail_url ?? null,
    postType: options?.postType ?? post.post_type,
    playbackId: playback.playbackId,
  });
  markCommentsReturnTarget("video");
  saveFeedScrollReturnState();
  router.push(buildCommentsRouteHref(post, options?.draft));
  return true;
}
