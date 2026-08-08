/**
 * Frennix PWA service worker — push notifications + safe fetch handling.
 * Bump FRENNIX_SW_VERSION on deploy to refresh installed PWAs.
 */
const FRENNIX_SW_VERSION = "20260808-pwa-fetch-safe-v1";
const SHELL_CACHE = "frennix-shell-v11";
const NAV_FALLBACK_REQUEST = new Request("/", { method: "GET" });
const SHELL_ASSETS = ["/manifest.webmanifest"];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta http-equiv="refresh" content="0;url=/" />
  <title>Frennix</title>
</head>
<body style="margin:0;background:#0A0A0B;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh">
  <p>Reconnecting…</p>
  <script>location.replace(location.origin + "/");</script>
</body>
</html>`;

function isHttpOrHttpsUrl(url) {
  return url.protocol === "http:" || url.protocol === "https:";
}

/** Only intercept same-origin GET requests over HTTP(S). Never touch data:, blob:, etc. */
function shouldHandleFetch(request) {
  if (request.method !== "GET") return false;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }

  if (!isHttpOrHttpsUrl(url)) return false;
  if (url.origin !== self.location.origin) return false;

  return true;
}

function isShellAssetPath(pathname) {
  return pathname === "/manifest.webmanifest" || pathname.startsWith("/icons/");
}

function offlineHtmlResponse() {
  return new Response(OFFLINE_HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** respondWith must always resolve to a valid Response — never reject. */
function safeRespond(event, handler) {
  event.respondWith(
    Promise.resolve()
      .then(() => handler(event.request))
      .catch(() => offlineHtmlResponse())
  );
}

async function cacheNavFallback(response) {
  if (!response || !response.ok) return;
  try {
    const cache = await caches.open(SHELL_CACHE);
    await cache.put(NAV_FALLBACK_REQUEST, response.clone());
  } catch {
    // Ignore cache write failures.
  }
}

async function readNavFallback() {
  try {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(NAV_FALLBACK_REQUEST)) ?? null;
  } catch {
    return null;
  }
}

async function handleNavigate(request) {
  try {
    const response = await fetch(request, { cache: "no-store", redirect: "follow" });
    if (response && (response.ok || response.type === "opaqueredirect")) {
      await cacheNavFallback(response);
      return response;
    }
  } catch {
    // Network failure — use offline fallback below.
  }

  const cached = await readNavFallback();
  if (cached) return cached;

  try {
    const rootResponse = await fetch(NAV_FALLBACK_REQUEST, { cache: "no-store" });
    if (rootResponse.ok) {
      await cacheNavFallback(rootResponse);
      return rootResponse;
    }
  } catch {
    // Fall through to synthetic shell.
  }

  return offlineHtmlResponse();
}

async function handleShellAsset(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request, { cache: "no-store" });
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response("", {
      status: 503,
      statusText: "Service Unavailable",
      headers: { "Cache-Control": "no-store" },
    });
  }
}

function safeAppPath(raw) {
  if (typeof raw !== "string") return "/";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  if (trimmed.includes("://")) return "/";
  return trimmed;
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Frennix", body: "You have a new notification", data: {} };
  try {
    payload = event.data?.json() ?? payload;
  } catch {
    payload.body = event.data?.text() ?? payload.body;
  }

  const title = payload.title ?? "Frennix";
  const body = payload.body ?? "";
  const data = payload.data ?? payload;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data,
      }),
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: "PUSH_RECEIVED", data });
        }
      }),
    ])
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data ?? {};
  const deepLink = safeAppPath(data.deep_link ?? "/notifications");

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.postMessage({ type: "NOTIFICATION_CLICK", data });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(deepLink);
      }
      return undefined;
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!shouldHandleFetch(request)) return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    safeRespond(event, handleNavigate);
    return;
  }

  if (isShellAssetPath(url.pathname)) {
    safeRespond(event, handleShellAsset);
  }
});
