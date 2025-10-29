// iOS PWA Notification Debugging Utilities
export const clearNotificationState = () => {
  // Clear all notification-related localStorage
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('notification') || key.includes('ios_debug') || key.includes('sw') || key.includes('subscription'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Clear sessionStorage debug logs
  const sessionKeysToRemove = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.includes('ios_debug')) {
      sessionKeysToRemove.push(key);
    }
  }
  sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
  
  console.log('🧹 Cleared notification state and debug logs');
};

export const testNotificationSubscription = async () => {
  console.log('🔍 Testing notification subscription...');
  
  try {
    // Check current permission
    console.log('Current permission:', Notification.permission);
    
    // Test permission request
    if (Notification.permission === 'default') {
      console.log('Requesting permission...');
      const permission = await Notification.requestPermission();
      console.log('Permission result:', permission);
    }
    
    // Test service worker
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      console.log('Service worker ready:', {
        scope: reg.scope,
        active: !!reg.active,
        activeState: reg.active?.state
      });
      
      // Test subscription
      let sub = await reg.pushManager.getSubscription();
      console.log('Existing subscription:', !!sub);
      
      if (!sub && Notification.permission === 'granted') {
        console.log('Creating new subscription...');
        const vapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
        const convertedKey = vapidKey ? urlBase64ToUint8Array(vapidKey) : null;
        
        const options = {
          userVisibleOnly: true,
          ...(convertedKey && { applicationServerKey: convertedKey })
        };
        
        console.log('Subscription options:', { ...options, applicationServerKey: convertedKey ? '[PRESENT]' : '[MISSING]' });
        
        try {
          sub = await reg.pushManager.subscribe(options);
          console.log('✅ Subscription created successfully');
          console.log('Endpoint:', sub.endpoint.substring(0, 100) + '...');
        } catch (error) {
          console.log('❌ Subscription failed:', error.name, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
};

export const getNotificationDebugInfo = () => {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isStandalone: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone,
    permission: Notification.permission,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    https: window.location.protocol === 'https:',
    hostname: window.location.hostname,
    localStorage: {
      notificationState: localStorage.getItem('notificationState'),
      iosInstallBannerDismissed: localStorage.getItem('iosInstallBannerDismissed'),
      hasVapidKey: !!process.env.REACT_APP_VAPID_PUBLIC_KEY
    }
  };
  
  return debugInfo;
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Make functions available globally for console debugging
if (typeof window !== 'undefined') {
  window.clearNotificationState = clearNotificationState;
  window.testNotificationSubscription = testNotificationSubscription;
  window.getNotificationDebugInfo = getNotificationDebugInfo;
  
  console.log('🔧 Notification debug functions available:');
  console.log('- clearNotificationState() - Clear all notification state');
  console.log('- testNotificationSubscription() - Test subscription process');
  console.log('- getNotificationDebugInfo() - Get current debug info');
}