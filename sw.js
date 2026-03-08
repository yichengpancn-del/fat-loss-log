const url = new URL(self.location.href);
const version = url.searchParams.get("v") || "1";
const CACHE_NAME = `weight-carb-cache-${version}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (
    requestUrl.pathname.includes("/auth/") ||
    requestUrl.pathname.includes("/rest/") ||
    requestUrl.pathname.includes("/storage/") ||
    requestUrl.pathname.includes("/functions/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put("./index.html", fresh.clone());
          return fresh;
        } catch (error) {
          const cached = await caches.match("./index.html");
          return (
            cached ||
            new Response("离线状态下无法加载页面。", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" }
            })
          );
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) {
        return cached;
      }

      try {
        const fresh = await fetch(request);

        if (
          fresh &&
          fresh.status === 200 &&
          (request.destination === "script" ||
            request.destination === "style" ||
            request.destination === "document" ||
            request.destination === "manifest" ||
            request.destination === "image" ||
            request.destination === "font")
        ) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, fresh.clone());
        }

        return fresh;
      } catch (error) {
        const fallback = await caches.match("./index.html");
        if (request.destination === "document" && fallback) {
          return fallback;
        }

        return new Response("资源离线不可用。", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })()
  );
});