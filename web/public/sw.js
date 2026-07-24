const CACHE = "executa-shell-v5";
const SHELL = ["/", "/app", "/blog", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    /^\/(api|mcp|oauth|view|dashboard)(\/|$)/.test(url.pathname)
  ) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => {
        if (url.pathname.startsWith("/app")) return caches.match("/app");
        if (url.pathname.startsWith("/blog")) return caches.match("/blog");
        return caches.match("/");
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
