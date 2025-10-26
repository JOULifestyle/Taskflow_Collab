
const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/
  )
);

// Detect mobile devices
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
console.log(`[SW Registration] Mobile device detected: ${isMobile}, UserAgent: ${navigator.userAgent}`);

export function register(config) {
  console.log(`[SW Registration] Attempting to register SW. Production: ${process.env.NODE_ENV === 'production'}, SW supported: ${'serviceWorker' in navigator}, IsLocalhost: ${isLocalhost}`);
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

    if (isLocalhost) {
      checkValidServiceWorker(swUrl, config);
    } else {
      registerValidSW(swUrl, config);
    }
  } else {
    console.log(`[SW Registration] Skipping SW registration: Not production or SW not supported`);
  }
}

function registerValidSW(swUrl, config) {
  console.log(`[SW Registration] Registering SW at URL: ${swUrl}`);
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log(`[SW Registration] SW registered successfully. Scope: ${registration.scope}, Active: ${!!registration.active}, Installing: ${!!registration.installing}, Waiting: ${!!registration.waiting}`);

      registration.onupdatefound = () => {
        console.log(`[SW Registration] Update found event triggered`);
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            console.log(`[SW Registration] Installing worker state changed to: ${installingWorker.state}`);
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log(`[SW Registration] New SW installed and controlling clients`);
              } else {
                console.log(`[SW Registration] SW installed but not yet controlling clients`);
              }
            }
          };
        }
      };
    })
    .catch((error) => {
      console.error('[SW Registration] SW registration failed:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  console.log(`[SW Registration] Checking valid SW at URL: ${swUrl}`);
  fetch(swUrl)
    .then((response) => {
      console.log(`[SW Registration] SW fetch response status: ${response.status}, Content-Type: ${response.headers.get('content-type')}`);
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        console.log(`[SW Registration] Invalid SW detected, unregistering and reloading`);
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        console.log(`[SW Registration] SW is valid, proceeding to register`);
        registerValidSW(swUrl, config);
      }
    })
    .catch((error) => {
      console.log('[SW Registration] No internet connection or fetch failed. Running in offline mode.', error);
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
