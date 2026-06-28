import { type ViewStyle } from "react-native";
import { colors } from "@frennix/ui";
import { flexFill, webScrollSurface, webTabSceneShell } from "@/lib/flex-layout";
import { useWebTabSceneHeight, webTabSceneHeightStyle } from "@/lib/web-tab-scene-layout";

/** Pull-to-refresh chrome — avoids Android white progress disk. */
export const frennixRefreshControlProps = {
  tintColor: colors.accent,
  colors: [colors.accent],
  progressBackgroundColor: colors.surface,
} as const;

/** Full-screen tab scene wrapper (native + Safari web). */
export const tabScreenContainer: ViewStyle = {
  ...flexFill,
  ...webTabSceneShell,
  backgroundColor: colors.background,
};

/** Scroll/list surface inside a tab scene on Safari web. */
export const tabScreenScrollSurface: ViewStyle = {
  ...flexFill,
  ...webScrollSurface,
};

export function useTabScreenWebHeightStyle(): ViewStyle {
  return webTabSceneHeightStyle(useWebTabSceneHeight());
}
