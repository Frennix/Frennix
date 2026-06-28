import { useContext } from "react";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { Platform, useWindowDimensions, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Stack header content height inside tab scenes (excludes status/safe-area inset). */
const WEB_TAB_HEADER_CONTENT_PX = 56;

function useTabBarChromeHeight(): number {
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  const insets = useSafeAreaInsets();
  if (tabBarHeight != null) return tabBarHeight;
  return insets.bottom;
}

/**
 * Explicit tab-scene height for RN Web / Safari.
 * Flex-only chains collapse to 0px while scroll content still lays out (scrollHeight > 0).
 */
export function useWebTabSceneHeight(): number | undefined {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarChromeHeight();

  if (Platform.OS !== "web" || height <= 0) return undefined;

  const headerHeight = WEB_TAB_HEADER_CONTENT_PX + insets.top;
  const chrome = headerHeight + tabBarHeight;
  return Math.max(Math.round(height - chrome), 240);
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
