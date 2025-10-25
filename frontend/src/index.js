import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { AuthProvider } from "./context/AuthContext"; 
import { SocketProvider } from "./context/SocketProvider";
import { BrowserRouter } from "react-router-dom";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <App />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Register service worker
console.log(`[PWA] Registering service worker...`);
serviceWorkerRegistration.register();

// Listen for messages from service worker
if ("serviceWorker" in navigator) {
  console.log(`[PWA] Setting up service worker message listener`);
  navigator.serviceWorker.addEventListener("message", (event) => {
    console.log(`[PWA] Received message from SW:`, event.data);
    if (event.data?.type === "NEW_VERSION_AVAILABLE") {
      alert("🚀 A new version is available. Please refresh to update!");
    }
  });
} else {
  console.log(`[PWA] Service worker not supported in this browser`);
}

// Check PWA installation criteria
console.log(`[PWA] Checking PWA installation criteria...`);
console.log(`[PWA] HTTPS: ${window.location.protocol === 'https:'}`);
console.log(`[PWA] Service Worker: ${'serviceWorker' in navigator}`);
console.log(`[PWA] Manifest: ${!!document.querySelector('link[rel="manifest"]')}`);
console.log(`[PWA] Display mode: ${window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser'}`);
console.log(`[PWA] BeforeInstallPrompt event supported: ${'onbeforeinstallprompt' in window}`);
console.log(`[PWA] UserAgent: ${navigator.userAgent}`);

// Listen for appinstalled event
window.addEventListener('appinstalled', (e) => {
  console.log(`[PWA] App installed successfully`);
});

reportWebVitals();
