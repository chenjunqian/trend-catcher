const CACHE = "trend-catcher-v2";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll([
        "/",
        "/offline",
        "/manifest.json",
        "/favicon-32x32.png",
        "/apple-touch-icon.png",
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    (async () => {
      if (event.request.mode === "navigate") {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            const cache = await caches.open(CACHE);
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cached = await caches.match(event.request);
          return cached || caches.match(OFFLINE_URL);
        }
      }

      const cached = await caches.match(event.request);
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => {
              cache.put(event.request, clone);
            });
          }
        })
        .catch(() => {});

      return cached || fetch(event.request).catch(() => caches.match(OFFLINE_URL));
    })()
  );
});
