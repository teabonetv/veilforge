/* Offline cache for the hosted / PWA build. Native shells skip this file. */
const CACHE = "veilforge-v8";
const PRECACHE = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/main.js",
  "./js/platform.js",
  "./js/vendor/three.module.js",
  "./manifest.webmanifest",
  "./branding/icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const dest = req.destination;
  const live = dest === "script" || dest === "style" || dest === "document" || dest === "worker"
    || /\.(js|mjs|css|html|webmanifest)$/i.test(url.pathname)
    || url.pathname.endsWith("/");
  if (live) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
