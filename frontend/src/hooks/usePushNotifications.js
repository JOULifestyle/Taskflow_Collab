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
    
    if (!token || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      
      return;
    }

    //  Browser detection variables - order matters for proper detection
    const isEdge = /Edg\//.test(navigator.userAgent);
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);

    
    if (isEdge) {
    }


    async function waitForActiveSW() {
      const reg = await navigator.serviceWorker.ready;

    
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

    // Re-request permission if not granted
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Push permission denied");
      return;
    }

    //  Check for existing subscription and avoid duplicates
    const oldSub = await reg.pushManager.getSubscription();
    if (oldSub) {
      
      

      // Check if subscription is already registered in backend
      try {
        const response = await fetch(`${API_URL}/subscriptions/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const stats = await response.json();
          const totalSubs = stats.total || 0;
          

          // If we have subscriptions, skip creating new one
          if (totalSubs > 0) {
            
            return;
          }
        }
      } catch (err) {
        console.warn("⚠️ Could not check existing subscriptions:", err);
      }

      // Only unsubscribe if we're going to create a new one
      await oldSub.unsubscribe();
      
    } else {
    
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

    let sub;
    try {
      sub = await reg.pushManager.subscribe(subscriptionOptions);
      if (isEdge);
    } catch (subscriptionError) {
      console.error("❌ Subscription failed:", subscriptionError);
      if (isEdge)

      // Fallback: try without VAPID for browsers that might not support it
      if (isSafari || subscriptionError.name === 'NotSupportedError' || (isEdge && subscriptionError.name === 'InvalidStateError')) {
        
        if (isEdge)
        try {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            // No applicationServerKey for fallback
          });
        
          if (isEdge);
        } catch (fallbackError) {
          console.error("❌ Fallback subscription also failed:", fallbackError);
          if (isEdge)
          throw fallbackError;
        }
      } else {
        throw subscriptionError;
      }
    }

    const plainSub = sub.toJSON();

   
    await fetch(`${API_URL}/subscriptions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ subscription: plainSub }),
    });

    
  } catch (err) {
    console.error("❌ Push subscribe error:", err);
  }
}

   
    subscribe();
  }, [token]);
}
