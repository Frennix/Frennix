import { Platform, type ViewStyle } from "react-native";

/** Flex child that can shrink and host an internal scroll surface (required on RN Web / Safari). */
export const flexFill: ViewStyle = {
  flex: 1,
  minHeight: 0,
};

/** Vertical scroll lists on web — keeps pan-y on the feed while nested rows use pan-x. */
export const webVerticalScrollStyle: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({
        overflow: "auto",
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-y",
      } as ViewStyle)
    : undefined;

/** Horizontal carousels on web — do not capture vertical pans meant for the feed. */
export const webHorizontalScrollStyle: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({
        touchAction: "pan-x pinch-zoom",
      } as ViewStyle)
    : undefined;
