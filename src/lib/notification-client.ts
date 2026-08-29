/**
 * Comprehensive Client Notification Manager for Mobile & Web (Web-Push / FCM / ServiceWorker / PWA).
 */

import { playNotificationSoundAndVibrate, SIKKA_VIBRATION_PATTERN } from '@/lib/notification-sound';
import { isNativeAndroid, postNativeNotification } from '@/lib/android-bridge';

const SIKKA_LOGO = '/sikka-logo.png';

export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BIZhkoYnicqfnaDuT-C5egEnM_OnnYauDQnT7_jZbAOnYp9MrxsNfU3BK0fTVw9mPYsF28ZqjSjDPH8BHyGZnmk';

export interface DeviceRegistrationPayload {
  token: string;
  employeeId: string;
  role: string;
  deviceName?: string;
  platform?: string;
  subscription?: PushSubscriptionJSON | null;
}

/**
 * Utility to convert VAPID base64 public key to Uint8Array for pushManager subscription
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Gets or creates a persistent device ID in localStorage.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('sikka_device_id');
  if (!id) {
    id = 'device_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
    localStorage.setItem('sikka_device_id', id);
  }
  return id;
}

/**
 * Checks the current notification permission status.
 */
export function getNotificationPermissionStatus(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Register Service Worker if supported.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;

    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn('Service Worker registration note:', err);
    try {
      return await navigator.serviceWorker.ready;
    } catch {
      return null;
    }
  }
}

/**
 * Subscribes the client device to Web-Push with VAPID Public Key and registers subscription in MongoDB.
 */
export async function syncDeviceWithBackend(user: any): Promise<boolean> {
  try {
    const deviceId = getOrCreateDeviceId();
    const employeeId = user?.employeeId || user?.username || user?.id || '';
    const role = user?.role || 'EMPLOYEE';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);

    let pushSubscriptionJson: PushSubscriptionJSON | null = null;

    // If Service Worker & PushManager are supported and permission is granted, obtain Web-Push subscription
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        const reg = await registerServiceWorker();
        if (reg && 'pushManager' in reg) {
          let sub = await reg.pushManager.getSubscription();
          if (!sub && VAPID_PUBLIC_KEY) {
            const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: convertedVapidKey as unknown as BufferSource,
            });
          }
          if (sub) {
            pushSubscriptionJson = sub.toJSON();
          }
        }
      } catch (subErr) {
        console.warn('Web-Push subscription negotiation skipped/deferred:', subErr);
      }
    }

    const payload: DeviceRegistrationPayload = {
      token: deviceId,
      employeeId,
      role,
      deviceName: isMobile ? 'Mobile Browser / APK Web' : 'Desktop Browser',
      platform: isMobile ? 'android-web' : 'web',
      subscription: pushSubscriptionJson,
    };

    const res = await fetch('/api/notifications/register-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch (e) {
    console.warn('Device registration sync failed:', e);
    return false;
  }
}

/**
 * Request notification permission from user, register service worker, subscribe with VAPID keys,
 * sync to DB, and display a test confirmation notification with sound and vibration.
 */
export async function requestAndEnableNotifications(user: any): Promise<{
  granted: boolean;
  status: NotificationPermission | 'unsupported';
  message: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      granted: false,
      status: 'unsupported',
      message: 'This device or browser does not support web notifications.',
    };
  }

  try {
    // 1. Request Browser / Mobile Permission
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      // 2. Play sound & vibrate immediately
      playNotificationSoundAndVibrate();

      // 3. Register Service Worker & Subscribe to Web-Push with VAPID
      const reg = await registerServiceWorker();
      await syncDeviceWithBackend(user);

      // 4. Trigger Welcome / Success notification on device via Service Worker
      if (reg) {
        try {
          await reg.showNotification('🔔 Notifications Enabled!', {
            body: 'Sikka ERP attendance alerts and notifications are now active on your device with sound & vibration.',
            icon: SIKKA_LOGO,
            badge: SIKKA_LOGO,
            image: SIKKA_LOGO,
            vibrate: SIKKA_VIBRATION_PATTERN,
            silent: false,
            tag: 'sikka-welcome-notification',
            data: { url: '/dashboard/attendance' },
          } as any);
        } catch (swErr) {
          console.warn('SW welcome notification notice:', swErr);
        }
      } else {
        try {
          new Notification('🔔 Notifications Enabled!', {
            body: 'Sikka ERP attendance alerts and notifications are now active on your device.',
            icon: SIKKA_LOGO,
            silent: false,
          });
        } catch {}
      }

      // Mark in localStorage that user has enabled notifications
      localStorage.setItem('sikka_notif_prompt_dismissed', 'true');

      return {
        granted: true,
        status: 'granted',
        message: 'Notifications successfully enabled! Check your notification tray.',
      };
    } else if (permission === 'denied') {
      return {
        granted: false,
        status: 'denied',
        message: 'Notification permission was denied. Please enable notifications in your browser/app settings.',
      };
    } else {
      return {
        granted: false,
        status: 'default',
        message: 'Notification permission request was dismissed.',
      };
    }
  } catch (error: any) {
    console.error('Error enabling notifications:', error);
    return {
      granted: false,
      status: 'denied',
      message: error?.message || 'Failed to enable notifications.',
    };
  }
}

/**
 * Send an immediate test notification with sound & vibration to verify mobile notifications.
 * Works seamlessly on Android Chrome, WebViews, PWA, and Desktop.
 */
export async function sendTestNotification(user: any): Promise<boolean> {
  try {
    // 1. Play sound & vibration immediately
    playNotificationSoundAndVibrate();

    const title = '🔔 Sikka ERP Test Notification';
    const message = 'Notification Sound & Vibration are working perfectly on this device!';
    const empId = user?.employeeId || user?.username || user?.id || '';

    // 2. Trigger native Android Bridge if inside APK WebView
    if (isNativeAndroid()) {
      postNativeNotification(title, message, 'TEST_ALERT', empId, user?.role || 'EMPLOYEE');
    }

    // 3. Show Notification via Service Worker (Standard for Android Chrome / Web)
    const isPermissionGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
    if (isPermissionGranted && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        let reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }
        if (reg) {
          await reg.showNotification(title, {
            body: message,
            icon: SIKKA_LOGO,
            badge: SIKKA_LOGO,
            image: SIKKA_LOGO,
            vibrate: SIKKA_VIBRATION_PATTERN,
            silent: false,
            tag: 'sikka-test-' + Date.now(),
            data: { url: '/dashboard/attendance' },
          } as any).catch((err) => {
            console.warn('SW test notification notice:', err);
          });
        }
      } catch (swErr) {
        console.warn('SW test notification notice:', swErr);
      }
    }

    // 4. Direct Notification API fallback (for desktop browsers that support constructor)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body: message, icon: SIKKA_LOGO, silent: false });
      } catch (e) {
        // Android Chrome throws Illegal constructor for new Notification(), which is expected & handled by SW above
      }
    }

    // 5. Trigger server-side push test endpoint to verify DB & Web-Push
    fetch('/api/notifications/test-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: empId,
        title,
        message,
        type: 'CUSTOM_NOTIFICATION',
      }),
    }).catch(() => {});

    return true;
  } catch (e) {
    console.error('sendTestNotification catch:', e);
    // Still return true because sound & vibration already played
    return true;
  }
}
