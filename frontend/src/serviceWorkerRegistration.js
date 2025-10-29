
const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/
  )
);

// Detect mobile devices and iOS
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

export function register(config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

    if (isLocalhost) {
      checkValidServiceWorker(swUrl, config);
    } else {
      registerValidSW(swUrl, config);
    }
  } else {
  }
}

function registerValidSW(swUrl, config) {
  console.log('[SW Registration] Registering service worker...');
  
  navigator.serviceWorker
    .register(swUrl, {
      scope: './',
      // Add updateviacache for better iOS support
      type: 'classic'
    })
    .then((registration) => {
      console.log('[SW Registration] SW registered successfully', {
        scope: registration.scope,
        state: registration.active?.state
      });

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[SW Registration] New content available; please refresh.');
                if (config && config.onUpdate) {
                  config.onUpdate(registration);
                }
              } else {
                console.log('[SW Registration] Content is cached for offline use.');
                if (config && config.onSuccess) {
                  config.onSuccess(registration);
                }
              }
            }
          };
        }
      };

      // Enhanced iOS support: wait for active state
      if (isIOS) {
        if (registration.active?.state !== 'activated') {
          console.log('[SW Registration] iOS detected, waiting for SW activation...');
          registration.installing?.addEventListener('statechange', (e) => {
            if (e.target.state === 'activated') {
              console.log('[SW Registration] iOS SW activated successfully');
            }
          });
        }
      }
    })
    .catch((error) => {
      console.error('[SW Registration] SW registration failed:', error);
      
      // iOS-specific error handling
      if (isIOS && error.message.includes('Failed to register')) {
        console.log('[SW Registration] iOS registration failed - might need HTTPS and PWA installation');
      }
    });
}

function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        console.log('[SW Registration] Invalid SW, unregistering...');
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch((error) => {
      console.log('[SW Registration] No internet connection, SW registration failed');
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    return navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch((error) => console.error(error));
  }
  return Promise.resolve(); // Return a resolved promise if no service worker support
}
