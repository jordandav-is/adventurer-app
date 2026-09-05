/* Network-first service worker: always tries the network for fresh builds,
   falls back to cache when the tavern has no signal. Cache name is versioned
   by build via query param busting on registration. */
const CACHE = "ledger-v2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // same-origin GETs only: sync/API traffic must never land in the offline cache
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  const opts = e.request.mode === "navigate" ? { cache: "reload" } : undefined;
  e.respondWith(
    fetch(e.request, opts)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
