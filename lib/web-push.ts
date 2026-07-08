import { Platform } from "react-native";
import {
  evaluateFeatureFlag,
  removeWebPushSubscription,
  sendWebPushTestNotification,
  updateUserNotificationPreference,
  upsertWebPushSubscription,
} from "@frennix/api";
import { config } from "@/lib/config";
import { isWebPushEnvironmentReady, isWebStandalone } from "@/lib/pwa";
import { registerPwaServiceWorker, ensurePwaServiceWorkerReady, type ServiceWorkerEnsureResult } from "@/lib/register-pwa-service-worker";
import { pushLog, formatPushError } from "@/lib/web-push-diagnostics";

export const WEB_PUSH_FLAG_KEY = "web_push_notifications";

export type WebPushSubscribeFailureReason =
  | "unsupported"
  | "not_standalone"
  | "not_signed_in"
  | "denied"
  | "flag_off"
  | "vapid_missing"
  | "sw_failed"
  | "subscribe_failed"
  | "save_failed";

export type WebPushSubscribeResult =
  | { ok: true; endpoint: string }
  | { ok: false; reason: WebPushSubscribeFailureReason; message: string };

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function logPushError(step: string, error: unknown) {
  const formatted = formatPushError(error);
  pushLog(step, formatted.message ? String(formatted.message) : String(error), formatted);
}

function maskSubscriptionJson(json: PushSubscriptionJSON) {
  return {
    endpoint: json.endpoint?.slice(0, 72) ?? null,
    expirationTime: json.expirationTime ?? null,
    p256dh: json.keys?.p256dh ? `${json.keys.p256dh.slice(0, 8)}…` : null,
    auth: json.keys?.auth ? `${json.keys.auth.slice(0, 8)}…` : null,
  };
}

async function subscribeWithPushManager(
  registration: ServiceWorkerRegistration,
  vapidKey: string
): Promise<PushSubscription> {
  const applicationServerKey = urlBase64ToUint8Array(vapidKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing?.endpoint) {
    pushLog("subscribe.result", "reused existing subscription", maskSubscriptionJson(existing.toJSON()));
    return existing;
  }

  pushLog("subscribe.calling_pushManager_subscribe", "pushManager.subscribe()", {
    userVisibleOnly: true,
    vapidBytes: applicationServerKey.byteLength,
    vapidPrefix: vapidKey.slice(0, 12),
  });
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    pushLog("subscribe.result", "success", maskSubscriptionJson(subscription.toJSON()));
    return subscription;
  } catch (error) {
    logPushError("subscribe.error", error);
    const stale = await registration.pushManager.getSubscription();
    if (stale) {
      pushLog("subscribe.cleanup", "unsubscribing stale subscription before retry");
      try {
        await stale.unsubscribe();
      } catch (unsubscribeError) {
        logPushError("subscribe.cleanup_error", unsubscribeError);
      }
    }
    pushLog("subscribe.calling_pushManager_subscribe", "retry after cleanup");
    try {
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      pushLog("subscribe.result", "success after retry", maskSubscriptionJson(subscription.toJSON()));
      return subscription;
    } catch (retryError) {
      logPushError("subscribe.error", retryError);
      throw retryError;
    }
  }
}

/** Warm service worker registration before subscribe (call on screen mount). */
export async function prewarmWebPushRegistration(): Promise<ServiceWorkerEnsureResult> {
  if (!isWebPushApiAvailable()) return { ok: false, reason: "unsupported" };
  pushLog("prewarm", "ensurePwaServiceWorkerReady()");
  return ensurePwaServiceWorkerReady();
}

function waitForServiceWorkerController(timeoutMs: number): Promise<void> {
  if (typeof navigator === "undefined" || navigator.serviceWorker.controller) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, timeoutMs);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

export function isWebPushApiAvailable(): boolean {
  return (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    typeof Notification !== "undefined" &&
    "serviceWorker" in navigator
  );
}

export function canPromptForWebPush(): boolean {
  return isWebPushApiAvailable() && isWebStandalone();
}

export async function isWebPushFeatureEnabled(): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  return evaluateFeatureFlag(WEB_PUSH_FLAG_KEY);
}

export async function getWebPushPermissionStatus(): Promise<NotificationPermission | "unsupported"> {
  if (!isWebPushApiAvailable()) return "unsupported";
  return Notification.permission;
}

export async function hasActiveWebPushSubscription(options?: {
  logStep?: "subscribe.check" | "subscribe.post_check";
}): Promise<boolean> {
  const logStep = options?.logStep ?? "subscribe.check";
  if (!isWebPushApiAvailable()) return false;
  if (Notification.permission !== "granted") {
    pushLog(logStep, "skipped — permission not granted");
    return false;
  }

  try {
    await registerPwaServiceWorker();
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    const active = Boolean(subscription?.endpoint);
    pushLog(logStep, active ? "browser subscription present" : "no browser subscription", {
      endpoint: subscription?.endpoint?.slice(0, 48) ?? null,
      scope: registration.scope,
      controller: navigator.serviceWorker.controller?.scriptURL ?? null,
    });
    return active;
  } catch (error) {
    pushLog(`${logStep}_error`, String(error));
    return false;
  }
}

