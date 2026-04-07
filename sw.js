/**
 * Liquid Premium - Network-First Service Worker (v10.1)
 * This strategy prioritizes the fresh code from the internet.
 * It ONLY uses the cache if the user is offline.
 */

const CACHE_NAME = 'vcard-scanner-v10.1';
const ASSETS = [
    './styles.css?v=8.0',
    './app.js?v=8.0',
    './firebase-config.js?v=8.0',
    './manifest.json',
    './icon.png'
];

// 1. Install Event: Cache only the assets (excluding index.html)
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// 2. Activate Event: Cleanup old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
});

// 3. Fetch Event: NETWORK-FIRST Strategy
self.addEventListener('fetch', (event) => {
    // Skip external URLs and non-GET requests
    if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If network works, put a clone in the cache and return
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, response.clone());
                    return response;
                });
            })
            .catch(() => {
                // If network fails (Offline), use the cache
                return caches.match(event.request);
            })
    );
});
