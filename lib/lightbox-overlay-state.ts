import { useEffect, useState } from "react";

type LightboxOverlayListener = (open: boolean) => void;

let lightboxOverlayOpen = false;
const listeners = new Set<LightboxOverlayListener>();

export function setLightboxOverlayOpen(open: boolean) {
  if (lightboxOverlayOpen === open) return;
  lightboxOverlayOpen = open;
  listeners.forEach((listener) => listener(open));
}

export function getLightboxOverlayOpen() {
  return lightboxOverlayOpen;
}

export function useLightboxOverlayOpen() {
  const [open, setOpen] = useState(lightboxOverlayOpen);

  useEffect(() => {
    const listener = (value: boolean) => setOpen(value);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return open;
}
