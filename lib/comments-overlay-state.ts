import { useEffect, useState } from "react";

type CommentsOverlayListener = (open: boolean) => void;
type CommentsVideoPeekListener = (height: number | null) => void;

let commentsOverlayOpen = false;
let commentsOverlayPostId: string | null = null;
let commentsVideoPeekHeight: number | null = null;
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
    setCommentsVideoPeekHeight(null);
  }
  syncCommentsOverlayDocumentState();
  listeners.forEach((listener) => listener(open));
}

export function setCommentsVideoPeekHeight(height: number | null) {
  if (commentsVideoPeekHeight === height) return;
  commentsVideoPeekHeight = height;
  videoPeekListeners.forEach((listener) => listener(height));
}

export function getCommentsVideoPeekHeight() {
  return commentsVideoPeekHeight;
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

export function useCommentsVideoPeekHeight() {
  const [height, setHeight] = useState(commentsVideoPeekHeight);

  useEffect(() => {
    const listener = (value: number | null) => setHeight(value);
    videoPeekListeners.add(listener);
    return () => {
      videoPeekListeners.delete(listener);
    };
  }, []);

  return height;
}
