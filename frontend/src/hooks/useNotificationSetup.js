import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { isIOS, getIOSVersion, supportsWebPush } from '../utils/platformUtils';

export const useNotificationSetup = () => {
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [showIOSInstallBanner, setShowIOSInstallBanner] = useState(false);

  const dismissInstallBanner = () => {
    localStorage.setItem('iosInstallBannerDismissed', 'true');
    setShowIOSInstallBanner(false);
  };

  useEffect(() => {
    const canSupportPush = supportsWebPush();
    const notificationState = localStorage.getItem('notificationState');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSDevice = isIOS();
    const iOSVersion = getIOSVersion();

    // Handle iOS specific cases
    if (isIOSDevice && iOSVersion >= 16.4) {
      if (!isStandalone) {
        // Show iOS install banner if not installed
        setShowIOSInstallBanner(true);
        setShowNotificationBanner(false);
      } else if (Notification.permission === 'default' && !notificationState) {
        // Show notification banner only after installed
        setShowIOSInstallBanner(false);
        setShowNotificationBanner(true);
      }
    } else if (!canSupportPush) {
      // Device doesn't support push notifications
      toast.error(
        "Your device or browser doesn't support push notifications. You'll still see updates when the app is open.",
        {
          duration: 6000,
          icon: '📱'
        }
      );
      localStorage.setItem('notificationState', 'unsupported');
    } else if (Notification.permission === 'default' && !notificationState) {
      // Show notification banner for other supported devices
      setShowNotificationBanner(true);
    }
  }, []);

  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success('Notifications enabled! You\'ll receive updates about your tasks.');
      }
      setShowNotificationBanner(false);
      localStorage.setItem('notificationState', permission);
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const dismissNotificationBanner = () => {
    setShowNotificationBanner(false);
    localStorage.setItem('notificationState', 'dismissed');
  };

  return {
    showNotificationBanner,
    showIOSInstallBanner,
    requestNotificationPermission,
    dismissNotificationBanner,
    dismissInstallBanner
  };
};