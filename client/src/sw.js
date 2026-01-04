import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Прекешування основних ресурсів
precacheAndRoute(self.__WB_MANIFEST);

// Кешування статичних ресурсів
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60 // 30 днів
      })
    ]
  })
);

// Кешування шрифтів
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets'
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200]
      }),
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365 // 1 рік
      })
    ]
  })
);

// Офлайн-сторінка
const FALLBACK_HTML_URL = '/offline.html';
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('offline-html').then((cache) => cache.add(FALLBACK_HTML_URL))
  );
});

// Показ офлайн-сторінки при відсутності з'єднання
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async ({ event }) => {
    try {
      return await new NetworkFirst({
        cacheName: 'pages',
        plugins: [
          new ExpirationPlugin({
            maxEntries: 25
          })
        ]
      }).handle({ event });
    } catch (error) {
      return caches.match(FALLBACK_HTML_URL);
    }
  }
);
