/*
 * Service worker minimo: rende il gioco installabile come app.
 * Tiene in cache solo le immagini (carte, personaggi, icone) per caricarle più in fretta;
 * tutto il resto passa sempre dalla rete, così gli aggiornamenti del gioco arrivano subito.
 */
const CACHE = 'samurai-sword-img-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isImage = event.request.method === 'GET' && url.origin === self.location.origin && /\.(webp|png|jpg)$/.test(url.pathname);
  if (!isImage) return; // rete normale
  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(event.request).then(hit => {
        const fresh = fetch(event.request)
          .then(res => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || fresh;
      })
    )
  );
});
