const CACHE_NAME = 'rgcsm-shell-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // add other assets you want cached by default (icons etc)
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// On install: cache app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS.map(u => new Request(u, {cache: 'reload'}))).catch(()=>{ /* ignore individual failures */ });
    })
  );
});

// On activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Fetch: try network first, fallback to cache, then fallback page
self.addEventListener('fetch', (event) => {
  const req = event.request;
  // only handle GET requests (ignore other methods)
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then(resp => {
        // network success - update cache in background
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => {
          // put successful responses into cache (ignore opaque/cors errors)
          if(resp && resp.status === 200) cache.put(req, copy);
        });
        return resp;
      })
      .catch(() => {
        // network failed - try cache
        return caches.match(req).then(cached => {
          if (cached) return cached;
          // fallback to index.html for navigation requests
          if (req.mode === 'navigate' || (req.headers.get('accept')||'').includes('text/html')) {
            return caches.match('./index.html');
          }
          return new Response('', {status: 503, statusText: 'Offline'});
        });
      })
  );
});