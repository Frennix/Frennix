import { Platform } from "react-native";
import { safePathname } from "@/lib/safe-pathname";
import { isDomElementVisuallyReady } from "@/lib/authenticated-feed-visibility";

export type AuthRouteHandoffMetrics = {
  pathname: string;
  href: string;
  segments: string[];
  windowPathname: string;
  atBootstrapIndex: boolean;
  tabsSegmentActive: boolean;
  indexRouteMounted: boolean;
  tabsLayoutMounted: boolean;
  feedRouteMounted: boolean;
  rootChildCount: number;
  rootChildTag: string | null;
  rootChildId: string | null;
  rootChildClass: string | null;
  rootChildRect: { width: number; height: number; top: number; left: number };
  rootChildDisplay: string;
  rootChildVisibility: string;
  rootChildOpacity: number;
  rootChildPosition: string;
  tabsLayoutRect: { width: number; height: number };
  feedRootRect: { width: number; height: number };
  feedTabRect: { width: number; height: number };
  feedRootConnected: boolean;
  feedRootNonzero: boolean;
  feedTabNonzero: boolean;
  rootTextLength: number;
  bodyTextPreview: string;
};

function rectOf(id: string) {
  if (typeof document === "undefined") {
    return { width: 0, height: 0, top: 0, left: 0 };
  }
  const el = document.getElementById(id);
  if (!el) return { width: 0, height: 0, top: 0, left: 0 };
  const rect = el.getBoundingClientRect();
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    top: Math.round(rect.top),
    left: Math.round(rect.left),
  };
}

function elementStyle(id: string) {
  if (typeof document === "undefined") {
    return { display: "native", visibility: "visible", opacity: 1, position: "static" };
  }
  const el = document.getElementById(id);
  if (!el) {
    return { display: "missing", visibility: "missing", opacity: 0, position: "missing" };
  }
  const style = getComputedStyle(el);
  return {
    display: style.display,
    visibility: style.visibility,
    opacity: Number(style.opacity),
    position: style.position,
  };
}

export function isBootstrapIndexRoute(pathname: string, segments: readonly string[]): boolean {
  const path = safePathname(pathname);
  const root = segments[0];
  return path === "/" || path === "" || root === "index" || segments.length === 0;
}

export function isTabsRouteActive(segments: readonly string[]): boolean {
  return segments[0] === "(tabs)" || segments.includes("(tabs)");
}

export function collectAuthRouteHandoffMetrics(input: {
  pathname?: string | null;
  segments?: readonly string[];
  mountTrace?: readonly string[];
}): AuthRouteHandoffMetrics {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return {
      pathname: safePathname(input.pathname),
      href: "",
      segments: [...(input.segments ?? [])],
      windowPathname: "",
      atBootstrapIndex: false,
      tabsSegmentActive: false,
      indexRouteMounted: false,
      tabsLayoutMounted: false,
      feedRouteMounted: false,
      rootChildCount: 0,
      rootChildTag: null,
      rootChildId: null,
      rootChildClass: null,
      rootChildRect: { width: 0, height: 0, top: 0, left: 0 },
      rootChildDisplay: "native",
      rootChildVisibility: "visible",
      rootChildOpacity: 1,
      rootChildPosition: "static",
      tabsLayoutRect: { width: 0, height: 0 },
      feedRootRect: { width: 0, height: 0 },
      feedTabRect: { width: 0, height: 0 },
      feedRootConnected: false,
      feedRootNonzero: false,
      feedTabNonzero: false,
      rootTextLength: 0,
      bodyTextPreview: "",
    };
  }

  const pathname = safePathname(input.pathname ?? window.location.pathname);
  const segments = [...(input.segments ?? [])];
  const trace = input.mountTrace ?? [];
  const root = document.getElementById("root");
  const rootChild = root?.firstElementChild ?? null;
  const rootChildRect = rootChild?.getBoundingClientRect();
  const rootChildStyle = rootChild ? getComputedStyle(rootChild) : null;
  const feedRoot = document.getElementById("feed-root-container");
  const feedTabRect = rectOf("feed-tab-scene");
  const feedRootRect = rectOf("feed-root-container");
  const tabsLayoutRect = rectOf("feed-tab-scene");
  const bodyText = document.body.innerText.replace(/\s+/g, " ").trim();

  return {
    pathname,
    href: window.location.href,
    segments,
    windowPathname: window.location.pathname,
    atBootstrapIndex: isBootstrapIndexRoute(pathname, segments),
    tabsSegmentActive: isTabsRouteActive(segments),
    indexRouteMounted: trace.includes("index-route:mounted"),
    tabsLayoutMounted: trace.includes("tabs-layout:mounted"),
    feedRouteMounted: trace.includes("feed-route:mounted"),
    rootChildCount: root?.childElementCount ?? 0,
    rootChildTag: rootChild?.tagName?.toLowerCase() ?? null,
    rootChildId: rootChild?.id || rootChild?.getAttribute("nativeid") || null,
    rootChildClass: rootChild?.className?.toString().slice(0, 120) ?? null,
    rootChildRect: {
      width: Math.round(rootChildRect?.width ?? 0),
      height: Math.round(rootChildRect?.height ?? 0),
      top: Math.round(rootChildRect?.top ?? 0),
      left: Math.round(rootChildRect?.left ?? 0),
    },
    rootChildDisplay: rootChildStyle?.display ?? "missing",
    rootChildVisibility: rootChildStyle?.visibility ?? "missing",
    rootChildOpacity: rootChildStyle ? Number(rootChildStyle.opacity) : 0,
    rootChildPosition: rootChildStyle?.position ?? "missing",
    tabsLayoutRect: { width: tabsLayoutRect.width, height: tabsLayoutRect.height },
    feedRootRect: { width: feedRootRect.width, height: feedRootRect.height },
    feedTabRect: { width: feedTabRect.width, height: feedTabRect.height },
    feedRootConnected: Boolean(feedRoot?.isConnected),
    feedRootNonzero: isDomElementVisuallyReady("feed-root-container", 40),
    feedTabNonzero: isDomElementVisuallyReady("feed-tab-scene", 40),
    rootTextLength: root?.innerText?.length ?? 0,
    bodyTextPreview: bodyText.slice(0, 160),
  };
}

export function isAuthenticatedHandoffStalled(
  metrics: AuthRouteHandoffMetrics,
  input: { authReady: boolean; hasSession: boolean; hasProfile: boolean }
): boolean {
  if (!input.authReady || !input.hasSession || !input.hasProfile) return false;
  if (metrics.feedTabNonzero || metrics.feedRootNonzero) return false;
  if (metrics.bodyTextPreview.length >= 20) return false;
  return (
    metrics.atBootstrapIndex ||
    (!metrics.tabsSegmentActive && metrics.indexRouteMounted && !metrics.tabsLayoutMounted)
  );
}
