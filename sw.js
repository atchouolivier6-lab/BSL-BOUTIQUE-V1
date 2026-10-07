// Service worker BSL Zénith : réseau d'abord, copie locale seulement si hors connexion.
// Ne touche JAMAIS aux requêtes vers Supabase ou les CDN (autre origine) : aucune donnée privée n'est mise en cache.
const CACHE = "bsl-v1";
const PRECACHE = ["offline.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;           // Supabase, CDN : on laisse passer tel quel

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || (req.mode === "navigate" ? caches.match("offline.html") : Response.error()))
      )
  );
});
