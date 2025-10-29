import { useEffect } from "react";

// Enhanced iOS diagnostic logging
const debugLog = (level, message, data = {}) => {
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
  // Store in sessionStorage for debugging
  sessionStorage.setItem(`ios_debug_${Date.now()}`, JSON.stringify(logEntry));
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
  useEffect(() => {
    debugLog('INFO', 'usePushNotifications effect starting', { token: !!token });

    if (!token || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      debugLog('ERROR', 'Missing prerequisites for push notifications', {
        hasToken: !!token,
        hasServiceWorker: "serviceWorker" in navigator,
        hasPushManager: "PushManager" in window
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
      userAgent: navigator.userAgent
    });

    if (isEdge) {
      debugLog('INFO', 'Edge browser detected');
    }

    if (isSafari) {
      debugLog('WARN', 'Safari browser detected - iOS push notifications have known issues');
    }

    async function waitForActiveSW() {
      debugLog('INFO', 'Waiting for active service worker');
      const reg = await navigator.serviceWorker.ready;

      debugLog('INFO', 'Service worker ready', {
        state: reg.active?.state,
        scope: reg.scope
      });

      if (reg.active?.state !== "activated") {
        debugLog('WARN', 'Service worker not activated yet, waiting...');
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("SW activation timeout"));
          }, 10000);

          reg.active.addEventListener("statechange", (e) => {
            debugLog('INFO', 'Service worker state changed', { newState: e.target.state });
            if (e.target.state === "activated") {
              clearTimeout(timeout);
              resolve();
            }
          });
        });
      }
      debugLog('SUCCESS', 'Service worker activated');
      return reg;
    }

    async function subscribe() {
      debugLog('INFO', 'Starting subscription process');
      
      try {
        const reg = await waitForActiveSW().catch((error) => {
          debugLog('ERROR', 'Failed to wait for active SW', { error: error.message });
          throw error;
        });

        debugLog('SUCCESS', 'Service worker ready for subscription');

        // Re-request permission if not granted
        debugLog('INFO', 'Current notification permission', { permission: Notification.permission });
        const permission = await Notification.requestPermission();
        debugLog('INFO', 'Notification permission requested', { permission });

        if (permission !== "granted") {
          debugLog('ERROR', 'Push permission denied', { permission });
          // Don't return here - let the user know they need to enable notifications
          // Show a user-friendly message instead of just logging
          if (typeof window.alert === 'function') {
            alert("To receive notifications, please enable notifications for this site in your browser settings and refresh the page.");
          }
          return;
        }

        debugLog('SUCCESS', 'Notification permission granted');

        //  Check for existing subscription and avoid duplicates
        const oldSub = await reg.pushManager.getSubscription();
        debugLog('INFO', 'Checked for existing subscription', { hasExisting: !!oldSub });

        if (oldSub) {
          debugLog('INFO', 'Existing subscription found, checking backend stats');
          
          // Check if subscription is already registered in backend
          try {
            const response = await fetch(`${API_URL}/subscriptions/stats`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.ok) {
              const stats = await response.json();
              const totalSubs = stats.total || 0;
              debugLog('INFO', 'Backend subscription stats', { totalSubs, stats });

              // If we have subscriptions, skip creating new one
              if (totalSubs > 0) {
                debugLog('SUCCESS', 'Already have subscriptions in backend, skipping');
                return;
              }
            } else {
              debugLog('WARN', 'Failed to fetch subscription stats', { status: response.status });
            }
          } catch (err) {
            debugLog('ERROR', 'Error checking subscription stats', { error: err.message });
          }

          debugLog('INFO', 'Unsubscribing from old subscription');
          // Only unsubscribe if we're going to create a new one
          await oldSub.unsubscribe();
          debugLog('SUCCESS', 'Unsubscribed from old subscription');
        }

        
        debugLog('INFO', 'Converting VAPID key', { hasVapidKey: !!VAPID_KEY });
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_KEY);

        // Browser-specific subscription options for maximum compatibility
        const subscriptionOptions = {
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        };

        debugLog('INFO', 'Subscription options prepared', {
          isSafari,
          hasVapidKey: !!convertedVapidKey,
          options: { ...subscriptionOptions, applicationServerKey: '[REDACTED]' }
        });

        // Browser-specific options
        if (isEdge && !isChrome) {
          debugLog('INFO', 'Applying Edge-specific options');
        }

        if (isFirefox) {
          debugLog('INFO', 'Applying Firefox-specific options');
        }

        if (isSafari) {
          debugLog('WARN', 'Safari detected - will try fallback without VAPID if needed');
        }

        let sub;
        try {
          debugLog('INFO', 'Attempting subscription with VAPID key');
          sub = await reg.pushManager.subscribe(subscriptionOptions);
          debugLog('SUCCESS', 'Subscription successful with VAPID key');
        } catch (subscriptionError) {
          debugLog('ERROR', 'VAPID subscription failed', {
            error: subscriptionError.message,
            name: subscriptionError.name,
            isSafari,
            isNotSupported: subscriptionError.name === 'NotSupportedError',
            isInvalidState: subscriptionError.name === 'InvalidStateError'
          });

          // Fallback: try without VAPID for browsers that might not support it
          if (isSafari || subscriptionError.name === 'NotSupportedError' || (isEdge && subscriptionError.name === 'InvalidStateError')) {
            debugLog('INFO', 'Trying fallback subscription without VAPID');
            try {
              const fallbackOptions = {
                userVisibleOnly: true,
                // No applicationServerKey for fallback
              };
              debugLog('INFO', 'Fallback subscription options', { options: fallbackOptions });
              
              sub = await reg.pushManager.subscribe(fallbackOptions);
              debugLog('SUCCESS', 'Fallback subscription successful');
            } catch (fallbackError) {
              debugLog('ERROR', 'Fallback subscription also failed', {
                error: fallbackError.message,
                name: fallbackError.name
              });
              throw fallbackError;
            }
          } else {
            debugLog('ERROR', 'Not attempting fallback - error type not supported', { errorType: subscriptionError.name });
            throw subscriptionError;
          }
        }

        const plainSub = sub.toJSON();
        debugLog('INFO', 'Subscription object created', {
          endpoint: plainSub.endpoint?.substring(0, 50) + '...',
          hasKeys: !!plainSub.keys
        });

        debugLog('INFO', 'Sending subscription to backend');
        const response = await fetch(`${API_URL}/subscriptions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ subscription: plainSub }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          debugLog('ERROR', 'Backend subscription failed', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          throw new Error(`Backend subscription failed: ${response.status}`);
        }

        const result = await response.json();
        debugLog('SUCCESS', 'Subscription saved to backend', { result });

      } catch (err) {
        debugLog('ERROR', 'Push subscribe error', {
          error: err.message,
          stack: err.stack,
          isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
          isSafari
        });
        console.error("[Push Notifications] ❌ Push subscribe error:", err);
      }
    }

    // Call the subscription function
    subscribe();
  }, [token]);
}
