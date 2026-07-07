/**
 * Frennix PWA service worker — Phase 3: push + click + shell cache.
 * Version bump forces update on deploy.
 */
const SHELL_CACHE = "frennix-shell-v2";
const SHELL_ASSETS = ["/", "/manifest.webmanifest"];

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
  const deepLink = data.deep_link ?? "/notifications";

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
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isShellAsset =
    url.pathname === "/manifest.webmanifest" || url.pathname.startsWith("/icons/");

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => caches.match("/") ?? caches.match("/index.html"))
    );
    return;
  }

  if (isShellAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((response) => response))
    );
  }
});
