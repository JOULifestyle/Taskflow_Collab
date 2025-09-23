import { useEffect } from "react";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const VAPID_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

export function usePushNotifications(token) {
  useEffect(() => {
    if (!token || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    async function subscribe() {
      try {
        const reg = await navigator.serviceWorker.ready;

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.log("Push permission denied");
          return;
        }

        const existing = await reg.pushManager.getSubscription();
        if (existing) return; // already subscribed

       const sub = await reg.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: VAPID_KEY,
});

const plainSub = sub.toJSON(); // <-- convert to plain object
console.log("🚀 Sending body to /subscriptions:", { subscription: plainSub });


await fetch(`${API_URL}/subscriptions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ subscription: plainSub }), // <-- send plain object
});

console.log("✅ Subscribed to push notifications", plainSub);
      } catch (err) {
        console.error("Push subscribe error", err);
      }
    }

    subscribe();
  }, [token]);
}
