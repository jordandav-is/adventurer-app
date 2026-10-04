/* Fingerprinted build assets (the app bundle, the compendium, the bestiary) are served from the cache once fetched;
   everything else is network-first and falls back to the cache when the tavern has no signal. */
const CACHE = "ledger-v3";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

const fetchAndCache = (request, opts) => fetch(request, opts).then((res) => {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
  }
  return res;
});

self.addEventListener("fetch", (e) => {
  // same-origin GETs only: sync/API traffic must never land in the offline cache
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  if (new URL(e.request.url).pathname.includes("/assets/")) {
    e.respondWith(caches.match(e.request).then((hit) => hit || fetchAndCache(e.request)));
    return;
  }
  const opts = e.request.mode === "navigate" ? { cache: "reload" } : undefined;
  e.respondWith(fetchAndCache(e.request, opts).catch(() => caches.match(e.request)));
});
