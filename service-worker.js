// Inference Cluster Estimator — Service Worker
// CE-021: Offline support with cache-first strategy and versioning
const CACHE_NAME = 'inference-estimator-v1';

const PRECACHE_URLS = [
  './',
  './cluster-estimator.html',
  './manifest.json'
];

// Install: pre-cache essential files
self.addEventListener('install', event => {
  console.log('[SW] Installing — pre-caching', PRECACHE_URLS);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating — cleaning old caches');
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first falling back to cache
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache
        console.log('[SW] Offline — serving from cache:', event.request.url);
        return caches.match(event.request);
      })
  );
});
