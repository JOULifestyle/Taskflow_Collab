import React, { useState, useEffect } from 'react';
import './InstallPrompt.css';
import { isIOS, isInStandaloneMode } from '../utils/platformUtils';

const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOSDevice] = useState(isIOS());
  const [isStandalone, setIsStandalone] = useState(isInStandaloneMode());

  useEffect(() => {
    // Show iOS prompt immediately if not installed
    if (isIOSDevice && !isStandalone) {
      setShowPrompt(true);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    const handleAppInstalled = (e) => {
      setShowPrompt(false);
      setIsStandalone(true);
    };

    const handleDisplayModeChange = (e) => {
      setIsStandalone(isInStandaloneMode());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.matchMedia('(display-mode: standalone)').addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
    
        // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="install-prompt-overlay">
      <div className="install-prompt">
        <div className="install-prompt-content">
          <h3>Install Taskflow Collab App</h3>
          {isIOSDevice ? (
            <>
              <p>To install this app on your iOS device:</p>
              <ol className="ios-instructions">
                <li>Tap the Share button in Safari <span className="ios-icon">􀈂</span></li>
                <li>Scroll down and tap "Add to Home Screen" <span className="ios-icon">+</span></li>
                <li>Tap "Add" in the top right</li>
              </ol>
              <div className="install-prompt-buttons">
                <button onClick={handleDismiss} className="dismiss-button">
                  Got it
                </button>
              </div>
            </>
          ) : (
            <>
              <p>Add this app to your home screen for a better experience!</p>
              <div className="install-prompt-buttons">
                <button onClick={handleInstallClick} className="install-button">
                  Install App
                </button>
                <button onClick={handleDismiss} className="dismiss-button">
                  Not Now
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstallPrompt;