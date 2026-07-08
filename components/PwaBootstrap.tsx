import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { ensurePwaServiceWorkerReady } from "@/lib/register-pwa-service-worker";
import { isWebStandalone } from "@/lib/pwa";

/** Web-only: register and safely refresh the PWA service worker on load and resume. */
export function PwaBootstrap() {
  useEffect(() => {
    if (Platform.OS !== "web" || !isWebStandalone()) return;

    const refresh = () => {
      void ensurePwaServiceWorkerReady();
    };

    refresh();

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onVisibility);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      appStateSub.remove();
    };
  }, []);

  return null;
}
