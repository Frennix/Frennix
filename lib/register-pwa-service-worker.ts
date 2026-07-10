import { Platform } from "react-native";
import { pushLog } from "@/lib/web-push-diagnostics";

/** Keep in sync with FRENNIX_SW_VERSION in public/sw.js */
export const PWA_SW_VERSION = "20260710-web-recovery-v1";

const SW_PATH = "/sw.js";
const VERSION_PATTERN = /FRENNIX_SW_VERSION\s*=\s*["']([^"']+)["']/;

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export type ServiceWorkerEnsureResult =
  | { ok: true; registration: ServiceWorkerRegistration; latestVersion: string | null; updated: boolean }
  | { ok: false; reason: "unsupported" }
  | { ok: false; reason: "needs_reopen"; latestVersion: string | null };

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForServiceWorkerController(timeoutMs: number): Promise<boolean> {
  if (typeof navigator === "undefined") return Promise.resolve(false);
  if (navigator.serviceWorker.controller) return Promise.resolve(true);

  return new Promise((resolve) => {
    const timer = window.setTimeout(
      () => resolve(Boolean(navigator.serviceWorker.controller)),
      timeoutMs
    );
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        window.clearTimeout(timer);
        resolve(Boolean(navigator.serviceWorker.controller));
      },
      { once: true }
    );
  });
}

async function waitForInstallingWorker(
  registration: ServiceWorkerRegistration,
  timeoutMs: number
): Promise<void> {
  if (!registration.installing) return;

  await new Promise<void>((resolve) => {
    const worker = registration.installing;
    if (!worker) {
      resolve();
      return;
    }

    const timer = window.setTimeout(resolve, timeoutMs);
    worker.addEventListener(
      "statechange",
      () => {
        if (worker.state === "installed" || worker.state === "activated") {
          window.clearTimeout(timer);
          resolve();
        }
      },
      { once: false }
    );
  });
}

function activateWaitingWorker(registration: ServiceWorkerRegistration): void {
  const waiting = registration.waiting;
  if (!waiting) return;
  pushLog("sw.activate_waiting", waiting.scriptURL ?? SW_PATH);
  waiting.postMessage({ type: "SKIP_WAITING" });
}

/** Fetch the deployed service worker script and read its version marker. */
export async function fetchLatestServiceWorkerVersion(): Promise<string | null> {
  if (Platform.OS !== "web" || typeof fetch === "undefined") return null;

  try {
    const response = await fetch(`${SW_PATH}?check=${Date.now()}`, { cache: "no-store" });
    const text = await response.text();
    const match = text.match(VERSION_PATTERN);
    return match?.[1] ?? null;
  } catch (error) {
    pushLog("sw.version.fetch_error", String(error));
    return null;
  }
}

function attachUpdateListener(registration: ServiceWorkerRegistration): void {
  if ((registration as ServiceWorkerRegistration & { __frennixUpdateHook?: boolean }).__frennixUpdateHook) {
    return;
  }

  (registration as ServiceWorkerRegistration & { __frennixUpdateHook?: boolean }).__frennixUpdateHook = true;

  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      pushLog("sw.state", installing.state, { scriptURL: installing.scriptURL });
      if (installing.state === "installed" && registration.waiting) {
        activateWaitingWorker(registration);
      }
    });
  });
}

/** Register the PWA service worker on web (idempotent). */
export async function registerPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  pushLog("sw.register.start", SW_PATH, { origin: window.location.origin });

  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register(SW_PATH, { scope: "/", updateViaCache: "none" })
      .then((registration) => {
        pushLog("sw.register.ok", registration.scope, {
          active: registration.active?.scriptURL ?? null,
          waiting: registration.waiting?.scriptURL ?? null,
          installing: registration.installing?.scriptURL ?? null,
        });
        attachUpdateListener(registration);
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

/**
 * Detect, update, and activate the latest service worker safely.
 * Existing Home Screen installs pick up new push logic without reinstalling.
 */
export async function ensurePwaServiceWorkerReady(): Promise<ServiceWorkerEnsureResult> {
  if (Platform.OS !== "web" || typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return { ok: false, reason: "unsupported" };
  }

  const latestVersion = await fetchLatestServiceWorkerVersion();
  pushLog("sw.version.latest", latestVersion ?? PWA_SW_VERSION);

  const registration = await registerPwaServiceWorker();
  if (!registration) {
    return { ok: false, reason: "unsupported" };
  }

  const hadWaiting = Boolean(registration.waiting);
  const hadController = Boolean(navigator.serviceWorker.controller);

  try {
    await registration.update();
  } catch (error) {
    pushLog("sw.update.error", String(error));
  }

  if (registration.installing) {
    await waitForInstallingWorker(registration, 6000);
  }

  if (registration.waiting) {
    activateWaitingWorker(registration);
    await waitMs(400);
  }

  const gotController = await waitForServiceWorkerController(8000);

  let readyRegistration: ServiceWorkerRegistration;
  try {
    readyRegistration = await navigator.serviceWorker.ready;
  } catch (error) {
    pushLog("sw.ready.error", String(error));
    return { ok: false, reason: "needs_reopen", latestVersion };
  }

  const stillPending = Boolean(registration.waiting || registration.installing);
  const missingController = !navigator.serviceWorker.controller;
  const missingPushManager = !readyRegistration.pushManager;

  if ((stillPending || missingController || missingPushManager) && !gotController) {
    pushLog("sw.ensure.needs_reopen", "controller or push manager unavailable", {
      stillPending,
      missingController,
      missingPushManager,
      hadWaiting,
      hadController,
    });
    return { ok: false, reason: "needs_reopen", latestVersion };
  }

  const updated = hadWaiting || (!hadController && gotController);
  pushLog("sw.ensure.ready", readyRegistration.scope, {
    controller: navigator.serviceWorker.controller?.scriptURL ?? null,
    latestVersion,
    updated,
  });

  return { ok: true, registration: readyRegistration, latestVersion, updated };
}

/** Check for a waiting service worker update (call on app resume). */
export async function refreshPwaServiceWorker(): Promise<ServiceWorkerEnsureResult> {
  return ensurePwaServiceWorkerReady();
}
