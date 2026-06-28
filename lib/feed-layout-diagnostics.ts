/** Post-mount feed layout probes — DOM computed styles (web only). */

export type FeedLayoutElementProbe = {
  id: string;
  found: boolean;
  rectH: number;
  rectW: number;
  flex: string;
  minHeight: string;
  height: string;
  display: string;
  visibility: string;
  opacity: string;
  overflow: string;
  backgroundColor: string;
};

export type FeedLayoutOverlayProbe = {
  label: string;
  rectH: number;
  rectW: number;
  zIndex: number;
  opacity: number;
  pointerEvents: string;
  backgroundColor: string;
  display: string;
  coversViewport: boolean;
};

export type FeedLayoutScrollMetrics = {
  clientH: number;
  scrollH: number;
  hasOverflow: boolean;
};

export type FeedLayoutSnapshot = {
  iso: string;
  viewportH: number;
  viewportW: number;
  reactOverlays: string;
  elements: FeedLayoutElementProbe[];
  scrollMetrics: FeedLayoutScrollMetrics | null;
  ancestorChain: string;
  overlays: FeedLayoutOverlayProbe[];
  hiddenModalCount: number;
  surfaces: string;
  issue: string | null;
  summary: string;
};

const FEED_ELEMENT_IDS = [
  "root",
  "feed-root-container",
  "feed-scroll-shell",
  "feed-scroll-list",
] as const;

let latestSnapshot: FeedLayoutSnapshot | null = null;
const listeners = new Set<() => void>();

function readElement(id: string): FeedLayoutElementProbe {
  if (typeof document === "undefined") {
    return {
      id,
      found: false,
      rectH: 0,
      rectW: 0,
      flex: "?",
      minHeight: "?",
      height: "?",
      display: "?",
      visibility: "?",
      opacity: "?",
      overflow: "?",
      backgroundColor: "?",
    };
  }

  const el = document.getElementById(id);
  if (!el) {
    return {
      id,
      found: false,
      rectH: 0,
      rectW: 0,
      flex: "missing",
      minHeight: "missing",
      height: "missing",
      display: "missing",
      visibility: "missing",
      opacity: "missing",
      overflow: "missing",
      backgroundColor: "missing",
    };
  }

  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return {
    id,
    found: true,
    rectH: Math.round(rect.height),
    rectW: Math.round(rect.width),
    flex: style.flex || `${style.flexGrow}/${style.flexShrink}/${style.flexBasis}`,
    minHeight: style.minHeight,
    height: style.height,
    display: style.display,
    visibility: style.visibility,
    opacity: style.opacity,
    overflow: style.overflow,
    backgroundColor: style.backgroundColor,
  };
}

function readAncestorChain(fromId: string): string {
  if (typeof document === "undefined") return "—";
  const start = document.getElementById(fromId);
  if (!start) return `${fromId}:missing`;

  const parts: string[] = [];
  let el: HTMLElement | null = start;
  while (el && el !== document.body) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const label = el.id || el.getAttribute("data-testid") || el.tagName.toLowerCase();
    parts.push(`${label} h=${Math.round(rect.height)} flex=${style.flex || style.flexGrow}`);
    el = el.parentElement;
  }
  return parts.join(" ← ");
}

const APP_SHELL_OVERLAY_IDS = new Set([
  "root",
  "app-root-shell",
  "feed-tab-scene",
  "feed-root-container",
  "feed-scroll-shell",
  "feed-scroll-list",
]);

function isAppShellOverlay(el: Element): boolean {
  const id = (el as HTMLElement).id;
  if (id && APP_SHELL_OVERLAY_IDS.has(id)) return true;

  const feedScroll = document.getElementById("feed-scroll-list");
  if (!feedScroll) return false;
  if (feedScroll === el || feedScroll.contains(el)) return true;
  if (el.contains(feedScroll)) return true;

  return false;
}