export function logWebPushEnvironment(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  pushLog("env.origin", window.location.origin);
  pushLog("env.href", window.location.href);
  pushLog("env.standalone", String(isWebStandalone()));
  pushLog("env.display_mode", window.matchMedia("(display-mode: standalone)").matches ? "standalone" : "browser");
  pushLog("env.notification_api", String(typeof Notification !== "undefined"));
  pushLog("env.notification_permission", typeof Notification !== "undefined" ? Notification.permission : "n/a");
  pushLog("env.service_worker", String("serviceWorker" in navigator));
  pushLog("env.push_manager_window", String("PushManager" in window));
  pushLog("env.sw_controller", String(Boolean(navigator.serviceWorker?.controller)));
  pushLog(
    "env.vapid",
    config.vapidPublicKey ? `${config.vapidPublicKey.slice(0, 12)}…` : "MISSING"
  );

  const manifestHref = document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? "";
  pushLog("env.manifest_href", manifestHref || "missing");

  if (manifestHref) {
    void fetch(manifestHref)
      .then((response) => response.json())
      .then((manifest) => {
        pushLog("env.manifest", "loaded", {
          display: manifest.display,
          start_url: manifest.start_url,
          scope: manifest.scope,
          icons: Array.isArray(manifest.icons) ? manifest.icons.length : 0,
        });
      })
      .catch((error) => pushLog("env.manifest_error", String(error)));
  }

  void fetch("/sw.js")
    .then(async (response) => {
      const contentType = response.headers.get("content-type") ?? "unknown";
      const snippet = (await response.text()).slice(0, 40).replace(/\s+/g, " ");
      pushLog("env.sw_js", `${response.status} ${contentType}`, { snippet });
    })
    .catch((error) => pushLog("env.sw_js_error", String(error)));

  const expectedOrigin = config.appUrl.replace(/\/$/, "");
  if (window.location.origin !== expectedOrigin) {
    pushLog("env.origin_warning", `running on ${window.location.origin}, expected ${expectedOrigin}`);
  }
}

function failure(
  reason: WebPushSubscribeFailureReason,
  message: string
): WebPushSubscribeResult {
  pushLog("subscribe.stopped", reason, message);
  return { ok: false, reason, message };
}

/**
 * Call Notification.requestPermission() immediately inside a native click handler.
 * Do not await anything before this in the click handler.
 */
export function requestWebPushPermissionFromUserGesture(): Promise<NotificationPermission | "unsupported"> {
  if (!isWebPushApiAvailable()) {
    pushLog("permission.unsupported", "Notification API unavailable");
    return Promise.resolve("unsupported");
  }

  pushLog("permission.before", Notification.permission);
  pushLog("permission.calling", "Notification.requestPermission()");

  return Notification.requestPermission()
    .then((result) => {
      pushLog("permission.result", result);
      return result;
    })
    .catch((error) => {
      pushLog("permission.error", String(error));
      return "denied" as NotificationPermission;
    });
}

