import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketProvider";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";

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
    <Toaster />
  </React.StrictMode>
);

// Register service worker
serviceWorkerRegistration.unregister().then(() => {
  serviceWorkerRegistration.register();
}).catch((error) => {
  console.error('[PWA] Error during SW unregister/register process:', error);
});

// Listen for messages from service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "NEW_VERSION_AVAILABLE") {
      alert("🚀 A new version is available. Please refresh to update!");
    }
  });
}


// Listen for appinstalled event
window.addEventListener('appinstalled', (e) => {
});

reportWebVitals();
