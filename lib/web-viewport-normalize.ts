import { Platform } from "react-native";

const SCROLL_CONTAINER_IDS = [
  "app-root-shell",
  "feed-tab-scene",
  "feed-root-container",
  "feed-scroll-shell",
  "feed-scroll-list",
  "feed-search-section",
  "feed-search-overlay",
  "discover-scroll",
  "calendar-scroll",
  "messages-scroll",
  "profile-scroll",
] as const;

const SHELL_IDS = ["root", "app-root-shell", "feed-tab-scene"] as const;

/** Clears scroll-lock / keyboard-offset inline styles Safari may leave on html/body. */
export function clearWebBodyScrollLock() {
  if (typeof document === "undefined") return;

  const resetInline = (element: HTMLElement) => {
    element.style.position = "";
    element.style.width = "";
    element.style.height = "";
    element.style.top = "";
    element.style.left = "";
    element.style.right = "";
    element.style.overflow = "";
    element.style.paddingRight = "";
    element.style.marginLeft = "";
    element.style.marginRight = "";
    element.style.transform = "";
  };

  resetInline(document.body);
  resetInline(document.documentElement);
}

/** Resets shared navigation shell geometry so tabs are not offset after stack transitions. */
export function resetNavigationShellStyles() {
  if (typeof document === "undefined") return;

  for (const id of SHELL_IDS) {
    const element = document.getElementById(id);
    if (!element) continue;
    element.style.left = "0px";
    element.style.right = "0px";
    element.style.transform = "none";
    element.style.width = "100%";
    element.style.maxWidth = "100%";
    element.style.marginLeft = "0px";
    element.style.marginRight = "0px";
  }
}

function resetKnownHorizontalScrollOffsets() {
  if (typeof document === "undefined") return;

  window.scrollTo({
    left: 0,
    top: window.scrollY,
    behavior: "auto",
  });

  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;

  for (const id of SCROLL_CONTAINER_IDS) {
    const element = document.getElementById(id);
    if (element && "scrollLeft" in element) {
      (element as HTMLElement).scrollLeft = 0;
    }
  }

  const root = document.getElementById("root");
  if (!root) return;

  root.querySelectorAll<HTMLElement>("*").forEach((node) => {
    if (node.scrollLeft !== 0) {
      node.scrollLeft = 0;
    }
  });
}

/** Full web viewport normalization — document, shell, and nested horizontal scroll offsets. */
export function normalizeWebViewport() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  clearWebBodyScrollLock();
  resetNavigationShellStyles();
  resetKnownHorizontalScrollOffsets();
}

/** Runs normalization after paint/navigation settles without changing vertical scroll. */
export function scheduleWebViewportNormalize() {
  if (Platform.OS !== "web") return;
  normalizeWebViewport();
  requestAnimationFrame(() => {
    normalizeWebViewport();
  });
  setTimeout(() => {
    normalizeWebViewport();
  }, 50);
}

/** @deprecated Prefer normalizeWebViewport */
export const resetDocumentHorizontalScroll = normalizeWebViewport;

/** @deprecated Prefer scheduleWebViewportNormalize */
export const scheduleDocumentHorizontalScrollReset = scheduleWebViewportNormalize;

export function assertNoDocumentOverflow(routeName: string) {
  if (typeof document === "undefined" || process.env.NODE_ENV === "production") return;

  requestAnimationFrame(() => {
    const viewport = document.documentElement.clientWidth;
    const documentWidth = document.documentElement.scrollWidth;

    if (documentWidth <= viewport + 1) return;

    console.error("APP-WIDE HORIZONTAL OVERFLOW", {
      routeName,
      viewport,
      documentWidth,
    });

    document.querySelectorAll("*").forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (rect.right > viewport + 1 || rect.left < -1) {
        console.error("Overflowing element", element, rect);
      }
    });
  });
}
