/* HSK Reader — GitHub Pages-compatible offline shell.
   Version the cache name when changing the service worker or static assets.
   Third-party Hanzi Writer scripts/data and MyMemory translation are not cached. */
const CACHE_NAME = "hsk-reader-pwa-v1";
const APP_SHELL = [
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];
const APP_SHELL_URLS = new Set(APP_SHELL.map(path => new URL(path, self.registration.scope).href));

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith("hsk-reader-pwa-") && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Network-first navigation ensures new HTML deploys are picked up online.
  // If offline, fall back to the last cached application document.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(new URL("./index.html", self.registration.scope), response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(new URL("./index.html", self.registration.scope))) || Response.error();
      }
    })());
    return;
  }

  // Cache first for the small local manifest/icon assets only.
  if (APP_SHELL_URLS.has(request.url)) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
  }
});
