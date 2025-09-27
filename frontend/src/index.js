import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { AuthProvider } from "./context/AuthContext"; 
import { SocketProvider } from "./context/SocketProvider";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <SocketProvider>
      <App />
      </SocketProvider>
    </AuthProvider>
  </React.StrictMode>
);

// Register service worker
serviceWorkerRegistration.register();

// Listen for messages from service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "NEW_VERSION_AVAILABLE") {
      alert("🚀 A new version is available. Please refresh to update!");
      // TODO: replace alert with your toast/snackbar UI
    }
  });
}

reportWebVitals();
