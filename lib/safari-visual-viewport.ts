/**
 * Shared iPhone Safari / mobile web visual viewport measurements.
 * Single source for tab scene height, bottom sheet inset, and legacy overlay safe area.
 *
 * @see DESIGN_SYSTEM.md — OVERLAY_BOTTOM_SAFETY_MARGIN_PX (28px design token)
 */

/** Comfortable spacing above home indicator / Safari toolbar (design system). */
export const OVERLAY_BOTTOM_SAFETY_MARGIN_PX = 28;

const ENV_SAFE_AREA_PROBE_ID = "frennix-env-safe-area-probe";

export type SafariVisualViewportSnapshot = {
  layoutHeight: number;
  offsetTop: number;
  visualHeight: number;
  /** Measured gap between layout viewport bottom and visual viewport bottom. */
  bottomChrome: number;
  envSafeAreaBottom: number;
  /** Lift for bottom sheets: env + measured chrome + design breathing room. */
  sheetInset: number;
  overlayTop: number;
  overlayHeight: number;
};

function readEnvSafeAreaBottom(): number {
  if (typeof document === "undefined") return 0;

  let probe = document.getElementById(ENV_SAFE_AREA_PROBE_ID);
  if (!probe) {
    probe = document.createElement("div");
    probe.id = ENV_SAFE_AREA_PROBE_ID;
    probe.style.cssText =
      "position:fixed;bottom:0;left:0;width:0;height:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none;";
    document.body.appendChild(probe);
  }

  const parsed = Number.parseFloat(getComputedStyle(probe).paddingBottom);
  return Number.isFinite(parsed) ? parsed : 0;
}

function measureBottomChrome(): number {
  if (typeof window === "undefined" || !window.visualViewport) return 0;
  const vv = window.visualViewport;
  return Math.max(0, Math.round(window.innerHeight - vv.offsetTop - vv.height));
}

export function isMobileWeb(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /Android|iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isMobileWebSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Chromium/i.test(ua);
  return isIOS && isSafari;
}

/** Read visual viewport + safe area — no hard-coded toolbar floors. */
export function measureSafariVisualViewport(): SafariVisualViewportSnapshot {
  const layoutHeight = typeof window !== "undefined" ? window.innerHeight : 0;
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const envBottom = readEnvSafeAreaBottom();
  const bottomChrome = vv ? measureBottomChrome() : 0;
  const offsetTop = vv ? Math.round(vv.offsetTop) : 0;
  const visualHeight = vv ? Math.round(vv.height) : layoutHeight;
  const sheetInset = envBottom + bottomChrome + OVERLAY_BOTTOM_SAFETY_MARGIN_PX;

  return {
    layoutHeight,
    offsetTop,
    visualHeight,
    bottomChrome,
    envSafeAreaBottom: envBottom,
    sheetInset,
    overlayTop: offsetTop,
    overlayHeight: Math.max(visualHeight, 180),
  };
}

type ViewportListener = () => void;
const viewportListeners = new Set<ViewportListener>();
let viewportSubscribed = false;

function notifyViewportListeners(): void {
  viewportListeners.forEach((listener) => listener());
}

function ensureViewportSubscription(): void {
  if (viewportSubscribed || typeof window === "undefined") return;
  viewportSubscribed = true;

  window.visualViewport?.addEventListener("resize", notifyViewportListeners);
  window.visualViewport?.addEventListener("scroll", notifyViewportListeners);
  window.addEventListener("resize", notifyViewportListeners);
  window.addEventListener("orientationchange", notifyViewportListeners);
}

/** Subscribe to visual viewport changes (single shared listener set). */
export function subscribeSafariVisualViewport(listener: ViewportListener): () => void {
  ensureViewportSubscription();
  viewportListeners.add(listener);
  return () => {
    viewportListeners.delete(listener);
  };
}

/** Call after overlay dismiss to refresh tab scene heights without waiting for resize. */
export function requestSafariVisualViewportRemeasure(): void {
  notifyViewportListeners();
}

const KEYBOARD_DISMISS_TIMEOUT_MS = 180;

/**
 * Wait until Safari releases keyboard / visual-viewport shrink after input blur.
 * Must run before unmounting a focused search input — otherwise body scroll-lock persists.
 */
export function waitForSafariKeyboardDismiss(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const vv = window.visualViewport;
  if (!vv) {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  const baselineHeight = vv.height;
  const baselineOffsetTop = vv.offsetTop;

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      vv.removeEventListener("resize", onViewportChange);
      resolve();
    };

    const onViewportChange = () => {
      const keyboardLikelyClosed =
        vv.height >= baselineHeight - 4 && Math.abs(vv.offsetTop - baselineOffsetTop) < 2;
      if (keyboardLikelyClosed) finish();
    };

    vv.addEventListener("resize", onViewportChange);
    setTimeout(finish, KEYBOARD_DISMISS_TIMEOUT_MS);
  });
}
