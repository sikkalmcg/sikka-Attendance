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

// ══════════════════════════════════════════════════════════════════════════════
// 🔔 PUSH NOTIFICATION HANDLER
// Works when app is: Foreground | Background | Minimized | COMPLETELY CLOSED
// This is the only handler needed for reliable delivery — it runs in the
// Service Worker process which the OS keeps alive independently of the app.
// ══════════════════════════════════════════════════════════════════════════════
self.addEventListener('push', function (event) {
  if (!event.data) return;

  let rawData = {};
  try {
    rawData = event.data.json();
  } catch (err) {
    rawData = { body: event.data.text() || 'New Notification received' };
  }

  const title = rawData.title || rawData.notification?.title || 'Sikka Attendance';
  const body = rawData.body || rawData.message || rawData.notification?.body || 'New notification from Sikka ERP.';
  const notifId = rawData.notificationId || rawData.data?.notificationId || ('sikka-' + Date.now());
  const targetUrl = rawData.url || rawData.data?.url || rawData.data?.deepLink || '/dashboard/attendance';
  
  // Parse badge count safely
  const rawBadge = rawData.badgeCount || rawData.data?.badgeCount;
  const badgeCount = (typeof rawBadge === 'number' && rawBadge > 0) ? rawBadge : 1;

  const iconUrl = getFullLogoUrl(rawData.icon || rawData.notification?.icon || SIKKA_LOCAL_LOGO);
  const badgeUrl = getFullLogoUrl(rawData.badge || rawData.notification?.badge || SIKKA_BADGE_LOGO);
  const imageUrl = getFullLogoUrl(rawData.image || rawData.notification?.image || iconUrl);

  const isLocationRequest = (rawData.type === 'REQUEST_LOCATION' || rawData.data?.type === 'REQUEST_LOCATION' || rawData.data?.action === 'SYNC_LOCATION');

  const options = {
    body: body,
    icon: iconUrl,
    badge: badgeUrl,
    image: imageUrl,
    vibrate: isLocationRequest ? [] : VIBRATION_PATTERN,
    tag: isLocationRequest ? 'sikka-location-sync' : notifId,
    renotify: !isLocationRequest,
    requireInteraction: !isLocationRequest,
    silent: isLocationRequest,
    data: {
      url: targetUrl,
      notificationId: notifId,
      ...(rawData.data || {})
    },
    actions: isLocationRequest ? [] : [
      { action: 'open', title: '✅ Mark Attendance' },
      { action: 'dismiss', title: 'Later' }
    ]
  };

  const notificationPromise = self.registration.showNotification(
    isLocationRequest ? 'Location Sync' : title,
    options
  );

  // Update the PWA launcher badge count
  const badgePromise = ('setAppBadge' in self.navigator && badgeCount > 0)
    ? self.navigator.setAppBadge(badgeCount).catch(() => {})
    : Promise.resolve();

  // Notify any open foreground tabs so they can:
  // 1. Capture current GPS location if location request
  // 2. Play notification sound
  // 3. Update the in-app red notification badge
  const clientNotifyPromise = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        client.postMessage({
          type: isLocationRequest ? 'REQUEST_BACKGROUND_LOCATION' : 'PUSH_NOTIFICATION_RECEIVED',
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

// ══════════════════════════════════════════════════════════════════════════════
// 👆 NOTIFICATION CLICK HANDLER
// Handles tapping the notification — opens the correct page in the app.
// ══════════════════════════════════════════════════════════════════════════════
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  // Clear the launcher badge when user taps a notification
  if ('clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  // Handle dismiss action — do nothing except close the notification
  if (event.action === 'dismiss') return;

  const notifData = event.notification.data || {};
  const notifId = notifData.notificationId || notifData.id;
  const targetUrl = notifData.url || notifData.deepLink || '/dashboard/attendance';

  // Mark notification as read in the database
  if (notifId && !String(notifId).startsWith('sikka-')) {
    fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: notifId }),
    }).catch(() => {});
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // If the app is already open, navigate to the target URL and focus
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          // Navigate the existing tab to the target URL
          client.navigate(targetUrl).catch(() => {
            client.focus();
          });
          return client.focus();
        }
      }
      // App is closed — open a new window at the target URL
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// 📩 LOCAL NOTIFICATION TRIGGER (from in-app message to SW)
// ══════════════════════════════════════════════════════════════════════════════
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
      tag: 'sikka-local-' + Date.now(),
      data: { url: url || '/dashboard/attendance', ...(data || {}) },
    });
  }
});