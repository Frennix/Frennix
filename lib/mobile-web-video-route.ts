import { Platform } from "react-native";
import { router } from "expo-router";
import type { Post } from "@frennix/types";
import {
  buildFeedVideoPlaybackId,
  captureFeedVideoForFullscreen,
  getSharedPostTargetId,
} from "@frennix/ui";
import { isMobileWeb } from "@/lib/safari-visual-viewport";
import { saveFeedScrollReturnState } from "@/lib/web-feed-scroll-restore";
import { saveVideoViewerReturnState } from "@/lib/web-video-viewer-return";

/** Mobile web/PWA uses a dedicated /video/[postId] route instead of a feed portal. */
export function usesMobileWebVideoRoute(): boolean {
  return Platform.OS === "web" && isMobileWeb();
}

export function buildVideoRouteHref(
  postId: string,
  mediaIndex = 0
): `/video/${string}` {
  if (mediaIndex > 0) {
    return `/video/${postId}?mediaIndex=${mediaIndex}` as `/video/${string}`;
  }
  return `/video/${postId}` as `/video/${string}`;
}

export function buildVideoRouteHrefForPost(post: Post, mediaIndex = 0): `/video/${string}` {
  return buildVideoRouteHref(getSharedPostTargetId(post), mediaIndex);
}

/** Save feed scroll (+ inline playback when available) before following a video route link. */
export function prepareFeedVideoRouteNavigation(postId: string, mediaIndex: number): void {
  saveFeedScrollReturnState();

  const playbackId = buildFeedVideoPlaybackId(postId, mediaIndex);
  const handoff = captureFeedVideoForFullscreen(playbackId);
  if (!handoff) return;

  saveVideoViewerReturnState({
    postId,
    mediaIndex,
    currentTime: handoff.currentTime,
    muted: handoff.muted,
    wasPlaying: handoff.wasPlaying,
    mediaUrls: [],
    playbackId: handoff.playbackId,
  });
}

/** Navigate to the opaque video screen (feed is unmounted underneath). */
export function navigateToPostVideo(post: Post, mediaIndex = 0): boolean {
  if (!usesMobileWebVideoRoute()) return false;

  prepareFeedVideoRouteNavigation(getSharedPostTargetId(post), mediaIndex);
  router.push(buildVideoRouteHrefForPost(post, mediaIndex));
  return true;
}
