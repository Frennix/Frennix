import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { createPortal } from "react-dom";
import { useRootPortalViewport } from "@/lib/use-root-portal-viewport";

type RootPortalOverlayProps = {
  visible: boolean;
  zIndex: number;
  /** DOM attribute name without `data-` prefix, e.g. `frennix-comment-options`. */
  dataAttribute?: string;
  justifyContent?: "flex-end" | "center";
  children: ReactNode;
};

const ROOT_STYLE_BASE: ViewStyle = Platform.select({
  web: {
    position: "fixed",
    left: 0,
    right: 0,
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    touchAction: "none",
  },
  default: {},
}) as ViewStyle;

/**
 * Renders overlay UI at document.body with an explicit z-index so it stacks above
 * other root portals (comments sheet, lightbox, etc.).
 */
export function RootPortalOverlay({
  visible,
  zIndex,
  dataAttribute,
  justifyContent = "flex-end",
  children,
}: RootPortalOverlayProps) {
  const { overlayTop, overlayHeight } = useRootPortalViewport(visible);

  if (!visible || Platform.OS !== "web" || typeof document === "undefined") {
    return null;
  }

  const dataProps = dataAttribute
    ? ({ [`data-${dataAttribute}`]: "true" } as object)
    : null;

  const surface = (
    <View
      style={[
        ROOT_STYLE_BASE,
        {
          top: overlayTop,
          height: overlayHeight,
          zIndex,
          justifyContent,
        } as ViewStyle,
      ]}
      {...dataProps}
    >
      {children}
    </View>
  );

  return createPortal(surface, document.body);
}
