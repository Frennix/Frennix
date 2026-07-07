import { Platform } from "react-native";
import { pushLog } from "@/lib/web-push-diagnostics";

const SW_PATH = "/sw.js";

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/** Register the PWA service worker on web (idempotent). */
export async function registerPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  pushLog("sw.register.start", SW_PATH, { origin: window.location.origin });

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register(SW_PATH, { scope: "/" })
      .then((registration) => {
        pushLog("sw.register.ok", registration.scope, {
          active: registration.active?.scriptURL ?? null,
          waiting: registration.waiting?.scriptURL ?? null,
          installing: registration.installing?.scriptURL ?? null,
        });
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            pushLog("sw.state", installing.state, { scriptURL: installing.scriptURL });
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              void registration.update();
            }
          });
        });
        return registration;
      })
      .catch((error) => {
        pushLog("sw.register.error", String(error));
        console.warn("[frennix-pwa] service worker registration failed", error);
        return null;
      });
  }

  return registrationPromise;
}

/** Check for a waiting service worker update (call on app resume). */
export async function refreshPwaServiceWorker(): Promise<void> {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration("/");
  await registration?.update();
}
