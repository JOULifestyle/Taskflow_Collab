
const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(
    /^127(?:\.(?:25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/
  )
);

export function register(config) {
  // Guard against missing navigator or service worker support
  if (!navigator || typeof navigator.serviceWorker === 'undefined') {
    console.log('[SW Registration] Service worker not supported');
    return;
  }

  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

    if (isLocalhost) {
      checkValidServiceWorker(swUrl, config);
    } else {
      registerValidSW(swUrl, config);
    }
  }
}

function registerValidSW(swUrl, config) {
  console.log('[SW Registration] Registering service worker');
  
  try {
    navigator.serviceWorker
      .register(swUrl, {
        scope: './'
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
                  console.log('[SW Registration] New content available');
                  if (config && config.onUpdate) {
                    config.onUpdate(registration);
                  }
                } else {
                  console.log('[SW Registration] Content cached');
                  if (config && config.onSuccess) {
                    config.onSuccess(registration);
                  }
                }
              }
            };
          }
        };
      })
      .catch((error) => {
        console.error('[SW Registration] SW registration failed:', error);
      });
  } catch (error) {
    console.log('[SW Registration] SW registration error:', error.message);
  }
}

function checkValidServiceWorker(swUrl, config) {
  try {
    fetch(swUrl, {
      headers: { 'Service-Worker': 'script' },
    })
      .then((response) => {
        const contentType = response.headers.get('content-type');
        if (
          response.status === 404 ||
          (contentType != null && contentType.indexOf('javascript') === -1)
        ) {
          console.log('[SW Registration] Invalid SW, unregistering');
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
        console.log('[SW Registration] SW fetch failed:', error.message);
      });
  } catch (error) {
    console.log('[SW Registration] SW check error:', error.message);
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    return navigator.serviceWorker.ready
      .then((registration) => registration.unregister())
      .catch((error) => console.error(error));
  }
  return Promise.resolve(); // Return a resolved promise if no service worker support
}
