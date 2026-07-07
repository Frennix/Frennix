import { Platform } from "react-native";

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

/** True when Frennix is opened from Home Screen (iOS) or installed PWA. */
export function isWebStandalone(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;

  const nav = navigator as NavigatorWithStandalone;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean(nav.standalone)
  );
}

/** iOS Safari in a browser tab (not Chrome iOS, not standalone). */
export function isIosSafariBrowser(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;

  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && isSafari;
}

export function isWebPushEnvironmentReady(): boolean {
  return Platform.OS === "web" && isWebStandalone();
}

export function shouldShowIosPwaInstallGuide(): boolean {
  return Platform.OS === "web" && isIosSafariBrowser() && !isWebStandalone();
}

/** @deprecated Use isWebPushFeatureEnabled() — gated by web_push_notifications flag. */
export const WEB_PUSH_ENABLED = false;
