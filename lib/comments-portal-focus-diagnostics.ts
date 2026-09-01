import { getCommentsOverlayOpen, getCommentsOverlayPostId } from "@/lib/comments-overlay-state";

export type CommentsPortalFocusSnapshot = {
  phase: string;
  portalMounted: boolean;
  portalVisible: boolean;
  overlayOpen: boolean;
  overlayPostId: string | null;
  activeTag: string | null;
  activeInPortal: boolean;
  activeInFeed: boolean;
  activeIsCommentInput: boolean;
  activeCommentInputLocation: "modal" | "feed-inline" | "other" | null;
  modalCommentInputs: number;
  feedInlineCommentTargets: number;
  portalZIndex: string | null;
};

function readPortalElement(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector('[data-frennix-comments-sheet="true"]');
}

function isCommentInput(el: Element): boolean {
  if (el.matches('[data-frennix-comment-input="true"], textarea, input')) return true;
  return Boolean(el.closest('[data-frennix-comment-input="true"]'));
}

function classifyActiveElement(active: Element | null, portal: HTMLElement | null): CommentsPortalFocusSnapshot["activeCommentInputLocation"] {
  if (!active || !isCommentInput(active)) return null;
  if (portal?.contains(active)) return "modal";
  if (active.closest("#feed-scroll-list") || active.closest('[data-frennix-feed-inline-comment="true"]')) {
    return "feed-inline";
  }
  return "other";
}

/** Snapshot portal mount state, z-index, and where the focused element lives. */
export function collectCommentsPortalFocusSnapshot(phase: string): CommentsPortalFocusSnapshot {
  if (typeof document === "undefined") {
    return {
      phase,
      portalMounted: false,
      portalVisible: false,
      overlayOpen: false,
      overlayPostId: null,
      activeTag: null,
      activeInPortal: false,
      activeInFeed: false,
      activeIsCommentInput: false,
      activeCommentInputLocation: null,
      modalCommentInputs: 0,
      feedInlineCommentTargets: 0,
      portalZIndex: null,
    };
  }

  const portal = readPortalElement();
  const portalStyle = portal ? getComputedStyle(portal) : null;
  const active = document.activeElement instanceof Element ? document.activeElement : null;
  const modalInputs = portal
    ? portal.querySelectorAll('[data-frennix-comment-input="true"], textarea, input').length
    : 0;
  const feedInlineTargets = document.querySelectorAll('[data-frennix-feed-inline-comment="true"]').length;

  return {
    phase,
    portalMounted: Boolean(portal),
    portalVisible: Boolean(portal && portalStyle?.display !== "none" && portalStyle?.visibility !== "hidden"),
    overlayOpen: getCommentsOverlayOpen(),
    overlayPostId: getCommentsOverlayPostId(),
    activeTag: active?.tagName.toLowerCase() ?? null,
    activeInPortal: Boolean(portal && active && portal.contains(active)),
    activeInFeed: Boolean(active?.closest("#feed-scroll-list")),
    activeIsCommentInput: Boolean(active && isCommentInput(active)),
    activeCommentInputLocation: classifyActiveElement(active, portal),
    modalCommentInputs: modalInputs,
    feedInlineCommentTargets,
    portalZIndex: portalStyle?.zIndex ?? null,
  };
}