function isIgnorableOverlay(el: Element): boolean {
  if (isAppShellOverlay(el)) return true;

  const id = (el as HTMLElement).id;
  if (id === "frennix-emergency-debug" || id === "frennix-emergency-html") return true;

  const style = getComputedStyle(el);
  if (style.pointerEvents === "none") return true;

  // App shell uses the dark background — not a white/transparent blocking sheet.
  if (style.backgroundColor === "rgb(10, 10, 11)") return true;

  return false;
}

function isActionableOverlay(el: Element, viewportW: number, viewportH: number): boolean {
  if (isIgnorableOverlay(el)) return false;

  const style = getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (parseFloat(style.opacity || "1") <= 0.01) return false;

  const rect = el.getBoundingClientRect();
  const coversViewport =
    rect.width >= viewportW * 0.92 &&
    rect.height >= viewportH * 0.85 &&
    rect.top <= viewportH * 0.08;
  if (!coversViewport) return false;

  const role = el.getAttribute("role");
  const ariaModal = el.getAttribute("aria-modal");
  const position = style.position;
  const zIndex = Number.parseInt(style.zIndex || "0", 10) || 0;

  return (
    role === "dialog" ||
    ariaModal === "true" ||
    position === "fixed" ||
    (position === "absolute" && zIndex >= 50) ||
    zIndex >= 1000
  );
}

function scanViewportOverlays(viewportW: number, viewportH: number): FeedLayoutOverlayProbe[] {
  if (typeof document === "undefined") return [];

  const probes: FeedLayoutOverlayProbe[] = [];
  const seen = new Set<Element>();

  document.querySelectorAll('[role="dialog"],[aria-modal="true"]').forEach((el) => {
    if (seen.has(el) || !isActionableOverlay(el, viewportW, viewportH)) return;
    seen.add(el);
    probes.push(readOverlayElement(el, "modal", viewportW, viewportH));
  });

  document.body.querySelectorAll("*").forEach((el) => {
    if (seen.has(el) || !isActionableOverlay(el, viewportW, viewportH)) return;
    seen.add(el);
    probes.push(readOverlayElement(el, "layer", viewportW, viewportH));
  });

  return probes
    .filter((probe) => probe.coversViewport)
    .sort((a, b) => b.zIndex - a.zIndex)
    .slice(0, 6);
}

function readOverlayElement(
  el: Element,
  label: string,
  viewportW: number,
  viewportH: number
): FeedLayoutOverlayProbe {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const id = (el as HTMLElement).id;
  const className = (el as HTMLElement).className;
  const classHint =
    typeof className === "string" && className.length > 0
      ? className.split(/\s+/).slice(0, 2).join(".")
      : "";
  const name = id || classHint || label;

  return {
    label: name,
    rectH: Math.round(rect.height),
    rectW: Math.round(rect.width),
    zIndex: Number.parseInt(style.zIndex || "0", 10) || 0,
    opacity: Number.parseFloat(style.opacity || "1"),
    pointerEvents: style.pointerEvents,
    backgroundColor: style.backgroundColor,
    display: style.display,
    coversViewport:
      rect.width >= viewportW * 0.92 &&
      rect.height >= viewportH * 0.85 &&
      rect.top <= viewportH * 0.08,
  };
}

function readScrollMetrics(): FeedLayoutScrollMetrics | null {
  if (typeof document === "undefined") return null;
  const el = document.getElementById("feed-scroll-list");
  if (!el) return null;
  return {
    clientH: el.clientHeight,
    scrollH: el.scrollHeight,
    hasOverflow: el.scrollHeight > el.clientHeight + 4,
  };
}

function countHiddenModals(): number {
  if (typeof document === "undefined") return 0;
  return document.querySelectorAll('[role="dialog"],[aria-modal="true"]').length;
}

function isTransparentBg(color: string): boolean {
  return (
    color === "transparent" ||
    color === "rgba(0, 0, 0, 0)" ||
    color.includes("255, 255, 255")
  );
}

function readSurfaces(): string {
  if (typeof document === "undefined") return "—";
  const html = getComputedStyle(document.documentElement).backgroundColor;
  const body = getComputedStyle(document.body).backgroundColor;
  const root = document.getElementById("root");
  const rootBg = root ? getComputedStyle(root).backgroundColor : "missing";
  const feed = document.getElementById("feed-root-container");
  const feedBg = feed ? getComputedStyle(feed).backgroundColor : "missing";
  return `html=${html} body=${body} #root=${rootBg} feed=${feedBg}`;
}

