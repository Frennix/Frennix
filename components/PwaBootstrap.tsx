import { useEffect } from "react";
import { Platform } from "react-native";
import { registerPwaServiceWorker } from "@/lib/register-pwa-service-worker";

/** Web-only: register PWA service worker on app load (production also registers via index.html). */
export function PwaBootstrap() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    void registerPwaServiceWorker();
  }, []);

  return null;
}
