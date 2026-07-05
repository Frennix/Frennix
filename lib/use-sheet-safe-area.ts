import { useEffect, useState } from "react";
import { Platform, type ViewStyle, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "@frennix/ui";
import {
  measureSafariVisualViewport,
  OVERLAY_BOTTOM_SAFETY_MARGIN_PX,
  subscribeSafariVisualViewport,
} from "@/lib/safari-visual-viewport";

export { OVERLAY_BOTTOM_SAFETY_MARGIN_PX };

/** @deprecated Use OVERLAY_BOTTOM_SAFETY_MARGIN_PX */
export const SHEET_BREATHING_ROOM_PX = OVERLAY_BOTTOM_SAFETY_MARGIN_PX;

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

export function useSheetSafeArea(expanded = false, active = true): SheetSafeAreaLayout {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [viewport, setViewport] = useState(() =>
    Platform.OS === "web" ? measureSafariVisualViewport() : null
  );

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || !active) return;

    const update = () => setViewport(measureSafariVisualViewport());
    update();
    return subscribeSafariVisualViewport(update);
  }, [active]);

  if (Platform.OS === "web") {
    const ratio = expanded ? 0.58 : 0.36;
    const snap = viewport ?? measureSafariVisualViewport();
    const lift = active ? snap.sheetInset : spacing.md;
    const available = Math.max(snap.visualHeight - lift - 16, 180);
    const dvhCap = Math.round(ratio * 100);

    return {
      bottomInset: lift,
      sheetMarginBottom: lift,
      contentBottomPadding: spacing.md,
      sheetMaxHeight: `min(${dvhCap}dvh, ${available}px)`,
      webOverlayStyle: active
        ? ({
            position: "fixed",
            top: snap.overlayTop,
            left: 0,
            right: 0,
            width: "100%",
            height: snap.overlayHeight,
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
