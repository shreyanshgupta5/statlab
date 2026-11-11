/* ONE F1 service worker: works offline and keeps data fresh.
   - The page and data.js: network first, so new results show up as soon as you deploy; cached copy when offline.
   - Everything else (styles, script, icons, fonts): cache first, refreshed in the background.
   Bump VERSION when you change styles.css or app.js so phones pick up the new files. */
const VERSION = "statlab-v22";
const CORE = ["./", "index.html", "styles.css", "app.js", "data.js", "duels.js", "previews.js", "play.js", "manifest.webmanifest", "icons/icon-192-speed-cut.png", "icons/icon-512-speed-cut.png", "icons/maskable-512-speed-cut.png", "icons/apple-touch-icon-speed-cut.png"];

self.addEventListener("install", (e) => {
  // cache: "reload" skips the browser's HTTP cache, so a new version never stores the previous files
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return;

  const fresh = req.mode === "navigate" || url.pathname.endsWith("/data.js") || url.pathname.endsWith("/previews.js");
  if (fresh) {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match("index.html")))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
