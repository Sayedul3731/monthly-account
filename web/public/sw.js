const CACHE_NAME = "daily-hisab-shell-v2";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = ["/", OFFLINE_URL, "/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("daily-hisab-") && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(request)) || (await cache.match("/")) || (await cache.match(OFFLINE_URL)) || Response.error();
        }),
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    ["font", "image", "script", "style"].includes(request.destination);

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "PRECACHE_ASSETS" || !Array.isArray(event.data.urls)) return;

  const urls = event.data.urls.filter((url) => {
    try {
      return new URL(url, self.location.origin).origin === self.location.origin;
    } catch {
      return false;
    }
  });
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urls)));
});
