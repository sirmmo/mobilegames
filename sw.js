// Offline support: cache-first for the game files, refreshed in the background.
const CACHE = 'mobilegames-v2';
const FILES = [
  './', 'index.html', 'icon.svg', 'manifest.webmanifest',
  'shared/base.css', 'shared/match3.css', 'shared/util.js', 'shared/gems.js', 'shared/match3.js',
  'mahjong/', 'mahjong/index.html', 'mahjong/mahjong.css', 'mahjong/app.js', 'mahjong/game.js', 'mahjong/tiles.js', 'mahjong/layouts.js',
  'gems/', 'gems/index.html', 'gems/app.js',
  'mosaic/', 'mosaic/index.html', 'mosaic/mosaic.css', 'mosaic/app.js', 'mosaic/levels.js',
  'paint/', 'paint/index.html', 'paint/paint.css', 'paint/app.js', 'paint/levels.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
