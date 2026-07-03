import { Platform, useWindowDimensions, type ViewStyle } from "react-native";

/**
 * Tab header + bottom tab bar (conservative for iPhone Safari).
 *
 * Do NOT derive this from BottomTabBarHeightContext or useSafeAreaInsets on web.
 * v1.0.0 tried dynamic chrome (56 + insets.top + tabBarHeight) and caused a
 * post-login black screen on iPhone Safari: context can be 0 or missing while
 * the fallback used only insets.bottom (~34px), under-counting tab bar chrome
 * and collapsing the feed flex chain under overflow:hidden parents.
 */
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
