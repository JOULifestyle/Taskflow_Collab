import { useEffect } from "react";

// Safe iOS diagnostic logging - wrapped in try/catch to prevent crashes
const debugLog = (level, message, data = {}) => {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      userAgent: navigator.userAgent,
      isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
      isStandalone: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone,
      notificationPermission: Notification.permission,
      serviceWorkerSupported: 'serviceWorker' in navigator,
      pushManagerSupported: 'PushManager' in window
    };
    
    console.log(`[iOS DEBUG ${level}]`, message, logEntry);
    
    // Safely store in sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(`ios_debug_${Date.now()}`, JSON.stringify(logEntry));
    }
  } catch (error) {
    // Silently fail to prevent app crashes
    console.log('[iOS DEBUG] Logging failed:', error.message);
  }
};

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";
const VAPID_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

// Converts base64 → UInt8Array (required for Edge & Firefox)
function urlBase64ToUint8Array(base64String) {
  if (!base64String) {
    debugLog('ERROR', 'Missing VAPID key');
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
  debugLog('INFO', 'VAPID key converted successfully', { keyLength: base64String.length });
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
      console.log('[Push Notifications] No token available');
      return;
    }

    // Safe environment checks
    const hasServiceWorker = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
    const hasPushManager = typeof window !== 'undefined' && 'PushManager' in window;

    if (!hasServiceWorker || !hasPushManager) {
      console.log('[Push Notifications] Missing prerequisites', {
        hasServiceWorker,
        hasPushManager
      });
      return;
    }

    //  Browser detection variables - order matters for proper detection
    const isEdge = /Edg\//.test(navigator.userAgent);
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);
    const isFirefox = /Firefox/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);

    debugLog('INFO', 'Browser detection', {
      isEdge,
      isChrome,
      isFirefox,
      isSafari,
      userAgent: navigator.userAgent,
      isIOSDevice
    });

    if (isEdge) {
      debugLog('INFO', 'Edge browser detected');
    }

    if (isSafari) {
      console.log('[Push Notifications] Safari browser detected');
    }
    
    async function waitForActiveSW() {
      console.log('[Push Notifications] Waiting for service worker');
      try {
        const reg = await navigator.serviceWorker.ready;
  
        console.log('[Push Notifications] Service worker ready', {
          state: reg.active?.state,
          scope: reg.scope
        });
  
        if (reg.active?.state !== "activated") {
          console.log('[Push Notifications] Service worker not activated yet');
          return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              resolve(reg); // Resolve instead of reject to prevent crashes
            }, 10000);
  
            reg.active.addEventListener("statechange", (e) => {
              console.log('[Push Notifications] Service worker state changed', { newState: e.target.state });
              if (e.target.state === "activated") {
                clearTimeout(timeout);
                resolve();
              }
            });
          });
        }
        console.log('[Push Notifications] Service worker activated');
        return reg;
      } catch (error) {
        console.log('[Push Notifications] Service worker wait failed:', error.message);
        throw error;
      }
    }

    async function subscribe() {
      console.log('[Push Notifications] Starting subscription process');
      
      try {
        const reg = await waitForActiveSW().catch((error) => {
          console.log('[Push Notifications] Failed to wait for SW:', error.message);
          return null; // Return null instead of throwing
        });
  
        if (!reg) {
          console.log('[Push Notifications] No service worker registration');
          return;
        }
  
        console.log('[Push Notifications] Service worker ready for subscription');
  
        // Re-request permission if not granted
        console.log('[Push Notifications] Current permission:', Notification.permission);
        const permission = await Notification.requestPermission();
        console.log('[Push Notifications] Permission requested:', permission);
  
        if (permission !== "granted") {
          console.log('[Push Notifications] Permission denied');
          return;
        }
  
        console.log('[Push Notifications] Permission granted');
  
        // Check for existing subscription and avoid duplicates
        const oldSub = await reg.pushManager.getSubscription();
        console.log('[Push Notifications] Existing subscription:', !!oldSub);
  
        if (oldSub) {
          // Check backend stats (optional, don't fail if this errors)
          try {
            const response = await fetch(`${API_URL}/subscriptions/stats`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
              const stats = await response.json();
              const totalSubs = stats.total || 0;
              console.log('[Push Notifications] Backend subscriptions:', totalSubs);
    
              if (totalSubs > 0) {
                console.log('[Push Notifications] Already subscribed, skipping');
                return;
              }
            }
          } catch (err) {
            console.log('[Push Notifications] Backend check failed:', err.message);
          }
  
          console.log('[Push Notifications] Cleaning up old subscription');
          await oldSub.unsubscribe();
        }
  
        // Create subscription
        if (!VAPID_KEY) {
          console.log('[Push Notifications] No VAPID key available');
          return;
        }
  
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_KEY);
        const subscriptionOptions = {
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        };
  
        let sub;
        try {
          console.log('[Push Notifications] Attempting subscription');
          sub = await reg.pushManager.subscribe(subscriptionOptions);
          console.log('[Push Notifications] Subscription successful');
        } catch (subscriptionError) {
          console.log('[Push Notifications] VAPID subscription failed:', subscriptionError.name);
  
          // Try fallback without VAPID for Safari
          if (isSafari || subscriptionError.name === 'NotSupportedError') {
            console.log('[Push Notifications] Trying fallback subscription');
            try {
              sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
              });
              console.log('[Push Notifications] Fallback subscription successful');
            } catch (fallbackError) {
              console.log('[Push Notifications] Fallback also failed:', fallbackError.name);
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
  
        if (response.ok) {
          console.log('[Push Notifications] Subscription saved to backend');
        } else {
          console.log('[Push Notifications] Backend save failed:', response.status);
        }
  
      } catch (err) {
        console.log('[Push Notifications] Subscription error:', err.message);
      }
    }
  
    // Safely call the subscription function
    subscribe().catch((error) => {
      console.log('[Push Notifications] Subscription process failed:', error.message);
    });
  }, [token, isIOSDevice]);

  // Return expected values
  return {
    isIOSDevice,
    supportsNotifications: typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window
  };
}
