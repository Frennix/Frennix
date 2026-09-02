/**
 * Shared iPhone Safari / mobile web visual viewport measurements.
 * Single source for tab scene height, bottom sheet inset, and legacy overlay safe area.
 *
 * @see DESIGN_SYSTEM.md — OVERLAY_BOTTOM_SAFETY_MARGIN_PX (28px design token)
 */

/** Comfortable spacing above home indicator / Safari toolbar (design system). */
export const OVERLAY_BOTTOM_SAFETY_MARGIN_PX = 28;

/** @deprecated No longer used for overlay reserve — accessory lift uses measured composerHost height. */
export const SAFARI_COMMENT_COMPOSER_ACCESSORY_FALLBACK_PX = 44;

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

/** True when Safari's visual viewport is reduced by the on-screen keyboard or bottom chrome. */
export function isVisualViewportKeyboardOpen(
  snapshot: SafariVisualViewportSnapshot = measureSafariVisualViewport()
): boolean {
  return snapshot.bottomChrome > 0;
}

function isCommentComposerTextareaFocused(): boolean {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  return active.matches('textarea[data-frennix-comment-input="true"]');
}

/** visualViewport.height while keyboard is open and the comment textarea is not focused. */
let keyboardOpenUnfocusedVisualHeight: number | null = null;
/** visualViewport.height at the start of a comment textarea focus transition. */
let focusTransitionStartVisualHeight: number | null = null;

function resetSafariFloatingChromeBaseline(): void {
  keyboardOpenUnfocusedVisualHeight = null;
  focusTransitionStartVisualHeight = null;
}

function updateSafariFloatingChromeBaseline(snapshot: SafariVisualViewportSnapshot): void {
  const keyboardOpen = isVisualViewportKeyboardOpen(snapshot);
  const focused = isCommentComposerTextareaFocused();

  if (!keyboardOpen) {
    resetSafariFloatingChromeBaseline();
    return;
  }

  if (!focused) {
    focusTransitionStartVisualHeight = null;
    keyboardOpenUnfocusedVisualHeight = Math.max(
      keyboardOpenUnfocusedVisualHeight ?? snapshot.visualHeight,
      snapshot.visualHeight
    );
    return;
  }

  if (focusTransitionStartVisualHeight == null) {
    focusTransitionStartVisualHeight =
      keyboardOpenUnfocusedVisualHeight ?? snapshot.visualHeight;
  }
}

/**
 * Safari floating chrome band depth (px) above the keyboard — not the full composer height.
 * Measured from host overflow past visibleBottom and visualViewport shrink on textarea focus.
 */
function readSafariFloatingChromeBandPx(
  snapshot: SafariVisualViewportSnapshot,
  hostBottom: number,
  visibleBottom: number
): number {
  updateSafariFloatingChromeBaseline(snapshot);

  const explicitOverflow = Math.max(0, Math.ceil(hostBottom - visibleBottom));

  let focusShrinkBand = 0;
  if (focusTransitionStartVisualHeight != null) {
    focusShrinkBand = Math.max(0, focusTransitionStartVisualHeight - snapshot.visualHeight);
  } else if (keyboardOpenUnfocusedVisualHeight != null) {
    focusShrinkBand = Math.max(0, keyboardOpenUnfocusedVisualHeight - snapshot.visualHeight);
  }

  return Math.max(explicitOverflow, focusShrinkBand);
}

/** Sum of flex siblings above composerHost inside the comments overlay column. */
function readCommentsOverlayHeaderHeightPx(): number {
  if (typeof document === "undefined") return 0;

  const host = document.querySelector('[data-frennix-comment-composer-host="true"]');
  if (!(host instanceof HTMLElement) || !(host.parentElement instanceof HTMLElement)) {
    return 0;
  }

  let headerTotal = 0;
  for (const child of host.parentElement.children) {
    if (child === host) break;
    if (child instanceof HTMLElement) {
      headerTotal += child.getBoundingClientRect().height;
    }
  }

  return Math.ceil(headerTotal);
}

/**
 * Pixels to subtract from comments overlay height so the full composer sits above
 * Safari bottom toolbar / InputAccessoryView.
 */
export function readSafariCommentsOverlayBottomReserve(appliedReserve = 0): number {
  if (typeof window === "undefined" || !window.visualViewport || !isMobileWebSafari()) {
    return 0;
  }

  const snapshot = measureSafariVisualViewport();
  const visibleBottom = snapshot.offsetTop + snapshot.visualHeight;
  const keyboardOpen = isVisualViewportKeyboardOpen(snapshot);
  const focused = isCommentComposerTextareaFocused();

  const host = document.querySelector('[data-frennix-comment-composer-host="true"]');
  if (!(host instanceof HTMLElement)) {
    if (keyboardOpen && focused) {
      return 0;
    }
    return keyboardOpen ? 0 : snapshot.bottomChrome;
  }

  const hostRect = host.getBoundingClientRect();
  const hostHeight = Math.ceil(hostRect.height);
  const hostBottom = hostRect.bottom;
  const hostOverflow = Math.max(0, Math.ceil(hostBottom - visibleBottom));

  if (keyboardOpen && focused) {
    const floatingChromeBand = readSafariFloatingChromeBandPx(snapshot, hostBottom, visibleBottom);
    const overlayBottom = visibleBottom - appliedReserve;
    const hostPastOverlayBottom = Math.max(0, Math.ceil(hostBottom - overlayBottom));
    let reserve = Math.max(floatingChromeBand, hostPastOverlayBottom);

    const headerHeight = readCommentsOverlayHeaderHeightPx();
    const minOverlayHeight = headerHeight + hostHeight;
    const maxReserve = Math.max(0, snapshot.visualHeight - minOverlayHeight);
    reserve = Math.min(reserve, maxReserve);

    return reserve;
  }

  if (!keyboardOpen) {
    return snapshot.bottomChrome + hostOverflow;
  }

  return hostOverflow;
}

/** @deprecated Prefer readSafariCommentsOverlayBottomReserve — reserve at overlay root, not host padding. */
export function readSafariCommentComposerAccessoryLiftPx(): number {
  return readSafariCommentsOverlayBottomReserve();
}

/** Height of the visual viewport — used for full-screen mobile web overlays (no offsetTop). */
export function readVisualViewportHeight(): number {
  if (typeof window === "undefined") return 640;
  const vv = window.visualViewport;
  return vv ? Math.max(Math.round(vv.height), 180) : window.innerHeight;
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
