/* Habitizer service worker — caches the app shell for offline/install use. */
const CACHE_VERSION = "habitizer-shell-v4";
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles.css?v=empty-states3",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
  "./js/main.js",
  "./js/main.js?v=empty-states3",
  "./js/state.js",
  "./js/dom.js",
  "./js/constants.js",
  "./js/i18n.js",
  "./js/utils.js",
  "./js/models.js",
  "./js/persistence.js",
  "./js/views.js",
  "./js/events.js",
  "./js/modals.js",
  "./js/routines.js",
  "./js/timer.js",
  "./js/drag.js",
  "./js/delete.js",
  "./js/backup.js",
  "./js/audio.js",
  "./js/pwa.js",
  "./js/id.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App shell: prefer network so updates land quickly, fall back to cache offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          return caches.match("./index.html");
        }
        return Response.error();
      })
  );
});
