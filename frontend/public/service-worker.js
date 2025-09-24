const CACHE_NAME = "todo-app-cache-v2"; // bump version when deploying
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/favicon.ico",
  "/manifest.json",
  "/logo192.png",
  "/logo512.png",
  "/static/js/bundle.js",
  "/static/css/main.css",
];

// Install event: cache app assets & activate immediately
self.addEventListener("install", (event) => {
  console.log("📥 Service Worker installing...");
  self.skipWaiting(); // 🚀 activate new worker right away
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 Caching static assets...");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate event: clean old caches and claim clients
self.addEventListener("activate", (event) => {
  console.log("⚡ Activating new service worker...");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("🧹 Removing old cache:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  return self.clients.claim(); // 🔄 take control of all open clients
});

// Fetch event: cache-first for static assets, bypass /api calls
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip API requests (always go to network)
  if (url.pathname.startsWith("/api")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() => {
          // Offline fallback for navigation requests
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        })
      );
    })
  );
});

// Push notifications
self.addEventListener("push", (event) => {
  console.log("📬 Push received:", event);
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: "Notification", body: event.data.text() };
    }
  }

  const title = data.title || "New Notification";
  const body = data.body || "You have a new task update";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/logo192.png",
    })
  );
});

// Notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});

// Notify clients when a new SW is active
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window" });
      for (const client of clientsList) {
        client.postMessage({ type: "NEW_VERSION_AVAILABLE" });
      }
    })()
  );
});
