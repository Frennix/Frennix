import { Platform } from "react-native";
import { router } from "expo-router";
import type { Post } from "@frennix/types";
import { getSharedPostTargetId } from "@frennix/ui";
import { isMobileWeb } from "@/lib/safari-visual-viewport";
import { saveFeedScrollReturnState } from "@/lib/web-feed-scroll-restore";

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

  saveFeedScrollReturnState();
  router.push(buildCommentsRouteHref(post, draft));
  return true;
}
