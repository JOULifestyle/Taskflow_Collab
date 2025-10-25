
const CACHE_NAME = "todo-app-cache-v2";
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


self.addEventListener("install", (event) => {
  console.log("📥 Installing service worker...");

  self.skipWaiting(); // Activate immediately

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("🗂️ Caching static assets...");
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.error("❌ Failed to cache assets:", err);
      });
    })
  );
});


// Cleans old caches + notifies clients of new version
self.addEventListener("activate", (event) => {
  console.log("🚀 Activating service worker...");

  event.waitUntil(
    (async () => {
      //  Delete old caches
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("🧹 Deleting old cache:", key);
            return caches.delete(key);
          }
        })
      );

      //  Take control of open clients
      await self.clients.claim();

      //  Notify all clients of new version
      const clientsList = await self.clients.matchAll({ type: "window" });
      for (const client of clientsList) {
        client.postMessage({ type: "NEW_VERSION_AVAILABLE" });
      }

      console.log("✅ Service worker activated and clients notified");
    })()
  );
});


// Cache-first strategy for static files; always fetch /api calls
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip API/network requests
  if (url.pathname.startsWith("/api")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).catch(() => {
          // Offline fallback
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        })
      );
    })
  );
});


self.addEventListener("push", (event) => {
  console.log("📨 Push event received");

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      data = { title: "Notification", body: event.data.text() };
    }
  }

  const title = data.title || "New Notification";
  const body = data.body || "You have a new task update";

  // Browser detection
  const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);
  const isEdge = /Edg\//.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);

  // Base options
  const baseOptions = {
    body,
    icon: "/logo192.png",
    badge: "/logo192.png",
    data: {
      url: data.url || "/",
    },
  };

  // Add vibrate/sound for Chrome/Edge
  if (isChrome || isEdge) {
    baseOptions.vibrate = [200, 100, 200];
    if ("sound" in Notification.prototype) {
      baseOptions.sound = "default";
    }
  }

  // Firefox supports vibrate only
  if (isFirefox) {
    baseOptions.vibrate = [200, 100, 200];
  }

  // Safari doesn’t support some options
  if (isSafari) {
    delete baseOptions.badge;
    delete baseOptions.vibrate;
  }

  event.waitUntil(
    self.registration.showNotification(title, baseOptions)
      .then(() => console.log("✅ Notification displayed"))
      .catch((err) => console.error("❌ Failed to show notification:", err))
  );
});


self.addEventListener("notificationclick", (event) => {
  console.log("🖱️ Notification clicked");
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = data.url || "/";

  if (event.action === "view") {
    if (data.taskId) targetUrl = `/?task=${data.taskId}`;
    else if (data.listId) targetUrl = `/?list=${data.listId}`;
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.origin) && "focus" in client) {
          if (targetUrl !== "/" && client.url !== self.origin + targetUrl) {
            client.navigate(self.origin + targetUrl);
          }
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
