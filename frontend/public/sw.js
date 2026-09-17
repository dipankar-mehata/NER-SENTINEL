// NER-SENTINEL Service Worker v1
// Network-first strategy for API calls, cache-first for static assets

const CACHE_NAME = 'ner-sentinel-v1';
const STATIC_CACHE = 'ner-static-v1';

// App shell files to pre-cache
const APP_SHELL = [
  '/',
  '/field',
  '/manifest.json',
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  console.log('[SW] Installing NER-SENTINEL service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn('[SW] Pre-cache failed for some resources:', err);
      });
    }).then(() => {
      console.log('[SW] Install complete');
      return self.skipWaiting();
    })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Activated');
      return self.clients.claim();
    })
  );
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (e.g. POST to /api/incidents is handled by app logic)
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests to the API backend — let them fail naturally
  if (url.hostname === 'localhost' && url.port === '8000') return;

  // Skip chrome-extension, data URIs, etc.
  if (!event.request.url.startsWith('http')) return;

  // Network-first strategy for all navigation and _next resources
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Successfully got network response — clone and cache it
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Network failed — try cache
        console.log('[SW] Network failed, trying cache for:', event.request.url);
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache:', event.request.url);
            return cachedResponse;
          }

          // No cache either — return offline fallback for navigation
          if (event.request.mode === 'navigate') {
            return caches.match('/field').then((fallback) => {
              if (fallback) return fallback;
              return new Response(
                `<!DOCTYPE html>
                <html>
                  <head><title>NER-SENTINEL — Offline</title>
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <style>
                    body { background: #111827; color: #f3f4f6; font-family: system-ui, sans-serif; 
                           display: flex; align-items: center; justify-content: center; 
                           min-height: 100vh; margin: 0; text-align: center; padding: 20px; }
                    h1 { font-size: 2rem; margin-bottom: 1rem; }
                    p { color: #9ca3af; }
                  </style>
                  </head>
                  <body>
                    <div>
                      <div style="font-size:4rem">📴</div>
                      <h1>You're Offline</h1>
                      <p>NER-SENTINEL Field App is running in offline mode.</p>
                      <p>Incident reports will be saved locally and synced when connectivity is restored.</p>
                    </div>
                  </body>
                </html>`,
                {
                  headers: { 'Content-Type': 'text/html' },
                }
              );
            });
          }

          return new Response('', { status: 408, statusText: 'Network timeout' });
        });
      })
  );
});

// Listen for messages (e.g. from app to trigger cache refresh)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      console.log('[SW] Cache cleared on request');
    });
  }
});
