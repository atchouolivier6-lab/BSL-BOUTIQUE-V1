// Service worker BSL Zénith : réseau d'abord, copie locale seulement si hors connexion.
// Ne touche JAMAIS aux requêtes vers Supabase ou les CDN (autre origine) : aucune donnée privée n'est mise en cache.
const CACHE = "bsl-v4";
const PRECACHE = ["offline.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(PRECACHE.map(u => c.add(u).catch(() => {}))))   // un fichier manquant ne bloque plus l'installation
      .then(() => self.skipWaiting())
  );
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
    (req.mode === "navigate" ? fetch(req) : fetch(req.url, { cache: "no-cache" }))   // revérifie auprès du serveur : pas d'ancienne version
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() =>
        caches.match(req).then(hit => hit || (req.mode === "navigate" ? caches.match("offline.html") : Response.error()))
      )
  );
});

// ---------- Notifications du téléphone (Web Push) ----------
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) {}
  e.waitUntil((async () => {
    const wins = await clients.matchAll({ type: "window", includeUncontrolled: true });
    if (wins.some(c => c.visibilityState === "visible")) return;      // application ouverte : l'alerte s'affiche déjà dedans
    await self.registration.showNotification(d.title || "BSL Zénith", {
      body: d.body || "", icon: "icons/icon-192.png", badge: "icons/badge-96.png",
      tag: d.kind || "bsl", renotify: true, data: { url: d.url || "index.html" },
    });
  })());
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "index.html", self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) { if ("focus" in c) { c.navigate(target); return c.focus(); } }
    return clients.openWindow(target);
  }));
});
