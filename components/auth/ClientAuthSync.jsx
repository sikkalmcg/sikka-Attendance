'use client';

import { useEffect } from 'react';

/**
 * ClientAuthSync
 * Ensures authentication persists across Android APK kills, WebView process restarts,
 * and mobile background clearing. Automatically attaches the persistent token to /api/ calls
 * and keeps cookie sessions synchronized.
 */
export default function ClientAuthSync() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Monkey-patch window.fetch to automatically include Bearer token for /api/ calls
    if (!window.__attendanceFetchPatched) {
      window.__attendanceFetchPatched = true;
      const originalFetch = window.fetch;

      window.fetch = async function (input, init = {}) {
        try {
          const token = localStorage.getItem('attendance_token');
          let url = '';
          if (typeof input === 'string') {
            url = input;
          } else if (input && typeof input.url === 'string') {
            url = input.url;
          }

          // Attach token to /api/ endpoints (relative or same-origin)
          if (token && (url.startsWith('/api/') || url.startsWith('api/') || url.includes('/api/'))) {
            let currentHeaders = {};
            if (init.headers) {
              if (init.headers instanceof Headers) {
                if (!init.headers.has('Authorization')) {
                  init.headers.set('Authorization', `Bearer ${token}`);
                }
                return originalFetch.apply(this, [input, init]);
              } else if (Array.isArray(init.headers)) {
                currentHeaders = Object.fromEntries(init.headers);
              } else {
                currentHeaders = { ...init.headers };
              }
            } else if (input instanceof Request && input.headers) {
              const reqHeaders = new Headers(input.headers);
              if (!reqHeaders.has('Authorization')) {
                reqHeaders.set('Authorization', `Bearer ${token}`);
              }
              init = { ...init, headers: reqHeaders };
              return originalFetch.apply(this, [input, init]);
            }

            if (!currentHeaders['Authorization'] && !currentHeaders['authorization']) {
              currentHeaders['Authorization'] = `Bearer ${token}`;
            }
            init = { ...init, headers: currentHeaders };
          }
        } catch {
          // localStorage error handling in restricted environments
        }

        return originalFetch.apply(this, [input, init]);
      };
    }

    // 2. Silent re-hydration on app foreground/focus (e.g. returning from Android background)
    const handleAppResume = async () => {
      try {
        const token = localStorage.getItem('attendance_token');
        if (token) {
          // Silently trigger /api/auth/me to re-hydrate cookies in WebView
          await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
        }
      } catch {
        // Network offline or idle
      }
    };

    window.addEventListener('focus', handleAppResume);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleAppResume();
      }
    });

    return () => {
      window.removeEventListener('focus', handleAppResume);
    };
  }, []);

  return null;
}
