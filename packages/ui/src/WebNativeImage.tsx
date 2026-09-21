import { createElement, forwardRef, useCallback, useLayoutEffect, useRef } from "react";
import { Platform, type StyleProp, type ViewStyle } from "react-native";
import { shouldRevealCachedDomImage } from "./progressiveImageReveal";

export type WebNativeImageProps = {
  uri: string;
  contentFit?: "cover" | "contain";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  onLoad?: () => void;
  onLoadEnd?: () => void;
  onError?: () => void;
};

/**
 * Safari/WebKit-safe feed image path — plain HTML img with object-fit.
 * Used on web instead of expo-image for PNG/JPEG mismatch tolerance.
 */
export const WebNativeImage = forwardRef<HTMLImageElement, WebNativeImageProps>(
  function WebNativeImage(
    { uri, contentFit = "cover", accessibilityLabel, onLoad, onLoadEnd, onError },
    ref
  ) {
    const nodeRef = useRef<HTMLImageElement | null>(null);
    const notifiedRef = useRef(false);
    const onLoadRef = useRef(onLoad);
    const onLoadEndRef = useRef(onLoadEnd);
    onLoadRef.current = onLoad;
    onLoadEndRef.current = onLoadEnd;

    const notifyReady = useCallback((source: "onLoad" | "onLoadEnd" | "cached") => {
      if (notifiedRef.current) return;
      notifiedRef.current = true;
      console.info("[story-image]", { event: source, uri });
      onLoadRef.current?.();
      onLoadEndRef.current?.();
    }, [uri]);

    const assignRef = useCallback(
      (node: HTMLImageElement | null) => {
        nodeRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
        if (shouldRevealCachedDomImage(node)) {
          notifyReady("cached");
        }
      },
      [notifyReady, ref]
    );

    useLayoutEffect(() => {
      notifiedRef.current = false;
      const img = nodeRef.current;
      const check = () => {
        if (shouldRevealCachedDomImage(nodeRef.current)) {
          notifyReady("cached");
        }
      };
      check();
      const raf = requestAnimationFrame(check);
      const timeout = setTimeout(check, 0);
      void img?.decode?.().then(() => notifyReady("cached")).catch(() => undefined);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timeout);
      };
    }, [notifyReady, uri]);

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
      onLoad: () => notifyReady("onLoad"),
      onLoadEnd: () => notifyReady("onLoadEnd"),
      onError: () => {
        console.info("[story-image]", { event: "onError", uri });
        onError?.();
      },
    });
  }
);
