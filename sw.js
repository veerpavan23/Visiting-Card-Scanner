/**
 * Bizconnex Sync Rescue - Service Worker (v99.0)
 * PURGE MODE: Dedicated to clearing old caches and unregistering itself.
 */

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(keys.map(key => caches.delete(key)));
        }).then(() => {
            return self.registration.unregister();
        }).then(() => {
            return self.clients.matchAll();
        }).then((clients) => {
            clients.forEach(client => client.navigate(client.url));
        })
    );
});

// Bypass everything to ensure network-only during rescue
self.addEventListener('fetch', (event) => {
    return; // Let the browser handle normally
});
