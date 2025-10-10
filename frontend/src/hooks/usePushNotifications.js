import { useEffect } from "react";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const VAPID_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

// Converts base64 → UInt8Array (required for Edge & Firefox)
function urlBase64ToUint8Array(base64String) {
  if (!base64String) throw new Error("Missing VAPID key");
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(token) {
  useEffect(() => {
    if (!token || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    // 🔍 Log browser information for debugging
    console.log("🖥️ Browser detection:", {
      userAgent: navigator.userAgent,
      isEdge: /Edg\//.test(navigator.userAgent),
      isChrome: /Chrome/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent),
      platform: navigator.platform
    });

    async function waitForActiveSW() {
      const reg = await navigator.serviceWorker.ready;

      // 🕐 Ensure it's actually active (some browsers delay activation)
      if (reg.active?.state !== "activated") {
        await new Promise((resolve) => {
          reg.active.addEventListener("statechange", (e) => {
            if (e.target.state === "activated") resolve();
          });
        });
      }
      return reg;
    }

    async function subscribe() {
  try {
    const reg = await waitForActiveSW();

    // ✅ Re-request permission if not granted
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Push permission denied");
      return;
    }

    //  Force-clear any existing subscription
    const oldSub = await reg.pushManager.getSubscription();
    if (oldSub) {
      const endpoint = oldSub.endpoint || "";
      console.log("Old subscription endpoint:", endpoint);
      await oldSub.unsubscribe();
      console.log("🗑️ Old subscription removed (force refresh)");
    }

    //  Use VAPID keys for all browsers to ensure FCM compatibility
    // Microsoft Edge supports FCM but may default to WNS without VAPID
    console.log("🔑 Using VAPID keys for FCM across all browsers");
    const convertedVapidKey = urlBase64ToUint8Array(VAPID_KEY);
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    });

    const plainSub = sub.toJSON();
    console.log("🚀 Subscribed with endpoint:", plainSub.endpoint);
    console.log("🔍 Full subscription details:", plainSub);

    // 🔍 Check if endpoint indicates FCM or WNS
    const isFCM = plainSub.endpoint.includes('fcm.googleapis.com');
    const isWNS = plainSub.endpoint.includes('notify.windows.com');
    console.log("📡 Push service detected:", { isFCM, isWNS, endpoint: plainSub.endpoint });

    await fetch(`${API_URL}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subscription: plainSub }),
    });

    console.log("✅ Push subscription registered successfully");
  } catch (err) {
    console.error("Push subscribe error:", err);
  }
}


    subscribe();
  }, [token]);
}
