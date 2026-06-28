import { Platform, type ViewStyle } from "react-native";

/** Flex child that can shrink and host an internal scroll surface (required on RN Web / Safari). */
export const flexFill: ViewStyle = {
  flex: 1,
  minHeight: 0,
  ...(Platform.OS === "web" ? ({ flexBasis: 0 } as ViewStyle) : null),
};

/** Root → stack shell on web. Body/#root must also be flex column (see patch-web-html.js). */
export const webAppShell: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({
        flex: 1,
        width: "100%",
        height: "100%",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0A0A0B",
      } as ViewStyle)
    : undefined;

/** Tab scene / screen wrapper — clips and passes height to scroll child on Safari. */
export const webTabSceneShell: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({
        flex: 1,
        width: "100%",
        height: "100%",
        minHeight: 0,
        flexBasis: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0A0A0B",
      } as ViewStyle)
    : undefined;

/** Scroll viewport on web — must have bounded height from parent chain. */
export const webScrollSurface: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({
        flex: 1,
        width: "100%",
        height: "100%",
        minHeight: 0,
        flexBasis: 0,
        overflow: "auto",
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-y",
      } as ViewStyle)
    : undefined;

/** @deprecated Prefer webScrollSurface for feed scroll views. */
export const webVerticalScrollStyle: ViewStyle | undefined = webScrollSurface;

/** Horizontal carousels on web — do not capture vertical pans meant for the feed. */
export const webHorizontalScrollStyle: ViewStyle | undefined =
  Platform.OS === "web"
    ? ({
        touchAction: "pan-x pinch-zoom",
      } as ViewStyle)
    : undefined;
