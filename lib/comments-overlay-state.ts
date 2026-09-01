import { useEffect, useState } from "react";

type CommentsOverlayListener = (open: boolean) => void;

let commentsOverlayOpen = false;
const listeners = new Set<CommentsOverlayListener>();

export function setCommentsOverlayOpen(open: boolean) {
  if (commentsOverlayOpen === open) return;
  commentsOverlayOpen = open;
  listeners.forEach((listener) => listener(open));
}

export function getCommentsOverlayOpen() {
  return commentsOverlayOpen;
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
