const CACHE_NAME = 'giftlist-v1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/gift-placeholder.svg'
];

// instala e pré-cacheia os assets básicos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

// limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)
    ))
  );
});

// estratégia: 
// - network-first para chamadas ao GAS (?route=items / POST confirm)
// - cache-first para shell estático
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  const isApi = url.searchParams.get('route') === 'items';
  if (isApi) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        const clone = fresh.clone();
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, clone);
        return fresh;
      } catch (err) {
        // fallback: offline -> cache se houver
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        return cached || new Response(JSON.stringify({ items: [] }), {
          headers: { 'Content-Type': 'application/json' },
          status: 200
        });
      }
    })());
    return;
  }

  // shell estático
  event.respondWith(
    caches.match(event.request).then((resp) => {
      return resp || fetch(event.request);
    })
  );
});
