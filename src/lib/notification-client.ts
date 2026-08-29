/**
 * Comprehensive Client Notification Manager for Mobile & Web (FCM / ServiceWorker / PWA).
 */

import { playNotificationSoundAndVibrate, SIKKA_VIBRATION_PATTERN } from '@/lib/notification-sound';

const SIKKA_LOGO = 'https://sikkaenterprises.com/assets/images/Capture13.51191245_std.JPG';

export interface DeviceRegistrationPayload {
  token: string;
  employeeId: string;
  role: string;
  deviceName?: string;
  platform?: string;
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
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn('Service Worker registration error:', err);
    return null;
  }
}

/**
 * Sync device token with backend MongoDB database.
 */
export async function syncDeviceWithBackend(user: any): Promise<boolean> {
  try {
    const deviceId = getOrCreateDeviceId();
    const employeeId = user?.employeeId || user?.username || user?.id || '';
    const role = user?.role || 'EMPLOYEE';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser';
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent);

    const payload: DeviceRegistrationPayload = {
      token: deviceId,
      employeeId,
      role,
      deviceName: isMobile ? 'Mobile Browser / APK Web' : 'Desktop Browser',
      platform: isMobile ? 'android-web' : 'web',
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
 * Request notification permission from user, register service worker, sync to DB,
 * and display a test confirmation notification with sound and vibration.
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
      // 2. Play sound & vibrate
      playNotificationSoundAndVibrate();

      // 3. Register Service Worker
      const reg = await registerServiceWorker();

      // 4. Sync Device ID with backend
      await syncDeviceWithBackend(user);

      // 5. Trigger Welcome / Success notification on device
      if (reg) {
        reg.showNotification('🔔 Notifications Enabled!', {
          body: 'Sikka ERP attendance alerts and notifications are now active on your device with sound & vibration.',
          icon: SIKKA_LOGO,
          badge: SIKKA_LOGO,
          vibrate: SIKKA_VIBRATION_PATTERN,
          silent: false,
          tag: 'sikka-welcome-notification',
          data: { url: '/dashboard/attendance' },
        } as any);
      } else {
        new Notification('🔔 Notifications Enabled!', {
          body: 'Sikka ERP attendance alerts and notifications are now active on your device.',
          icon: SIKKA_LOGO,
          silent: false,
        });
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
 */
export async function sendTestNotification(user: any): Promise<boolean> {
  try {
    // 1. Play sound & vibration immediately
    playNotificationSoundAndVibrate();

    const reg = await registerServiceWorker();
    const title = '🔔 Sikka ERP Test Notification';
    const message = 'Notification Sound & Vibration are working perfectly on this device!';

    if (reg) {
      reg.showNotification(title, {
        body: message,
        icon: SIKKA_LOGO,
        badge: SIKKA_LOGO,
        vibrate: SIKKA_VIBRATION_PATTERN,
        silent: false,
        tag: 'sikka-test-' + Date.now(),
        data: { url: '/dashboard/attendance' },
      } as any);
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body: message, icon: SIKKA_LOGO, silent: false });
    }

    // Also trigger server-side test endpoint to verify DB & logging
    const empId = user?.employeeId || user?.username || user?.id || '';
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
    console.error('Failed sending test notification:', e);
    return false;
  }
}
