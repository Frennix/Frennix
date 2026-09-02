import { useEffect, useState } from "react";

type CommentsOverlayListener = (open: boolean) => void;
type CommentsVideoPeekLayout = {
  height: number;
  offsetTop: number;
};
type CommentsVideoPeekListener = (layout: CommentsVideoPeekLayout | null) => void;

let commentsOverlayOpen = false;
let commentsOverlayPostId: string | null = null;
let commentsVideoPeekLayout: CommentsVideoPeekLayout | null = null;
const listeners = new Set<CommentsOverlayListener>();
const videoPeekListeners = new Set<CommentsVideoPeekListener>();

function syncCommentsOverlayDocumentState(): void {
  if (typeof document === "undefined") return;
  if (commentsOverlayOpen) {
    document.body.setAttribute("data-frennix-comments-open", "true");
    if (commentsOverlayPostId) {
      document.body.setAttribute("data-frennix-comments-post-id", commentsOverlayPostId);
    } else {
      document.body.removeAttribute("data-frennix-comments-post-id");
    }
  } else {
    document.body.removeAttribute("data-frennix-comments-open");
    document.body.removeAttribute("data-frennix-comments-post-id");
  }
}

export function setCommentsOverlayOpen(open: boolean, postId?: string | null) {
  const nextPostId = open ? (postId ?? commentsOverlayPostId) : null;
  if (commentsOverlayOpen === open && commentsOverlayPostId === nextPostId) return;
  commentsOverlayOpen = open;
  commentsOverlayPostId = nextPostId;
  if (!open) {
    setCommentsVideoPeekLayout(null);
  }
  syncCommentsOverlayDocumentState();
  listeners.forEach((listener) => listener(open));
}

export function setCommentsVideoPeekLayout(layout: CommentsVideoPeekLayout | null) {
  if (
    commentsVideoPeekLayout?.height === layout?.height &&
    commentsVideoPeekLayout?.offsetTop === layout?.offsetTop
  ) {
    return;
  }
  commentsVideoPeekLayout = layout;
  videoPeekListeners.forEach((listener) => listener(layout));
}

export function getCommentsVideoPeekLayout() {
  return commentsVideoPeekLayout;
}

export function getCommentsOverlayOpen() {
  return commentsOverlayOpen;
}

export function getCommentsOverlayPostId() {
  return commentsOverlayPostId;
}

export function useCommentsOverlayOpen() {
  const [open, setOpen] = useState(commentsOverlayOpen);

  useEffect(() => {
    const listener = (value: boolean) => setOpen(value);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return open;
}

export function useCommentsVideoPeekLayout() {
  const [layout, setLayout] = useState(commentsVideoPeekLayout);

  useEffect(() => {
    const listener = (value: CommentsVideoPeekLayout | null) => setLayout(value);
    videoPeekListeners.add(listener);
    return () => {
      videoPeekListeners.delete(listener);
    };
  }, []);

  return layout;
}
