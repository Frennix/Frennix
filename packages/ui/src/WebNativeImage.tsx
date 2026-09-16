import { createElement, forwardRef, useCallback, useLayoutEffect, useRef } from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";
import { shouldRevealCachedDomImage } from "./progressiveImageReveal";

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
    { uri, contentFit = "cover", accessibilityLabel, onLoad, onError },
    ref
  ) {
    const nodeRef = useRef<HTMLImageElement | null>(null);
    const onLoadRef = useRef(onLoad);
    onLoadRef.current = onLoad;

    const assignRef = useCallback(
      (node: HTMLImageElement | null) => {
        nodeRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );

    useLayoutEffect(() => {
      if (shouldRevealCachedDomImage(nodeRef.current)) {
        onLoadRef.current?.();
      }
    }, [uri]);

    if (Platform.OS !== "web") {
      return null;
    }

    return createElement("img", {
      ref: assignRef,
      src: uri,
      alt: accessibilityLabel ?? "",
      draggable: false,
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        objectFit: contentFit,
        objectPosition: "center",
        display: "block",
      },
      onLoad: () => onLoadRef.current?.(),
      onError: () => onError?.(),
    });
  }
);