function detectIssue(
  elements: FeedLayoutElementProbe[],
  overlays: FeedLayoutOverlayProbe[],
  reactOverlays: Record<string, boolean>,
  scrollMetrics: FeedLayoutScrollMetrics | null,
  hiddenModalCount: number,
  surfaces: string
): string | null {
  const feed = elements.find((el) => el.id === "feed-root-container");
  const scroll = elements.find((el) => el.id === "feed-scroll-list");

  if (feed && !feed.found) {
    return "feed-root-container DOM id missing (nativeID not on page)";
  }
  if (feed && feed.found && feed.rectH <= 1) {
    return "feed-root-container height is 0";
  }
  if (scroll && scroll.found && scroll.rectH <= 1) {
    return "feed-scroll-list height is 0";
  }

  if (
    scroll &&
    scroll.found &&
    scroll.rectH > 80 &&
    scrollMetrics &&
    scrollMetrics.scrollH <= 1
  ) {
    return "scroll viewport has height but scrollHeight is 0 (empty content)";
  }

  const blocking = overlays.find(
    (overlay) =>
      overlay.coversViewport &&
      overlay.opacity > 0.01 &&
      overlay.pointerEvents !== "none" &&
      !APP_SHELL_OVERLAY_IDS.has(overlay.label) &&
      (overlay.backgroundColor.includes("255, 255, 255") ||
        overlay.backgroundColor === "rgba(0, 0, 0, 0)" ||
        overlay.backgroundColor === "transparent")
  );
  if (blocking) {
    return `viewport overlay ${blocking.label} may block feed (bg=${blocking.backgroundColor})`;
  }

  const modalOverlays = overlays.filter(
    (overlay) =>
      overlay.coversViewport &&
      overlay.pointerEvents !== "none" &&
      (overlay.label.startsWith("modal") ||
        overlay.zIndex >= 100 ||
        overlay.backgroundColor.includes("255, 255, 255") ||
        overlay.backgroundColor === "rgba(0, 0, 0, 0)" ||
        overlay.backgroundColor === "transparent")
  );
  const reactClosed = !reactOverlays.share && !reactOverlays.lightbox && !reactOverlays.story;
  if (reactClosed && modalOverlays.length > 0) {
    return `DOM modal/layer present while React overlays closed (${modalOverlays[0]?.label})`;
  }
  if (reactClosed && hiddenModalCount > 0) {
    return `hidden Modal DOM nodes=${hiddenModalCount} while React overlays closed`;
  }

  if (
    feed &&
    feed.found &&
    feed.rectH > 80 &&
    scrollMetrics &&
    scrollMetrics.scrollH > 80 &&
    surfaces.includes("body=rgba(0, 0, 0, 0)") &&
    isTransparentBg(surfaces.match(/feed=([^ ]+)/)?.[1] ?? "")
  ) {
    return "content may be painted but surfaces are transparent/white";
  }

  return null;
}

function formatElementLine(probe: FeedLayoutElementProbe): string {
  if (!probe.found) return `${probe.id}=missing`;
  return `${probe.id} ${probe.rectH}x${probe.rectW} flex=${probe.flex} minH=${probe.minHeight} vis=${probe.visibility}`;
}

