import { Platform, useWindowDimensions, type ViewStyle } from "react-native";

/** Tab header + bottom tab bar (conservative for iPhone Safari). */
const WEB_TAB_CHROME_PX = 140;

/**
 * Explicit tab-scene height for RN Web / Safari.
 * Flex-only chains collapse to 0px while scroll content still lays out (scrollHeight > 0).
 */
export function useWebTabSceneHeight(): number | undefined {
  const { height } = useWindowDimensions();
  if (Platform.OS !== "web" || height <= 0) return undefined;
  return Math.max(Math.round(height - WEB_TAB_CHROME_PX), 240);
}

export function webTabSceneHeightStyle(height: number | undefined): ViewStyle {
  if (height == null) return {};
  return {
    height,
    minHeight: height,
    maxHeight: height,
    flexGrow: 0,
    flexShrink: 0,
  };
}
