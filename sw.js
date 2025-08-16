const CACHE_NAME = 'flipfit-mobile-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - EXCLUDE API CALLS FROM CACHING
self.addEventListener('fetch', (event) => {
  // Don't cache API requests to your HuggingFace Space
  if (event.request.url.includes('cnoval-flipfit.hf.space')) {
    // Always fetch from network for API calls
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Don't cache POST requests
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // Cache other resources normally
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});

// Activate service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
