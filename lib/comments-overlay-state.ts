import { useEffect, useState } from "react";

type CommentsOverlayListener = (open: boolean) => void;

let commentsOverlayOpen = false;
let commentsOverlayPostId: string | null = null;
const listeners = new Set<CommentsOverlayListener>();

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
  syncCommentsOverlayDocumentState();
  listeners.forEach((listener) => listener(open));
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
