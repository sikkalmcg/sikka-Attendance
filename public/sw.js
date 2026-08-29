const SIKKA_LOGO = '/sikka-logo.png';
const SIKKA_REMOTE_LOGO = 'https://sikkaenterprises.com/assets/images/Capture13.51191245_std.JPG';
const CHANNEL_ID = 'general_notifications';
// Vibration pattern: 0ms delay -> 300ms vibrate -> 200ms pause -> 300ms vibrate
const VIBRATION_PATTERN = [0, 300, 200, 300];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// 🔔 Handle Incoming FCM Web Push Notifications (Foreground, Background, Closed App)
self.addEventListener('push', function (event) {
  let data = {
    title: 'Sikka ERP - New Notification',
    body: 'You have a new notification from Sikka ERP.',
    icon: SIKKA_LOGO,
    badge: SIKKA_LOGO,
    data: { url: '/dashboard/attendance' },
    badgeCount: 1,
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data.title = payload.title || payload.notification?.title || data.title;
      data.body = payload.body || payload.message || payload.notification?.body || data.body;
      data.badgeCount = payload.badgeCount || 1;
      data.icon = payload.icon || payload.notification?.icon || SIKKA_LOGO;
      data.badge = payload.badge || SIKKA_LOGO;
      data.image = payload.image || payload.notification?.image || SIKKA_LOGO;
      if (payload.data) {
        data.data = payload.data;
        if (payload.data.url) data.data.url = payload.data.url;
        if (payload.data.deepLink) data.data.url = payload.data.deepLink;
      }
    } catch (e) {
      data.body = event.data.text() || data.body;
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || SIKKA_LOGO,
    badge: data.badge || SIKKA_LOGO,
    vibrate: VIBRATION_PATTERN,
    tag: 'sikka-hrms-notification-' + (data.data?.notificationId || Date.now()),
    renotify: true,
    requireInteraction: true,
    silent: false,
    data: data.data || { url: '/dashboard/attendance' },
    actions: [
      { action: 'open', title: 'Open ERP' },
    ],
  };

  const promiseChain = self.registration
    .showNotification(data.title, notificationOptions)
    .then(async () => {
      // 1. Set App Badge count on supported devices (PWA / Chrome / Android)
      if ('setAppBadge' in navigator) {
        try {
          await navigator.setAppBadge(data.badgeCount || 1);
        } catch (badgeErr) {
          console.warn('Service worker badge error:', badgeErr);
        }
      }

      // 2. Notify any active foreground browser tabs to play sound, vibrate, and refresh red dot
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({
          type: 'PUSH_NOTIFICATION_RECEIVED',
          payload: {
            title: data.title,
            body: data.body,
            data: data.data,
          },
        });
      }
    });

  event.waitUntil(promiseChain);
});

// 🔔 Handle direct postMessage from webpage (Local in-app notification trigger)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_LOCAL_NOTIFICATION') {
    const { title, message, url, data } = event.data;
    self.registration.showNotification(title || 'Sikka ERP', {
      body: message || 'Mobile notification received successfully!',
      icon: SIKKA_LOGO,
      badge: SIKKA_LOGO,
      vibrate: VIBRATION_PATTERN,
      silent: false,
      tag: 'sikka-local-notification-' + Date.now(),
      data: { url: url || '/dashboard/attendance', ...(data || {}) },
    });
  }
});

// 👆 Handle Notification Click
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  // Clear badge count
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch((err) => console.warn('Clear badge error:', err));
  }

  const notifData = event.notification.data || {};
  const notifId = notifData.notificationId || notifData.id || notifData.eventId;
  const targetUrl = notifData.url || notifData.deepLink || '/dashboard/attendance';

  // Mark notification as isRead in MongoDB when clicked
  if (notifId) {
    fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: notifId }),
    }).catch(() => {});
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});