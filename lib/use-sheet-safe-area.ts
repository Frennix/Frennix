import { useEffect, useState } from "react";
import { Platform, type ViewStyle, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "@frennix/ui";

/** Comfortable gap above home indicator / Safari toolbar (24–32px target). */
export const OVERLAY_BOTTOM_SAFETY_MARGIN_PX = 28;

/** @deprecated Use OVERLAY_BOTTOM_SAFETY_MARGIN_PX */
export const SHEET_BREATHING_ROOM_PX = OVERLAY_BOTTOM_SAFETY_MARGIN_PX;

/** Conservative fallback when visualViewport under-reports iOS Safari bottom chrome. */
const IOS_SAFARI_MIN_TOOLBAR_PX = 50;

const WEB_SAFE_AREA_PROBE_ID = "frennix-safe-area-bottom-probe";

function readCssSafeAreaBottom(): number {
  if (typeof document === "undefined") return 0;

  let probe = document.getElementById(WEB_SAFE_AREA_PROBE_ID);
  if (!probe) {
    probe = document.createElement("div");
    probe.id = WEB_SAFE_AREA_PROBE_ID;
    probe.style.cssText =
      "position:fixed;bottom:0;left:0;width:0;height:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none;";
    document.body.appendChild(probe);
  }

  const parsed = Number.parseFloat(getComputedStyle(probe).paddingBottom);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMobileWebSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Chromium/i.test(ua);
  return isIOS && isSafari;
}

/** Space between layout viewport bottom and visual viewport bottom (Safari toolbar). */
function readVisualViewportBottomChrome(): number {
  if (typeof window === "undefined" || !window.visualViewport) return 0;
  const vv = window.visualViewport;
  const gap = window.innerHeight - vv.offsetTop - vv.height;
  return Math.max(0, Math.round(gap));
}

export type SheetSafeAreaLayout = {
  /** Total lift below sheet (marginBottom) — env + toolbar + breathing room. */
  bottomInset: number;
  sheetMarginBottom: number;
  /** Padding inside sheet below scroll content. */
  contentBottomPadding: number;
  /** Max height for bottom sheet body. */
  sheetMaxHeight: number | string;
  /** Pin modal overlay to visual viewport on web (above Safari toolbar). */
  webOverlayStyle: ViewStyle | null;
};

type WebViewportState = {
  top: number;
  height: number;
  sheetLift: number;
};

function measureWebViewport(): WebViewportState {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const layoutHeight = typeof window !== "undefined" ? window.innerHeight : 0;
  const envBottom = readCssSafeAreaBottom();
  const toolbarChrome = readVisualViewportBottomChrome();
  const safariFloor = isMobileWebSafari() ? IOS_SAFARI_MIN_TOOLBAR_PX : 0;
  const trustVisualViewport = Boolean(vv) && toolbarChrome >= 12;

  const sheetLift = trustVisualViewport
    ? envBottom + OVERLAY_BOTTOM_SAFETY_MARGIN_PX
    : envBottom + Math.max(toolbarChrome, safariFloor) + OVERLAY_BOTTOM_SAFETY_MARGIN_PX;

  if (vv && trustVisualViewport) {
    return {
      top: Math.round(vv.offsetTop),
      height: Math.round(vv.height),
      sheetLift,
    };
  }

  return {
    top: 0,
    height: layoutHeight,
    sheetLift,
  };
}

export function useSheetSafeArea(expanded = false, active = true): SheetSafeAreaLayout {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [webViewport, setWebViewport] = useState<WebViewportState>(() =>
    Platform.OS === "web" ? measureWebViewport() : { top: 0, height: 0, sheetLift: spacing.md }
  );

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !active) return;

    const update = () => setWebViewport(measureWebViewport());

    update();
    let rafId = 0;
    const onFrame = () => {
      update();
      rafId = requestAnimationFrame(onFrame);
    };
    rafId = requestAnimationFrame(onFrame);

    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.addEventListener("scroll", update, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("scroll", update);
    };
  }, [active]);

  if (Platform.OS === "web") {
    const ratio = expanded ? 0.58 : 0.36;
    const lift = active ? webViewport.sheetLift : spacing.md;
    const available = Math.max(webViewport.height - lift - 16, 180);
    const dvhCap = Math.round(ratio * 100);

    return {
      bottomInset: lift,
      sheetMarginBottom: lift,
      contentBottomPadding: spacing.md,
      sheetMaxHeight: `min(${dvhCap}dvh, ${available}px)`,
      webOverlayStyle: active
        ? ({
            position: "fixed",
            top: webViewport.top,
            left: 0,
            right: 0,
            width: "100%",
            height: webViewport.height,
            justifyContent: "flex-end",
          } as ViewStyle)
        : null,
    };
  }

  const sheetLift = Math.max(insets.bottom, spacing.sm) + OVERLAY_BOTTOM_SAFETY_MARGIN_PX;
  const ratio = expanded ? 0.58 : 0.36;

  return {
    bottomInset: sheetLift,
    sheetMarginBottom: sheetLift,
    contentBottomPadding: spacing.md,
    sheetMaxHeight: windowHeight * ratio,
    webOverlayStyle: null,
  };
}
