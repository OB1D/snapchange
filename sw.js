/* SnapChange service worker — offline-first, stale-while-revalidate.
 * Bump CACHE_VERSION whenever the shell changes so clients pick up the new version. */
'use strict';

const CACHE_VERSION = 'snapchange-v2.1.0';
const SHELL = './index.html';
const PRECACHE = ['./', SHELL, './manifest.json', './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('snapchange-') && k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Every navigation (including deep links such as ?bill=11.70&note=20) is served by the single-file shell.
  const isNav = req.mode === 'navigate';
  const shellUrl = new URL(SHELL, self.registration.scope).href;
  const key = isNav ? shellUrl : url.origin + url.pathname;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(key);

    const network = fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          return cache.put(key, res.clone()).then(() => res, () => res);
        }
        return res;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(network); // refresh the cache in the background
      return cached;
    }
    const fresh = await network;
    if (fresh) return fresh;
    if (isNav) {
      const shell = await cache.match(shellUrl);
      if (shell) return shell;
    }
    return new Response('SnapChange is offline and this resource is not cached yet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  })());
});
