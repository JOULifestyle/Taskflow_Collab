import React, { useState, useEffect } from 'react';
import { isIOS, getIOSVersion, supportsWebPush } from '../utils/platformUtils';

const NotificationDiagnostics = () => {
  const [diagnostics, setDiagnostics] = useState({});
  const [logs, setLogs] = useState([]);

  const addLog = (message, data = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      data
    };
    setLogs(prev => [...prev, logEntry]);
    console.log('[Notification Diagnostics]', message, data);
  };

  const runDiagnostics = async () => {
    addLog('Starting diagnostics...');

    // Basic environment checks
    const basicInfo = {
      userAgent: navigator.userAgent,
      isIOS: isIOS(),
      iOSVersion: getIOSVersion(),
      isStandalone: window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone,
      notificationPermission: Notification.permission,
      serviceWorkerSupported: 'serviceWorker' in navigator,
      pushManagerSupported: 'PushManager' in window,
      https: window.location.protocol === 'https:',
      hostname: window.location.hostname
    };

    addLog('Basic environment info', basicInfo);

    // Push support check
    const pushSupport = {
      supportsWebPush: supportsWebPush(),
      canRequestPermission: Notification.permission !== 'denied'
    };

    addLog('Push support check', pushSupport);

    // Service worker check
    let swInfo = {};
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        swInfo = {
          registered: true,
          scope: reg.scope,
          active: !!reg.active,
          activeState: reg.active?.state,
          waiting: !!reg.waiting
        };
      } catch (error) {
        swInfo = { registered: false, error: error.message };
      }
    } else {
      swInfo = { registered: false, reason: 'ServiceWorker not supported' };
    }

    addLog('Service worker info', swInfo);

    // VAPID key check
    const vapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
    addLog('VAPID key check', {
      hasVapidKey: !!vapidKey,
      keyLength: vapidKey?.length || 0,
      keyPrefix: vapidKey?.substring(0, 20) + '...' || 'none'
    });

    // Notification permission test
    if (Notification.permission === 'default') {
      addLog('Testing notification permission request...');
      try {
        const permission = await Notification.requestPermission();
        addLog('Permission request result', { permission });
      } catch (error) {
        addLog('Permission request failed', { error: error.message });
      }
    }

    // Push subscription test (if permission granted)
    if (Notification.permission === 'granted' && swInfo.registered && pushSupport.supportsWebPush) {
      addLog('Testing push subscription...');
      try {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        
        if (!sub) {
          addLog('No existing subscription found, testing subscription creation...');
          const convertedVapidKey = vapidKey ? 
            urlBase64ToUint8Array(vapidKey) : null;
          
          const subscriptionOptions = {
            userVisibleOnly: true,
            ...(convertedVapidKey && { applicationServerKey: convertedVapidKey })
          };

          addLog('Subscription options', { 
            ...subscriptionOptions, 
            applicationServerKey: convertedVapidKey ? '[PRESENT]' : '[MISSING]' 
          });

          try {
            sub = await reg.pushManager.subscribe(subscriptionOptions);
            addLog('✅ Push subscription successful', {
              endpoint: sub.endpoint.substring(0, 50) + '...',
              hasKeys: !!sub.toJSON().keys
            });
          } catch (subError) {
            addLog('❌ Push subscription failed', {
              name: subError.name,
              message: subError.message
            });

            // Try fallback without VAPID for Safari
            if (isIOS() || subError.name === 'NotSupportedError') {
              addLog('Trying fallback subscription without VAPID...');
              try {
                sub = await reg.pushManager.subscribe({ userVisibleOnly: true });
                addLog('✅ Fallback subscription successful', {
                  endpoint: sub.endpoint.substring(0, 50) + '...',
                  hasKeys: !!sub.toJSON().keys
                });
              } catch (fallbackError) {
                addLog('❌ Fallback subscription also failed', {
                  name: fallbackError.name,
                  message: fallbackError.message
                });
              }
            }
          }
        } else {
          addLog('Existing subscription found', {
            endpoint: sub.endpoint.substring(0, 50) + '...',
            hasKeys: !!sub.toJSON().keys
          });
        }
      } catch (error) {
        addLog('❌ Push subscription test failed', { error: error.message });
      }
    }

    setDiagnostics({ basicInfo, pushSupport, swInfo });
  };

  const urlBase64ToUint8Array = (base64String) => {
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
  };

  const exportLogs = () => {
    const logData = {
      diagnostics,
      logs,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notification-diagnostics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getRecommendations = () => {
    const recs = [];
    
    if (!diagnostics.basicInfo?.https) {
      recs.push('🔴 CRITICAL: Site must be served over HTTPS for push notifications to work on iOS');
    }
    
    if (!diagnostics.basicInfo?.isIOS) {
      recs.push('ℹ️ Not on iOS - these diagnostics are for iOS-specific issues');
    }
    
    if (diagnostics.basicInfo?.iOSVersion && diagnostics.basicInfo.iOSVersion < 16.4) {
      recs.push('🔴 iOS version too old - iOS 16.4+ required for web push notifications');
    }
    
    if (!diagnostics.basicInfo?.isStandalone) {
      recs.push('ℹ️ App not installed as PWA - install it for better push notification support');
    }
    
    if (diagnostics.basicInfo?.notificationPermission === 'denied') {
      recs.push('🔴 Notifications blocked - user must enable them in Safari Settings > [Your Site]');
    }
    
    if (!diagnostics.pushSupport?.supportsWebPush) {
      recs.push('🔴 Push not supported - check iOS version and HTTPS');
    }
    
    if (!diagnostics.swInfo?.registered) {
      recs.push('🔴 Service Worker not registered - check network and HTTPS');
    }

    return recs;
  };

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'monospace', 
      backgroundColor: '#f5f5f5',
      border: '1px solid #ddd',
      borderRadius: '8px',
      margin: '10px'
    }}>
      <h3>🔍 iOS PWA Notification Diagnostics</h3>
      
      <button 
        onClick={runDiagnostics}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        Run Diagnostics
      </button>

      {logs.length > 0 && (
        <div>
          <h4>📋 Recommendations:</h4>
          <ul>
            {getRecommendations().map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>

          <h4>📝 Detailed Logs:</h4>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '10px', 
            borderRadius: '4px',
            maxHeight: '300px',
            overflowY: 'auto',
            fontSize: '12px'
          }}>
            {logs.map((log, index) => (
              <div key={index} style={{ marginBottom: '5px' }}>
                <strong>{log.timestamp}:</strong> {log.message}
                {log.data && (
                  <pre style={{ margin: '5px 0', fontSize: '10px' }}>
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>

          <button 
            onClick={exportLogs}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Export Diagnostic Data
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationDiagnostics;