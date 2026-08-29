/**
 * Client Notification & Device Registration Bridge for Web, PWA, and Mobile APK/WebView.
 * Supports:
 * - Real-time Push Notification with Sound & Vibration
 * - Android Notification Channel: general_notifications (High Importance, Sound & Vibration enabled)
 * - Android Native Bridge & Service Worker integration
 * - Red Dot & Unread Badge synchronization
 */

import { playNotificationSoundAndVibrate, SIKKA_VIBRATION_PATTERN } from '@/lib/notification-sound';

const SIKKA_LOGO = 'https://sikkaenterprises.com/assets/images/Capture13.51191245_std.JPG';

declare global {
  interface Window {
    AndroidBridge?: {
      postNotification?: (title: string, message: string, type: string, employeeId: string, role: string) => void;
      updateBadgeCount?: (count: number) => void;
      registerUser?: (employeeId: string, role: string, fullName: string) => void;
      logoutUser?: () => void;
      requestNativePermission?: (permissionType: string) => void;
      openAppSettings?: () => void;
      getPlatform?: () => string;
    };
    Android?: {
      postNotification?: (title: string, message: string, type: string, employeeId: string, role: string) => void;
      updateBadgeCount?: (count: number) => void;
      registerUser?: (employeeId: string, role: string, fullName: string) => void;
      logoutUser?: () => void;
      requestNativePermission?: (permissionType: string) => void;
      openAppSettings?: () => void;
      getPlatform?: () => string;
    };
  }
}

export const isNativeAndroid = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.AndroidBridge || window.Android);
};

export const getOrCreateDeviceId = (): string => {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('sikka_device_id');
  if (!id) {
    id = 'device_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
    localStorage.setItem('sikka_device_id', id);
  }
  return id;
};

export const registerNativeUser = async (employeeId: string, role: string, fullName: string = '') => {
  try {
    if (typeof window === 'undefined') return;

    // 1. Android Bridge fallback if inside APK WebView container
    const bridge = window.AndroidBridge || window.Android;
    if (bridge && typeof bridge.registerUser === 'function') {
      bridge.registerUser(employeeId || '', role || '', fullName || '');
    }

    // 2. Sync device token with backend database
    const deviceId = getOrCreateDeviceId();
    const userAgent = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);

    fetch('/api/notifications/register-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: deviceId,
        employeeId: employeeId || '',
        role: role || 'EMPLOYEE',
        deviceName: isMobile ? 'Mobile APK / Browser' : 'Desktop Browser',
        platform: isMobile ? 'android-web' : 'web',
      }),
    }).catch((err) => console.warn('Device register error:', err));
  } catch (e) {
    console.warn('registerNativeUser error:', e);
  }
};

export const logoutNativeUser = () => {
  try {
    if (typeof window === 'undefined') return;
    const bridge = window.AndroidBridge || window.Android;
    if (bridge && typeof bridge.logoutUser === 'function') {
      bridge.logoutUser();
    }
  } catch (e) {
    console.warn('logoutNativeUser error:', e);
  }
};

/**
 * Show system notification on phone/browser across Service Worker, Web Notification API, and Native Bridge
 * with both NOTIFICATION SOUND and VIBRATION.
 */
export const postNativeNotification = async (
  title: string,
  message: string,
  type: string,
  employeeId: string = '',
  role: string = 'EMPLOYEE'
) => {
  try {
    if (typeof window === 'undefined') return;

    const notifTitle = title || 'Sikka ERP - New Notification';
    const notifBody = message || 'Please check your attendance and notifications.';

    // 1. Immediate Sound & Vibration trigger (works in foreground)
    playNotificationSoundAndVibrate();

    // 2. Android Bridge native notification if inside Android Studio WebView container
    const bridge = window.AndroidBridge || window.Android;
    if (bridge && typeof bridge.postNotification === 'function') {
      try {
        bridge.postNotification(notifTitle, notifBody, type, employeeId, role);
      } catch (err) {
        console.warn('Native bridge notification error:', err);
      }
    }

    // 3. Service Worker Notification (Only if permission is granted)
    const isPermissionGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';

    if (isPermissionGranted && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) {
          reg.showNotification(notifTitle, {
            body: notifBody,
            icon: SIKKA_LOGO,
            badge: SIKKA_LOGO,
            vibrate: SIKKA_VIBRATION_PATTERN,
            tag: 'sikka-' + (type || 'notif') + '-' + Date.now(),
            renotify: true,
            requireInteraction: true,
            silent: false,
            data: { url: '/dashboard/attendance' },
          } as any).catch((err) => {
            console.warn('Service worker showNotification notice:', err);
          });
        }
      }).catch((err) => {
        console.warn('getRegistration error:', err);
      });
    }

    // 4. Direct Web Notification fallback (desktop only, when permission is granted)
    if (isPermissionGranted && 'Notification' in window) {
      try {
        new Notification(notifTitle, {
          body: notifBody,
          icon: SIKKA_LOGO,
          silent: false,
        });
      } catch (e) {
        // Handled via ServiceWorker on Android
      }
    }
  } catch (e) {
    console.warn('postNativeNotification error:', e);
  }
};

export const updateNativeBadgeCount = (count: number) => {
  try {
    if (typeof window === 'undefined') return;
    const bridge = window.AndroidBridge || window.Android;
    if (bridge && typeof bridge.updateBadgeCount === 'function') {
      bridge.updateBadgeCount(Math.max(0, count));
    }
  } catch (e) {
    console.warn('updateNativeBadgeCount error:', e);
  }
};

export const openNativeAppSettings = () => {
  try {
    if (typeof window === 'undefined') return;
    const bridge = window.AndroidBridge || window.Android;
    if (bridge && typeof bridge.openAppSettings === 'function') {
      bridge.openAppSettings();
    }
  } catch (e) {
    console.warn('openNativeAppSettings error:', e);
  }
};

export const requestNativePermission = (permissionType: 'LOCATION' | 'PHOTO' | 'NOTIFICATION') => {
  try {
    if (typeof window === 'undefined') return;
    const bridge = window.AndroidBridge || window.Android;
    if (bridge && typeof bridge.requestNativePermission === 'function') {
      bridge.requestNativePermission(permissionType);
    }
  } catch (e) {
    console.warn('requestNativePermission error:', e);
  }
};

/**
 * Request notification permission across both Web Browsers / PWA and Android.
 */
export const requestAppNotificationPermission = async (): Promise<boolean> => {
  try {
    if (typeof window === 'undefined') return false;

    // Trigger native Android permission dialog if in WebView
    if (isNativeAndroid()) {
      requestNativePermission('NOTIFICATION');
    }

    // Web Notification API (Android 13+ Chrome / PWA / Web)
    if ('Notification' in window) {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      return permission === 'granted';
    }
  } catch (e) {
    console.warn('Notification permission request error:', e);
  }
  return false;
};

/**
 * Set App Badge count on both Web PWA (navigator.setAppBadge) and Android WebView.
 */
export const setAppBadge = async (count: number = 1): Promise<void> => {
  try {
    if (typeof window === 'undefined') return;
    
    // 1. Android Native Launcher Badge
    updateNativeBadgeCount(count);

    // 2. Web / PWA Badging API
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      if (count > 0) {
        await (navigator as any).setAppBadge(count);
      } else {
        await (navigator as any).clearAppBadge();
      }
    }
  } catch (e) {
    console.warn('setAppBadge error:', e);
  }
};

/**
 * Clear App Badge on both Web PWA (navigator.clearAppBadge) and Android WebView.
 */
export const clearAppBadge = async (): Promise<void> => {
  try {
    if (typeof window === 'undefined') return;

    // 1. Android Native Launcher Badge
    updateNativeBadgeCount(0);

    // 2. Web / PWA Badging API
    if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
      await (navigator as any).clearAppBadge();
    }
  } catch (e) {
    console.warn('clearAppBadge error:', e);
  }
};
