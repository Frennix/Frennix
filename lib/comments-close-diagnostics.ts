import { Platform } from "react-native";
import { isFeedScrollDebugEnabled } from "@/lib/feed-scroll-debug";
import { OVERLAY_Z_INDEX } from "@/lib/overlay-z-index";
import { collectCommentsPortalFocusSnapshot } from "@/lib/comments-portal-focus-diagnostics";

const LOG_PREFIX = "[comments-close-diag]";

export type CommentsCloseReason =
  | "close-button"
  | "backdrop-click"
  | "swipe-dismiss"
  | "route-change"
  | "focus"
  | "blur"
  | "visual-viewport-resize"
  | "visual-viewport-scroll"
  | "keyboard-event"
  | "component-cleanup"
  | "parent-onClose"
  | "unknown";

let closeSequence = 0;

/** Log every comments close/hide request with reason and portal/focus snapshot. */
export function logCommentsCloseRequest(source: string, reason: CommentsCloseReason): number {
  closeSequence += 1;
  const id = closeSequence;
  if (Platform.OS === "web" && isFeedScrollDebugEnabled()) {
    console.info(LOG_PREFIX, {
      id,
      source,
      reason,
      zIndex: OVERLAY_Z_INDEX.commentsSheet,
      ...collectCommentsPortalFocusSnapshot(`close:${reason}`),
    });
  }
  return id;
}

export function logCommentsPortalInteraction(phase: string): void {
  if (Platform.OS !== "web" || !isFeedScrollDebugEnabled()) return;
  console.info("[comments-portal-diag]", {
    phase,
    zIndex: OVERLAY_Z_INDEX.commentsSheet,
    ...collectCommentsPortalFocusSnapshot(phase),
  });
}

if (typeof window !== "undefined") {
  (
    window as Window & { __FRENNIX_COMMENTS_CLOSE_DIAG__?: () => ReturnType<typeof collectCommentsPortalFocusSnapshot> }
  ).__FRENNIX_COMMENTS_CLOSE_DIAG__ = () => collectCommentsPortalFocusSnapshot("manual");
}
