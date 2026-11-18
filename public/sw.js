// Sikka Attendance System Service Worker
// Version: 1.0.0
const CACHE_NAME = 'sikka-attendance-v1';

const STATIC_PRECACHE = [
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/images/sikka-logo.jpg',
];

// Install: precache offline fallback and essential app assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: Safe routing rules
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. NEVER intercept non-GET requests (POST, PUT, DELETE, etc.)
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. NEVER cache any API requests or auth routes
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 3. Navigation requests (HTML pages): ALWAYS network-first
  // NEVER cache authenticated HTML pages to avoid stale or cross-user data leakage.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/offline');
      })
    );
    return;
  }

  // 4. Static assets (_next/static, icons, images, fonts, styles)
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    /\.(png|jpe?g|svg|webp|gif|ico|woff2?|ttf|css)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
            return response;
          })
          .catch(() => {
            // Static asset fetch failed; no-op
          });
      })
    );
    return;
  }

  // Default: pass through to network
});
