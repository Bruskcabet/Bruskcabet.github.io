// Cache version (increment when changing cached assets)
const CACHE_NAME = 'nexo-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
  '/favicon.svg',
  '/og-image.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  // Pre-cache core assets
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Remove old caches
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});

// Fetch handler: network-first for navigation (so users get fresh HTML),
// cache-first for other assets for faster loads and offline support.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Navigation request (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Update cache with the latest HTML response
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return networkResponse;
        })
        .catch(() => {
          // If network fails, return the cached navigation page or offline fallback
          return caches.match(event.request).then((cached) => cached || caches.match('/offline.html'));
        })
    );
    return;
  }

  // For other requests (assets): cache-first strategy
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Only cache successful same-origin responses
          if (!response || response.status !== 200 || response.type === 'opaque') return response;
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => {
          // If asset fetch fails (offline), try to return a cached fallback
          // e.g., return cached image placeholder (not provided here)
          return caches.match('/offline.html');
        });
    })
  );
});
