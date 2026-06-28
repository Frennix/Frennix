import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { sampleFeedLayout } from "@/lib/feed-layout-diagnostics";

type FeedLayoutOverlayState = {
  share: boolean;
  lightbox: boolean;
  story: boolean;
};

type UseFeedLayoutDiagnosticsOptions = {
  enabled: boolean;
  overlays: FeedLayoutOverlayState;
};

/** Samples computed feed container height/visibility after mount (web / Safari). */
export function useFeedLayoutDiagnostics({ enabled, overlays }: UseFeedLayoutDiagnosticsOptions) {
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;

  useEffect(() => {
    if (Platform.OS !== "web" || !enabled) return;

    let cancelled = false;
    const sample = () => {
      if (cancelled) return;
      sampleFeedLayout(overlaysRef.current);
    };

    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(sample);
    });

    const timers = [0, 100, 300, 800, 1600].map((delay) =>
      window.setTimeout(sample, delay)
    );

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [enabled]);

  useEffect(() => {
    if (Platform.OS !== "web" || !enabled) return;
    sampleFeedLayout(overlays);
  }, [enabled, overlays.share, overlays.lightbox, overlays.story]);
}
