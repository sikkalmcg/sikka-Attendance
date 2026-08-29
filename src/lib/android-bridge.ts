/**
 * Helper to safely communicate with native Android WebView interface (AndroidBridge).
 */

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

export const registerNativeUser = (employeeId: string, role: string, fullName: string = '') => {
  try {
    if (typeof window === 'undefined') return;
    const bridge = window.AndroidBridge || window.Android;
    if (bridge && typeof bridge.registerUser === 'function') {
      bridge.registerUser(employeeId || '', role || '', fullName || '');
    }
  } catch (e) {
    console.warn('AndroidBridge registerUser error:', e);
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
    console.warn('AndroidBridge logoutUser error:', e);
  }
};

export const postNativeNotification = (
  title: string,
  message: string,
  type: string,
  employeeId: string = '',
  role: string = 'EMPLOYEE'
) => {
  try {
    if (typeof window === 'undefined') return;
    const bridge = window.AndroidBridge || window.Android;
    if (bridge && typeof bridge.postNotification === 'function') {
      bridge.postNotification(title, message, type, employeeId, role);
    }
  } catch (e) {
    console.warn('AndroidBridge postNotification error:', e);
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
    console.warn('AndroidBridge updateBadgeCount error:', e);
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
    console.warn('AndroidBridge openAppSettings error:', e);
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
    console.warn('AndroidBridge requestNativePermission error:', e);
  }
};

/**
 * Request notification permission across both Web Browsers / PWA and Android 13+ Native.
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
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return Notification.permission === 'granted';
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

