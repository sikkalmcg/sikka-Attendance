self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Satisfies standard PWA installation criteria
  event.respondWith(fetch(event.request));
});

// 🔔 Handle incoming Web Push Notifications
self.addEventListener('push', function (event) {
  let data = {
    title: 'Sikka HRMS Notification',
    body: 'You have a new update.',
    icon: '/icon.png',
    badge: '/icon.png',
    data: { url: '/dashboard/attendance' },
    badgeCount: 1,
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data.title = payload.title || data.title;
      data.body = payload.body || payload.message || data.body;
      data.badgeCount = payload.badgeCount || 1;
      if (payload.data) data.data = payload.data;
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/icon.png',
    badge: data.badge || '/icon.png',
    vibrate: [100, 50, 100],
    data: data.data,
  };

  const promiseChain = self.registration
    .showNotification(data.title, notificationOptions)
    .then(async () => {
      // Set App Badge count on supported devices (PWA / Chrome / Android)
      if ('setAppBadge' in navigator) {
        try {
          await navigator.setAppBadge(data.badgeCount);
        } catch (badgeErr) {
          console.warn('Service worker badge error:', badgeErr);
        }
      }
    });

  event.waitUntil(promiseChain);
});

// 👆 Handle Notification Click
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  // Clear or decrement badge count
  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch((err) => console.warn('Clear badge error:', err));
  }

  const targetUrl = event.notification.data?.url || '/dashboard/attendance';

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