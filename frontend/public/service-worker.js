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
  
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate event: clean old caches and claim clients
self.addEventListener("activate", (event) => {
  
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
          
            return caches.delete(key);
          }
        })
      )
    )
  );
  return self.clients.claim(); 
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

  // Browser-specific notification options
  const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);
  const isFirefox = /Firefox/.test(navigator.userAgent);
  const isEdge = /Edg\//.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);



  const baseOptions = {
    body,
    icon: "/logo192.png",
    badge: "/logo192.png",
    data: {
      url: data.url || "/", // open this page on click
    },
  };

  // Browser-specific features
  if (isChrome || isEdge) {
    
    baseOptions.vibrate = [200, 100, 200];
    if ('sound' in Notification.prototype) {
      baseOptions.sound = "default";
    }
  }

  if (isFirefox) {
    
    baseOptions.vibrate = [200, 100, 200];
  }

  if (isSafari) {
    delete baseOptions.badge;
    delete baseOptions.vibrate;
  }

  

  event.waitUntil(
    self.registration.showNotification(title, baseOptions)
      .then(() => {
        console.log("✅ Notification displayed successfully");
      })
      .catch((err) => {
        console.error("❌ Failed to display notification:", err);
      })
  );
});

// Notification click
self.addEventListener("notificationclick", (event) => {

  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = data.url || "/";

  // Handle different actions
  if (event.action === "view") {
    // Open the app, potentially with specific task/list context
    if (data.taskId) {
      targetUrl = `/?task=${data.taskId}`;
    } else if (data.listId) {
      targetUrl = `/?list=${data.listId}`;
    }
  } else if (event.action === "snooze") {
    
    // For now, it just open the app
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if we already have a window open
      for (const client of clientList) {
        if (client.url.includes(self.origin) && "focus" in client) {
          console.log("🔄 Focusing existing window");
          // Navigate to the target URL in the existing window
          if (targetUrl !== "/" && client.url !== self.origin + targetUrl) {
            client.navigate(self.origin + targetUrl);
          }
          return client.focus();
        }
      }

      // No existing window, open a new one
      
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
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
