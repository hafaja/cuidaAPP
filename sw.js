// cuidaAPP · CuidarConSentido — service worker
const CACHE = 'ccs-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './favicon-48.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // No interceptar la función de IA ni recursos de otros dominios
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf('/.netlify/') !== -1) return;
  // Navegación: red primero, y si no hay conexión, servir la app cacheada
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(function () { return caches.match('./index.html'); }));
    return;
  }
  // Resto: cache primero, si no, red
  e.respondWith(caches.match(req).then(function (r) { return r || fetch(req); }));
});
