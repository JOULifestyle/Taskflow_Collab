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
    console.log(`[Push Notifications] Hook initialized. Token present: ${!!token}, SW supported: ${"serviceWorker" in navigator}, PushManager supported: ${"PushManager" in window}`);

    if (!token || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log(`[Push Notifications] Skipping push notifications setup: Missing token or unsupported browser features`);
      return;
    }

    //  Browser detection variables - order matters for proper detection
    const isEdge = /Edg\//.test(navigator.userAgent);
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);
    console.log(`[Push Notifications] Browser detection: Edge: ${isEdge}, Chrome: ${isChrome}, Firefox: ${isFirefox}, Safari: ${isSafari}`);

    
    if (isEdge) {
    }


    async function waitForActiveSW() {
      console.log(`[Push Notifications] Waiting for active SW...`);
      const reg = await navigator.serviceWorker.ready;
      console.log(`[Push Notifications] SW ready. Active state: ${reg.active?.state}, Installing: ${!!reg.installing}, Waiting: ${!!reg.waiting}`);

      if (reg.active?.state !== "activated") {
        console.log(`[Push Notifications] SW not activated, waiting for statechange...`);
        await new Promise((resolve) => {
          reg.active.addEventListener("statechange", (e) => {
            console.log(`[Push Notifications] SW state changed to: ${e.target.state}`);
            if (e.target.state === "activated") resolve();
          });
        });
      }
      console.log(`[Push Notifications] SW is now active`);
      return reg;
    }

    async function subscribe() {
  try {
    console.log(`[Push Notifications] Starting subscription process...`);
    const reg = await waitForActiveSW();

    // Re-request permission if not granted
    console.log(`[Push Notifications] Requesting notification permission...`);
    const permission = await Notification.requestPermission();
    console.log(`[Push Notifications] Permission result: ${permission}`);
    if (permission !== "granted") {
      console.warn("[Push Notifications] Push permission denied");
      return;
    }

    //  Check for existing subscription and avoid duplicates
    console.log(`[Push Notifications] Checking for existing subscription...`);
    const oldSub = await reg.pushManager.getSubscription();
    console.log(`[Push Notifications] Existing subscription found: ${!!oldSub}`);
    if (oldSub) {

      // Check if subscription is already registered in backend
      console.log(`[Push Notifications] Checking backend for existing subscriptions...`);
      try {
        const response = await fetch(`${API_URL}/subscriptions/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log(`[Push Notifications] Backend check response: ${response.status}`);
        if (response.ok) {
          const stats = await response.json();
          const totalSubs = stats.total || 0;
          console.log(`[Push Notifications] Total subscriptions in backend: ${totalSubs}`);

          // If we have subscriptions, skip creating new one
          if (totalSubs > 0) {
            console.log(`[Push Notifications] Skipping new subscription, already exists in backend`);
            return;
          }
        }
      } catch (err) {
        console.warn("[Push Notifications] ⚠️ Could not check existing subscriptions:", err);
      }

      // Only unsubscribe if we're going to create a new one
      console.log(`[Push Notifications] Unsubscribing old subscription...`);
      await oldSub.unsubscribe();

    } else {
      console.log(`[Push Notifications] No existing subscription found`);
    }

    
    const convertedVapidKey = urlBase64ToUint8Array(VAPID_KEY);

    // Browser-specific subscription options for maximum compatibility
    const subscriptionOptions = {
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey,
    };

    // Browser-specific options
    if (isEdge && !isChrome) {
      
    }

    if (isFirefox) {
    }

    if (isSafari) {
    }

    console.log(`[Push Notifications] Attempting to subscribe with options:`, subscriptionOptions);
    let sub;
    try {
      sub = await reg.pushManager.subscribe(subscriptionOptions);
      console.log(`[Push Notifications] Subscription successful`);
      if (isEdge);
    } catch (subscriptionError) {
      console.error("[Push Notifications] ❌ Subscription failed:", subscriptionError);
      if (isEdge)

      // Fallback: try without VAPID for browsers that might not support it
      console.log(`[Push Notifications] Attempting fallback subscription (no VAPID)...`);
      if (isSafari || subscriptionError.name === 'NotSupportedError' || (isEdge && subscriptionError.name === 'InvalidStateError')) {

        if (isEdge)
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            // No applicationServerKey for fallback
          });
          console.log(`[Push Notifications] Fallback subscription successful`);
          if (isEdge);
        } catch (fallbackError) {
          console.error("[Push Notifications] ❌ Fallback subscription also failed:", fallbackError);
          if (isEdge)
          throw fallbackError;
        }
      } else {
        throw subscriptionError;
      }
    }

    const plainSub = sub.toJSON();
    console.log(`[Push Notifications] Sending subscription to backend...`);

    const response = await fetch(`${API_URL}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subscription: plainSub }),
    });
    console.log(`[Push Notifications] Backend response status: ${response.status}`);

  } catch (err) {
    console.error("[Push Notifications] ❌ Push subscribe error:", err);
  }
}

   
    subscribe();
  }, [token]);
}
