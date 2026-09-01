import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { subscribeSafariVisualViewport } from "@/lib/safari-visual-viewport";

/** Single geometry owner for the comments modal — visual viewport only, applied once at root. */
export type CommentsModalViewportGeometry = {
  viewportTop: number;
  viewportHeight: number;
  viewportBottom: number;
  layoutHeight: number;
  bottomChrome: number;
  keyboardOpen: boolean;
  envSafeAreaBottom: number;
};

function readCommentsModalViewportGeometry(): CommentsModalViewportGeometry {
  if (typeof window === "undefined") {
    return {
      viewportTop: 0,
      viewportHeight: 640,
      viewportBottom: 640,
      layoutHeight: 640,
      bottomChrome: 0,
      keyboardOpen: false,
      envSafeAreaBottom: 0,
    };
  }

  const vv = window.visualViewport;
  const viewportTop = Math.round(vv?.offsetTop ?? 0);
  const viewportHeight = Math.round(vv?.height ?? window.innerHeight);
  const layoutHeight = window.innerHeight;
  const bottomChrome = Math.max(0, Math.round(layoutHeight - viewportTop - viewportHeight));

  return {
    viewportTop,
    viewportHeight,
    viewportBottom: viewportTop + viewportHeight,
    layoutHeight,
    bottomChrome,
    keyboardOpen: bottomChrome > 0,
    envSafeAreaBottom: 0,
  };
}

/** Active while the comments sheet is open — tracks resize + scroll on visualViewport. */
export function useCommentsModalViewportGeometry(visible: boolean): CommentsModalViewportGeometry {
  const [geometry, setGeometry] = useState(readCommentsModalViewportGeometry);

  useEffect(() => {
    if (!visible || Platform.OS !== "web" || typeof window === "undefined") return;

    const update = () => {
      setGeometry((prev) => {
        const next = readCommentsModalViewportGeometry();
        if (
          prev.viewportTop === next.viewportTop &&
          prev.viewportHeight === next.viewportHeight &&
          prev.bottomChrome === next.bottomChrome
        ) {
          return prev;
        }
        return next;
      });
    };

    update();
    return subscribeSafariVisualViewport(update);
  }, [visible]);

  return geometry;
}

export function computeClosedCommentsSheetHeight(baselineVisualHeight: number): number {
  const target = Math.round(baselineVisualHeight * 0.7);
  const max = Math.round(baselineVisualHeight * 0.75);
  return Math.min(Math.max(target, 280), max);
}
