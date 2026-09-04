import { createElement, forwardRef, useCallback } from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";

export type WebNativeImageProps = {
  uri: string;
  contentFit?: "cover" | "contain";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  onLoad?: () => void;
  onError?: () => void;
};

/**
 * Safari/WebKit-safe feed image path — plain HTML img with object-fit.
 * Used on web instead of expo-image for PNG/JPEG mismatch tolerance.
 */
export const WebNativeImage = forwardRef<HTMLImageElement, WebNativeImageProps>(
  function WebNativeImage(
    { uri, contentFit = "cover", style, accessibilityLabel, onLoad, onError },
    ref
  ) {
    const assignRef = useCallback(
      (node: HTMLImageElement | null) => {
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );

    if (Platform.OS !== "web") {
      return null;
    }

    const flatStyle = Array.isArray(style)
      ? Object.assign({}, ...style.filter(Boolean))
      : style ?? {};

    return createElement("img", {
      ref: assignRef,
      src: uri,
      alt: accessibilityLabel ?? "",
      draggable: false,
      style: {
        width: "100%",
        height: "100%",
        objectFit: contentFit,
        objectPosition: "center",
        display: "block",
        ...flatStyle,
      },
      onLoad: () => onLoad?.(),
      onError: () => onError?.(),
    });
  }
);
