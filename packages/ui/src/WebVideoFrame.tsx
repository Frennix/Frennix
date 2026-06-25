import { createElement, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { VideoPosterFallback } from "./VideoPosterFallback";
import { colors } from "./theme";

interface WebVideoFrameProps {
  uri: string;
  style?: ViewStyle;
  compact?: boolean;
  fit?: "cover" | "contain";
}

function previewSrc(uri: string): string {
  if (uri.startsWith("blob:") || uri.startsWith("data:")) return uri;
  if (uri.includes("#")) return uri;
  return `${uri}#t=0.5`;
}

/** Renders a paused video frame on web without canvas/CORS (first-frame poster fallback). */
export function WebVideoFrame({ uri, style, compact, fit = "cover" }: WebVideoFrameProps) {
  const containerRef = useRef<View | null>(null);
  const ref = useRef<HTMLVideoElement | null>(null);
  const statusRef = useRef<"loading" | "ready" | "error">("loading");
  const [visible, setVisible] = useState(Platform.OS !== "web");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.01 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [uri]);

  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;

    setStatus("loading");
    const video = ref.current;
    if (!video) return;

    const seekToPosterFrame = () => {
      const target = Math.min(0.5, video.duration > 0 ? video.duration / 3 : 0.5);
      try {
        video.currentTime = target;
      } catch {
        // Seek can fail before metadata is ready; loadeddata will retry.
      }
    };

    const handleReady = () => {
      seekToPosterFrame();
    };

    const handleSeeked = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setStatus("ready");
      }
    };

    const handleError = () => {
      setStatus("error");
    };

    video.addEventListener("loadeddata", handleReady);
    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleError);

    if (video.readyState >= 2) {
      handleReady();
    }

    return () => {
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
      video.pause();
    };
  }, [uri, visible]);

  if (Platform.OS !== "web") {
    return <VideoPosterFallback style={style} compact={compact} />;
  }

  if (!visible) {
    return (
      <View ref={containerRef} style={[styles.wrap, style]}>
        <VideoPosterFallback style={StyleSheet.absoluteFill} compact={compact} />
      </View>
    );
  }

  if (status === "error") {
    return <VideoPosterFallback style={style} compact={compact} />;
  }

  return (
    <View ref={containerRef} style={[styles.wrap, style]}>
      <VideoPosterFallback style={StyleSheet.absoluteFill} compact={compact} />
      {createElement("video", {
        ref,
        key: uri,
        src: previewSrc(uri),
        muted: true,
        playsInline: true,
        preload: "metadata",
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: fit,
          backgroundColor: "transparent",
          pointerEvents: "none",
          opacity: status === "ready" ? 1 : 0,
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceElevated,
    overflow: "hidden",
  },
});
