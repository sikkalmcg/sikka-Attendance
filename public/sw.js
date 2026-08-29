const SIKKA_LOCAL_LOGO = '/icon-192x192.png';
const SIKKA_BADGE_LOGO = '/badge-72x72.png';
const CHANNEL_ID = 'general_notifications';
// High-priority vibration pattern: [200ms vibrate, 100ms pause, 200ms vibrate, 100ms pause, 200ms vibrate]
const VIBRATION_PATTERN = [200, 100, 200, 100, 200];

function getFullLogoUrl(path) {
  if (!path) return self.location.origin + SIKKA_LOCAL_LOGO;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return self.location.origin + (path.startsWith('/') ? path : '/' + path);
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// 🔔 Master Fix: Web-Push / FCM Push Notification Handler (Foreground, Background, Killed/Closed App, Reconnect)
self.addEventListener('push', function (event) {
  if (!event.data) return;

  let rawData = {};
  try {
    rawData = event.data.json();
  } catch (err) {
    rawData = { body: event.data.text() || 'New Notification received' };
  }

  const title = rawData.title || rawData.notification?.title || 'Sikka ERP';
  const body = rawData.body || rawData.message || rawData.notification?.body || 'New Notification received';
  const notifId = rawData.notificationId || rawData.data?.notificationId || 'sikka-notification-' + Date.now();
  const targetUrl = rawData.url || rawData.data?.url || rawData.data?.deepLink || '/dashboard/attendance';
  const badgeCount = rawData.badgeCount || rawData.data?.badgeCount || 1;

  const iconUrl = getFullLogoUrl(rawData.icon || rawData.notification?.icon || SIKKA_LOCAL_LOGO);
  const badgeUrl = getFullLogoUrl(rawData.badge || rawData.notification?.badge || SIKKA_BADGE_LOGO);
  const imageUrl = getFullLogoUrl(rawData.image || rawData.notification?.image || iconUrl);

  const options = {
    body: body,
    icon: iconUrl,
    badge: badgeUrl,
    image: imageUrl,
    vibrate: VIBRATION_PATTERN,
    tag: notifId,
    renotify: true,
    requireInteraction: true,
    silent: false,
    data: {
      url: targetUrl,
      notificationId: notifId,
      ...(rawData.data || {})
    },
    actions: [
      { action: 'open', title: 'Open ERP' }
    ]
  };

  const notificationPromise = self.registration.showNotification(title, options);
  
  const badgePromise = ('setAppBadge' in navigator && badgeCount)
    ? navigator.setAppBadge(badgeCount).catch(() => {})
    : Promise.resolve();

  // Notify any active foreground tabs to trigger sound & update red dot badge
  const clientNotifyPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    for (const client of clientList) {
      client.postMessage({
        type: 'PUSH_NOTIFICATION_RECEIVED',
        payload: {
          title,
          body,
          data: options.data,
          badgeCount
        }
      });
    }
  });

  event.waitUntil(Promise.all([notificationPromise, badgePromise, clientNotifyPromise]));
});

// 👆 Notification Click Navigation & Badge Clear
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  const notifData = event.notification.data || {};
  const notifId = notifData.notificationId || notifData.id;
  const targetUrl = notifData.url || notifData.deepLink || '/dashboard/attendance';

  // Mark notification as read in database when clicked
  if (notifId && !String(notifId).startsWith('sikka-notification-')) {
    fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: notifId }),
    }).catch(() => {});
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
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

// 🔔 Handle in-app local notification trigger messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_LOCAL_NOTIFICATION') {
    const { title, message, url, data, icon, image } = event.data;
    const finalIcon = getFullLogoUrl(icon || SIKKA_LOCAL_LOGO);
    const finalBadge = getFullLogoUrl(SIKKA_BADGE_LOGO);
    const finalImage = getFullLogoUrl(image || finalIcon);

    self.registration.showNotification(title || 'Sikka ERP', {
      body: message || 'Mobile notification received successfully!',
      icon: finalIcon,
      badge: finalBadge,
      image: finalImage,
      vibrate: VIBRATION_PATTERN,
      silent: false,
      tag: 'sikka-local-notification-' + Date.now(),
      data: { url: url || '/dashboard/attendance', ...(data || {}) },
    });
  }
});