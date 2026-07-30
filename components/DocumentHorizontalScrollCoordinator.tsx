import { usePathname } from "expo-router";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import {
  assertNoDocumentOverflow,
  scheduleWebViewportNormalize,
} from "@/lib/web-viewport-normalize";

/** Keeps document/shell geometry aligned with the viewport after navigation and app resume. */
export function DocumentHorizontalScrollCoordinator() {
  const pathname = usePathname();

  useEffect(() => {
    scheduleWebViewportNormalize();
    assertNoDocumentOverflow(pathname);
  }, [pathname]);

  useEffect(() => {
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          scheduleWebViewportNormalize();
        }
      };
      document.addEventListener("visibilitychange", onVisibilityChange);
      return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    }

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        scheduleWebViewportNormalize();
      }
    });
    return () => subscription.remove();
  }, []);

  return null;
}
