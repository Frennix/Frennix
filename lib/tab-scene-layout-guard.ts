import { useEffect } from "react";
import { Platform } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { logDiagnostic } from "@/lib/client-diagnostics";
import { reportClientError } from "@/lib/report-client-error";

const LAYOUT_IDS = ["feed-tab-scene", "feed-root-container", "feed-scroll-shell"] as const;
const MIN_OK_HEIGHT_PX = 80;
const CHECK_DELAYS_MS = [400, 1200, 3000, 6000];

type LayoutProbe = {
  id: string;
  height: number;
  minHeight: string;
  display: string;
};

function readLayoutProbes(): LayoutProbe[] {
  if (typeof document === "undefined") return [];

  return LAYOUT_IDS.map((id) => {
    const el = document.getElementById(id);
    if (!el) {
      return { id, height: 0, minHeight: "missing", display: "missing" };
    }
    const style = getComputedStyle(el);
    return {
      id,
      height: Math.round(el.getBoundingClientRect().height),
      minHeight: style.minHeight,
      display: style.display,
    };
  });
}

/**
 * Production guard — reports feed tab scene layout collapse (0px) after login.
 * Complements document CSS; surfaces regressions in beta_feedback / diagnostics.
 */
export function useTabSceneLayoutGuard(): void {
  const { session } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (Platform.OS !== "web" || !userId) return;

    let cancelled = false;

    const check = (pass: number) => {
      if (cancelled) return;

      const probes = readLayoutProbes();
      const scene = probes.find((p) => p.id === "feed-tab-scene");
      const feedRoot = probes.find((p) => p.id === "feed-root-container");

      if (!scene || scene.height > MIN_OK_HEIGHT_PX) return;

      const reason = `feed-tab-scene height ${scene.height}px (pass ${pass})`;
      logDiagnostic("layout", reason, "error", {
        probes,
        pass,
        path: typeof location !== "undefined" ? location.pathname : undefined,
      });
      void reportClientError({
        source: "tab-scene-layout-guard",
        error: new Error(reason),
        userId,
        screen: "/(tabs)",
        extra: { probes },
      });
    };

    const timers = CHECK_DELAYS_MS.map((delay, index) =>
      window.setTimeout(() => check(index + 1), delay)
    );

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [userId]);
}
