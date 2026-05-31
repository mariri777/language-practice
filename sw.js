// Language Practice — shared service worker
// Bump VERSION whenever shipping new HTML / asset content.
const VERSION = 'v2.2.9';
const CACHE = `lang-practice-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './chinese-diary.html',
  './chinese-diary-ko.html',
  './chinese-practice.html',
  './chinese-practice-ko.html',
  './chinese-lookup.html',
  './chinese-today.html',
  './korean-practice.html',
  './korean-today.html',
  './clips.js?v=3',
  './clips.css?v=3',
  './s2t.js',
  './index.webmanifest',
  './chinese-diary.webmanifest',
  './chinese-diary-ko.webmanifest',
  './chinese-practice.webmanifest',
  './chinese-practice-ko.webmanifest',
  './chinese-lookup.webmanifest',
  './korean-practice.webmanifest',
  './favicon.svg',
  './favicon-home.svg',
  './favicon-zh.svg',
  './favicon-ko.svg',
  './favicon-lookup.svg',
  './favicon-diary-ko.svg',
  './icons/favicon-180.png',
  './icons/favicon-192.png',
  './icons/favicon-512.png',
  './icons/favicon-home-180.png',
  './icons/favicon-home-192.png',
  './icons/favicon-home-512.png',
  './icons/favicon-zh-180.png',
  './icons/favicon-zh-192.png',
  './icons/favicon-zh-512.png',
  './icons/favicon-ko-180.png',
  './icons/favicon-ko-192.png',
  './icons/favicon-ko-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for navigations / HTML so updates ship promptly when online.
  const isHTML =
    req.mode === 'navigate' ||
    (req.destination === '' && req.headers.get('accept')?.includes('text/html')) ||
    req.destination === 'document';

  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Cache-first for everything else (icons, manifests, etc.)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});
