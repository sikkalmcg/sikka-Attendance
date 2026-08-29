const SIKKA_LOGO = 'https://sikkaenterprises.com/assets/images/Capture13.51191245_std.JPG';

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
    body: 'You have a new attendance update.',
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
    vibrate: [200, 100, 200, 100, 200],
    tag: 'sikka-hrms-notification',
    renotify: true,
    requireInteraction: true,
    data: data.data || { url: '/dashboard/attendance' },
  };

  const promiseChain = self.registration
    .showNotification(data.title, notificationOptions)
    .then(async () => {
      // Set App Badge count on supported devices (PWA / Chrome / Android)
      if ('setAppBadge' in navigator) {
        try {
          await navigator.setAppBadge(data.badgeCount || 1);
        } catch (badgeErr) {
          console.warn('Service worker badge error:', badgeErr);
        }
      }
    });

  event.waitUntil(promiseChain);
});

// 🔔 Handle direct postMessage from webpage (Local in-app test notifications)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_LOCAL_NOTIFICATION') {
    const { title, message, url, data } = event.data;
    self.registration.showNotification(title || 'Sikka Attendance', {
      body: message || 'Mobile notification is working successfully!',
      icon: SIKKA_LOGO,
      badge: SIKKA_LOGO,
      vibrate: [200, 100, 200],
      tag: 'sikka-test-notification',
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