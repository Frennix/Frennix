import { type ViewStyle } from "react-native";
import { colors } from "@frennix/ui";
import { flexFill, webScrollSurface, webTabSceneShell } from "@/lib/flex-layout";
import { webTabSceneContainerStyle, webTabSceneScrollStyle } from "@/lib/web-tab-scene-layout";

/** Pull-to-refresh chrome — avoids Android white progress disk. */
export const frennixRefreshControlProps = {
  tintColor: colors.accent,
  colors: [colors.accent],
  progressBackgroundColor: colors.surface,
} as const;

/** Full-screen tab scene wrapper (native + web). Document CSS pins min-height on web. */
export const tabScreenContainer: ViewStyle = {
  ...flexFill,
  ...webTabSceneShell,
  backgroundColor: colors.background,
};

/** Scroll/list surface inside a tab scene on web. */
export const tabScreenScrollSurface: ViewStyle = {
  ...flexFill,
  ...webScrollSurface,
};

/** @deprecated Use tabScreenScrollSurface — document CSS bounds scroll height. */
export function useTabScreenWebHeightStyle(): ViewStyle {
  return { ...tabScreenScrollSurface, ...webTabSceneScrollStyle() };
}

/** Flex wrapper for tab screens on web. */
export function useTabScreenWebContainerStyle(): ViewStyle {
  return webTabSceneContainerStyle();
}
