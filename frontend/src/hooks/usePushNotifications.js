import { useEffect } from "react";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const VAPID_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

// Converts base64 → UInt8Array (required for Edge & Firefox)
function urlBase64ToUint8Array(base64String) {
  if (!base64String) {
    throw new Error("Missing VAPID key");
  }
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
  // iOS detection function
  const isIOS = () => {
    if (typeof window === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone);
  };

  const isIOSDevice = isIOS();

  useEffect(() => {
    // Guard against missing token or environment
    if (!token) {
      return;
    }

    // Safe environment checks
    const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const hasPushManager = typeof window !== 'undefined' && 'PushManager' in window;

    if (!hasServiceWorker || !hasPushManager) {
      return;
    }

    //  Browser detection variables - order matters for proper detection
    const isEdge = /Edg\//.test(navigator.userAgent);
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);

    async function waitForActiveSW() {
      try {
        const reg = await navigator.serviceWorker.ready;
  
        if (reg.active?.state !== "activated") {
          return new Promise((resolve) => {
            const timeout = setTimeout(() => {
              resolve(reg);
            }, 10000);
  
            reg.active.addEventListener("statechange", (e) => {
              if (e.target.state === "activated") {
                clearTimeout(timeout);
                resolve();
              }
            });
          });
        }
        return reg;
      } catch (error) {
        throw error;
      }
    }

    async function subscribe() {
      try {
        const reg = await waitForActiveSW().catch(() => null);
  
        if (!reg) {
          return;
        }
  
        // Re-request permission if not granted
        const permission = await Notification.requestPermission();
  
        if (permission !== "granted") {
          return;
        }
  
        // Check for existing subscription and avoid duplicates
        const oldSub = await reg.pushManager.getSubscription();
  
        if (oldSub) {
          // Check backend stats (optional, don't fail if this errors)
          try {
            const response = await fetch(`${API_URL}/subscriptions/stats`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
              const stats = await response.json();
              const totalSubs = stats.total || 0;
    
              if (totalSubs > 0) {
                return;
              }
            }
          } catch (err) {
            // Silent fail for backend check
          }
  
          await oldSub.unsubscribe();
        }
  
        // Create subscription
        if (!VAPID_KEY) {
          return;
        }
  
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_KEY);
        const subscriptionOptions = {
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        };
  
        let sub;
        try {
          sub = await reg.pushManager.subscribe(subscriptionOptions);
        } catch (subscriptionError) {
          // Try fallback without VAPID for Safari
          if (isSafari || subscriptionError.name === 'NotSupportedError') {
            try {
              sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
              });
            } catch (fallbackError) {
              return;
            }
          } else {
            return;
          }
        }
  
        // Send to backend
        const plainSub = sub.toJSON();
        const response = await fetch(`${API_URL}/subscriptions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ subscription: plainSub }),
        });
  
        if (!response.ok) {
          // Silent fail for backend save
        }
  
      } catch (err) {
        // Silent fail for subscription errors
      }
    }
  
    subscribe().catch(() => {
      // Silent fail for subscription process
    });
  }, [token, isIOSDevice]);

  // Return expected values
  return {
    isIOSDevice,
    supportsNotifications: typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  };
}