export function sampleFeedLayout(reactOverlays: Record<string, boolean> = {}): FeedLayoutSnapshot {
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 0;
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 0;
  const elements = FEED_ELEMENT_IDS.map(readElement);
  const scrollMetrics = readScrollMetrics();
  const overlays = scanViewportOverlays(viewportW, viewportH);
  const hiddenModalCount = countHiddenModals();
  const ancestorChain = readAncestorChain("feed-root-container");
  const surfaces = readSurfaces();
  const reactOverlayLine = `share=${reactOverlays.share ? 1 : 0} lightbox=${reactOverlays.lightbox ? 1 : 0} story=${reactOverlays.story ? 1 : 0}`;
  const issue = detectIssue(
    elements,
    overlays,
    reactOverlays,
    scrollMetrics,
    hiddenModalCount,
    surfaces
  );

  const overlayLine =
    overlays.length === 0
      ? "overlays=none"
      : overlays
          .map(
            (overlay) =>
              `${overlay.label} ${overlay.rectH}x${overlay.rectW} z=${overlay.zIndex} op=${overlay.opacity.toFixed(2)} bg=${overlay.backgroundColor}`
          )
          .join(" | ");

  const scrollLine = scrollMetrics
    ? `scroll clientH=${scrollMetrics.clientH} scrollH=${scrollMetrics.scrollH} overflow=${scrollMetrics.hasOverflow ? 1 : 0}`
    : "scroll=missing";

  const summary = [
    issue ? `LAYOUT ISSUE: ${issue}` : "LAYOUT: no zero-height or blocking overlay detected",
    elements.map(formatElementLine).join(" | "),
    scrollLine,
    `reactOverlays ${reactOverlayLine}`,
    `hiddenModals=${hiddenModalCount}`,
    overlayLine,
    surfaces,
  ].join("\n");

  const snapshot: FeedLayoutSnapshot = {
    iso: new Date().toISOString(),
    viewportH,
    viewportW,
    reactOverlays: reactOverlayLine,
    elements,
    scrollMetrics,
    ancestorChain,
    overlays,
    hiddenModalCount,
    surfaces,
    issue,
    summary,
  };

  latestSnapshot = snapshot;
  listeners.forEach((listener) => listener());
  publishToWindow(snapshot);
  return snapshot;
}

function publishToWindow(snapshot: FeedLayoutSnapshot) {
  if (typeof window === "undefined") return;
  (window as Window & { __FRENNIX_FEED_LAYOUT__?: FeedLayoutSnapshot }).__FRENNIX_FEED_LAYOUT__ =
    snapshot;
}

export function getFeedLayoutSnapshot(): FeedLayoutSnapshot | null {
  return latestSnapshot;
}

export function formatFeedLayoutBanner(snapshot: FeedLayoutSnapshot | null): string {
  if (!snapshot) return "Layout: not sampled yet";
  const root = snapshot.elements.find((el) => el.id === "root");
  const shell = snapshot.elements.find((el) => el.id === "feed-scroll-shell");
  const feed = snapshot.elements.find((el) => el.id === "feed-root-container");
  const scroll = snapshot.elements.find((el) => el.id === "feed-scroll-list");
  const rootH = root?.found ? root.rectH : -1;
  const shellH = shell?.found ? shell.rectH : -1;
  const feedH = feed?.found ? feed.rectH : -1;
  const scrollH = scroll?.found ? scroll.rectH : -1;
  const overlayCount = snapshot.overlays.length;
  const flexLine = [root, shell, feed, scroll]
    .filter((probe): probe is FeedLayoutElementProbe => Boolean(probe?.found))
    .map((probe) => `${probe.id.split("-").pop()} flex=${probe.flex} minH=${probe.minHeight}`)
    .join(" | ");
  const scrollMetrics = snapshot.scrollMetrics;
  const contentH = scrollMetrics ? scrollMetrics.scrollH : -1;
  const clientH = scrollMetrics ? scrollMetrics.clientH : -1;

  return [
    snapshot.issue ? `Layout ISSUE: ${snapshot.issue}` : "Layout: sampled (check heights below)",
    `rootH=${rootH} shellH=${shellH} feedH=${feedH} scrollH=${scrollH} contentH=${contentH} clientH=${clientH} vp=${snapshot.viewportH}`,
    flexLine,
    snapshot.reactOverlays,
    `hiddenModals=${snapshot.hiddenModalCount}`,
    overlayCount ? `DOM overlays(${overlayCount}): ${snapshot.overlays.map((o) => o.label).join(",")}` : "DOM overlays: none",
    snapshot.ancestorChain.slice(0, 160),
  ].join(" | ");
}

export function subscribeFeedLayout(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
