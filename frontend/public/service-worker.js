
const CACHE_NAME = "todo-app-cache-v1";
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

// Install event: cache app assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Caching app assets");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate event: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
});

// Fetch event: serve from cache if offline
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});

self.addEventListener("push", (event) => {
  console.log("📬 Push received:", event);
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      // fallback if plain text is sent
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

self.addEventListener("notificationclick", (event) => {
  event.notification.close(); // close the notification

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If the app is already open in a tab, focus it
      for (const client of clientList) {
        if (client.url.includes(self.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new tab
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});


