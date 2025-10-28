// Detect iOS devices
export const getIOSVersion = () => {
  const userAgent = navigator.userAgent;
  const match = userAgent.match(/OS (\d+)_(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
};

export const isIOS = () => {
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod'
  ].includes(navigator.platform)
  // iPad on iOS 13+ detection
  || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
};

export const supportsWebPush = () => {
  const isIOSDevice = isIOS();
  const iOSVersion = getIOSVersion();
  
  // iOS 16.4+ supports web push
  if (isIOSDevice && iOSVersion >= 16.4) {
    return true;
  }
  
  // Check general web push support for other platforms
  return 'serviceWorker' in navigator && 'PushManager' in window;
};

// Detect standalone mode (installed PWA)
export const isInStandaloneMode = () =>
  (window.matchMedia('(display-mode: standalone)').matches) ||
  (window.navigator.standalone) ||
  document.referrer.includes('android-app://');