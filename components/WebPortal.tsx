import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Platform, View, type ViewStyle } from "react-native";
import { createPortal } from "react-dom";

type WebPortalProps = {
  children: ReactNode;
  hostId?: string;
};

/** Renders children into a top-level DOM host on web so overlays do not affect tab layout width. */
export function WebPortal({ children, hostId = "root" }: WebPortalProps) {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    setHost(document.getElementById(hostId) ?? document.body);
  }, [hostId]);

  if (Platform.OS !== "web" || !host) return null;
  return createPortal(children, host);
}

/** Fixed overlay host appended directly under #root on web. */
export function WebOverlayPortal({ children }: { children: ReactNode }) {
  return <WebPortal hostId="root">{children}</WebPortal>;
}

const hostStyle: ViewStyle =
  Platform.OS === "web"
    ? ({
        position: "fixed",
        inset: 0,
        width: "100%",
        maxWidth: "100%",
        height: "100dvh",
        pointerEvents: "box-none",
        zIndex: 9998,
        overflow: "hidden",
      } as ViewStyle)
    : {};

export function WebOverlayHost({ children }: { children: ReactNode }) {
  if (Platform.OS !== "web") return <>{children}</>;
  return <View nativeID="web-overlay-host" style={hostStyle} pointerEvents="box-none">{children}</View>;
}