/** Complete push subscription after permission is granted (SW + VAPID + DB). */
export async function completeWebPushSubscription(
  userId: string
): Promise<WebPushSubscribeResult> {
  pushLog("subscribe.start", "completeWebPushSubscription", { userId: userId.slice(0, 8) });

  if (!userId) {
    return failure("not_signed_in", "Sign in to enable push notifications.");
  }

  if (!isWebPushApiAvailable()) {
    return failure("unsupported", "Push notifications are not supported in this browser.");
  }

  pushLog("subscribe.gate_permission", Notification.permission);
  if (Notification.permission !== "granted") {
    return failure(
      "denied",
      `Notification.permission is "${Notification.permission}" — cannot subscribe without granted.`
    );
  }

  pushLog("subscribe.gate_standalone", String(isWebStandalone()));
  if (!isWebStandalone()) {
    return failure(
      "not_standalone",
      "Add Frennix to your Home Screen, then open it from the home screen icon."
    );
  }

  const featureEnabled = await isWebPushFeatureEnabled();
  pushLog("subscribe.gate_feature_flag", String(featureEnabled));
  if (!featureEnabled) {
    return failure("flag_off", "Push notifications are not enabled for your account yet.");
  }

  const vapidKey = config.vapidPublicKey;
  pushLog("subscribe.gate_vapid", vapidKey ? `${vapidKey.slice(0, 12)}…` : "MISSING");
  if (!vapidKey) {
    return failure(
      "vapid_missing",
      "Push is not configured on this build. Re-deploy with EXPO_PUBLIC_VAPID_PUBLIC_KEY."
    );
  }

  pushLog("subscribe.service_worker_register", "ensurePwaServiceWorkerReady()");
  const swReady = await ensurePwaServiceWorkerReady();
  if (!swReady.ok) {
    const message =
      swReady.reason === "needs_reopen"
        ? "Frennix is updating. Close and reopen the app to finish push setup."
        : "Could not start the notification service. Reload and try again.";
    return failure("sw_failed", message);
  }

  const registration = swReady.registration;
  pushLog("subscribe.service_worker_ready", "resolved", {
    scope: registration.scope,
    scriptURL: registration.active?.scriptURL ?? registration.installing?.scriptURL ?? null,
    controller: navigator.serviceWorker.controller?.scriptURL ?? null,
    pushManager: Boolean(registration.pushManager),
  });

  if (!navigator.serviceWorker.controller) {
    pushLog("subscribe.service_worker_controller", "missing — waiting up to 5s");
    await waitForServiceWorkerController(5000);
    pushLog(
      "subscribe.service_worker_controller",
      navigator.serviceWorker.controller?.scriptURL ?? "still missing after wait"
    );
  }

  if (!registration.pushManager) {
    return failure("sw_failed", "PushManager is not available on this iPhone / browser.");
  }

  let subscription: PushSubscription;
  try {
    subscription = await subscribeWithPushManager(registration, vapidKey);
  } catch (error) {
    const formatted = formatPushError(error);
    const detail = [formatted.name, formatted.message, formatted.code].filter(Boolean).join(" — ");
    return failure("subscribe_failed", `PushManager.subscribe failed: ${detail || String(error)}`);
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    pushLog("subscribe.error", "subscription JSON missing endpoint or keys", maskSubscriptionJson(json));
    return failure("subscribe_failed", "Push subscription was incomplete. Try again.");
  }

  try {
    pushLog("db.upsert_start", "upsert_web_push_subscription", {
      endpoint: json.endpoint.slice(0, 72),
      p256dhLen: json.keys.p256dh.length,
      authLen: json.keys.auth.length,
    });
    const subscriptionId = await upsertWebPushSubscription({
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      userAgent: navigator.userAgent,
      deviceLabel: "iPhone PWA",
    });
    pushLog("db.saved", subscriptionId ?? "ok", { endpoint: json.endpoint.slice(0, 72) });
  } catch (error) {
    logPushError("db.error", error);
    const formatted = formatPushError(error);
    const detail = [formatted.message, formatted.code, formatted.details, formatted.hint]
      .filter(Boolean)
      .join(" | ");
    return failure("save_failed", `Saving push subscription to Supabase failed: ${detail}`);
  }

  pushLog("subscribe.complete", "success", { endpoint: json.endpoint.slice(0, 72) });
  return { ok: true, endpoint: json.endpoint };
}

/**
 * @deprecated Use requestWebPushPermissionFromUserGesture + completeWebPushSubscription from native click.
 */
export async function subscribeToWebPush(userId: string): Promise<WebPushSubscribeResult> {
  logWebPushEnvironment();
  const permission = await requestWebPushPermissionFromUserGesture();
  if (permission === "denied" || permission === "default" || permission === "unsupported") {
    return failure(
      "denied",
      permission === "default"
        ? "iOS did not show the permission dialog. Use the Enable Push Notifications button again."
        : "Notification permission was not granted."
    );
  }
  return completeWebPushSubscription(userId);
}

export async function unsubscribeFromWebPush(): Promise<void> {
  if (Platform.OS !== "web" || !("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await removeWebPushSubscription(endpoint);
}

export function webPushFailureMessage(result: WebPushSubscribeResult): string | null {
  return result.ok ? null : result.message;
}

export function isWebPushFullyEnabled(
  permission: NotificationPermission | "unsupported",
  subscribed: boolean
): boolean {
  return permission === "granted" && subscribed;
}

/** Finish SW subscribe + Supabase save when iOS permission is already granted. */
export async function ensureWebPushSubscription(
  userId: string
): Promise<WebPushSubscribeResult | null> {
  if (!userId || !isWebPushApiAvailable()) return null;
  if (Notification.permission !== "granted") return null;
  if (await hasActiveWebPushSubscription()) {
    pushLog("ensure", "subscription already active — syncing to Supabase");
    return completeWebPushSubscription(userId);
  }
  pushLog("ensure", "permission granted but no subscription — completing setup");
  return completeWebPushSubscription(userId);
}

export async function applyWebPushPreferenceOnSuccess(
  userId: string,
  queryClient?: { invalidateQueries: (filters: { queryKey: string[] }) => void }
): Promise<void> {
  await updateUserNotificationPreference(userId, "push_enabled", true);
  queryClient?.invalidateQueries({ queryKey: ["user-notification-preferences", userId] });
  queryClient?.invalidateQueries({ queryKey: ["notification-preferences", userId] });
}

export async function sendTestWebPushAfterSubscribe(userId: string): Promise<void> {
  try {
    pushLog("test_push", "send_web_push_test_notification");
    const notificationId = await sendWebPushTestNotification();
    pushLog("test_push.sent", notificationId ?? "queued");
  } catch (error) {
    logPushError("test_push.error", error);
  }
}
