import { Platform, type ViewStyle } from "react-native";

/**
 * Resilient flex tab-scene styles for RN Web.
 * Document CSS (#feed-tab-scene min-height) prevents WebKit 0px collapse — no JS pixel heights.
 */
export const webTabSceneResilientShell: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({
        flex: 1,
        width: "100%",
        minHeight: 0,
        flexBasis: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      } as ViewStyle)
    : undefined;

/** Flex wrapper inside a tab scene — defers min-height to document CSS on nativeID shells. */
export function webTabSceneContainerStyle(): ViewStyle {
  if (Platform.OS !== "web") return {};
  return {
    flex: 1,
    minHeight: 0,
    flexBasis: 0,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    alignSelf: "stretch",
    overflow: "hidden",
  };
}

/** Scroll/list surface inside a bounded tab scene (web). */
export function webTabSceneScrollStyle(): ViewStyle {
  if (Platform.OS !== "web") return {};
  return {
    flex: 1,
    minHeight: 0,
    flexBasis: 0,
    width: "100%",
  };
}

/** @deprecated Layout uses document CSS + flex — kept for call-site compatibility. */
export function webTabSceneHeightStyle(_height?: number): ViewStyle {
  return webTabSceneScrollStyle();
}

/** @deprecated Layout uses document CSS — no runtime viewport height for shells. */
export function useWebTabSceneHeight(): undefined {
  return undefined;
}

/** @deprecated Layout uses document CSS. */
export function measureWebTabSceneHeightNow(): number {
  return 0;
}

export { requestSafariVisualViewportRemeasure } from "@/lib/safari-visual-viewport";
