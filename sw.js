const C="blocaccord-v2";
self.addEventListener("install",e=>{ self.skipWaiting(); e.waitUntil(caches.open(C).then(c=>c.addAll(["./","index.html","manifest.json","icon.svg"]))); });
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x))))));
// Le planning partagé ne passe jamais par le cache ; les pages : réseau d'abord, cache si hors ligne.
self.addEventListener("fetch",e=>{ const u=new URL(e.request.url); if(u.pathname.startsWith("/api/")||e.request.method!=="GET") return;
  e.respondWith(fetch(e.request).then(r=>{ const c=r.clone(); caches.open(C).then(x=>x.put(e.request,c)); return r; }).catch(()=>caches.match(e.request))); });
