const CACHE_NAME = 'avtoservis-cache-v1';
const API_CACHE_NAME = 'api-cache';
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/mask-icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/manifest.json'
];

// Install event - extended caching
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened');
        return cache.addAll([
          ...urlsToCache,
          '/offline.html',
          '/src/assets/logo.svg'
        ]);
      })
      .catch(err => console.error('Cache installation failed:', err))
  );
});

// Push notifications handler
self.addEventListener('push', function(event) {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-192x192.png'
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Cache API requests strategy
  if (requestUrl.pathname.startsWith('/api')) {
    event.respondWith(
      cacheFirst(event.request, API_CACHE_NAME)
    );
  } else {
    event.respondWith(
      networkFirst(event.request)
    );
  }
});

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || caches.match('/offline.html');
  }
}

async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;
  
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(cacheName);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Офлайн режим' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

self.addEventListener('online', () => {
    console.log('Network restored');
});

// Handle offline functionality
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
