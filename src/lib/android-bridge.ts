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
