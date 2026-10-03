// Service worker de l'appli (PWA). Voir ARCHITECTURE.md, section « PWA et hors-ligne ».
// Incrémenter SW_VERSION quand la liste de pré-cache (CORE / CDN) change : les anciens caches sont alors supprimés.
const SW_VERSION = 1;
const STATIC = `popmart-static-v${SW_VERSION}`;   // fichiers de l'appli (même origine)
const RUNTIME = `popmart-runtime-v${SW_VERSION}`;  // bibliothèques CDN et polices
const NET_TIMEOUT = 4000;                          // au-delà, on sert la copie en cache (la mise à jour continue en arrière-plan)

const CORE = ['./', 'index.html', 'exchange.js', 'products.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/icon.svg'];
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Flip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
];
// Seuls ces hébergeurs (qui autorisent CORS) sont mis en cache. Tout le reste n'est PAS intercepté :
// API Supabase (jetons, partages chiffrés) et images du catalogue (sans CORS : réponses opaques trop lourdes pour le quota).
const CDN_HOSTS = new Set(['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com']);

const ROOT = new URL('./', self.location).href;
const keyFor = (req) => (req.mode === 'navigate' ? ROOT : req);
const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC);
    await cache.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })));
    const runtime = await caches.open(RUNTIME);
    await Promise.all(CDN.map(async (u) => {
      try { const r = await fetch(u, { mode: 'cors' }); if (r.ok) await runtime.put(u, r); } catch {}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('popmart-') && k !== STATIC && k !== RUNTIME) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Même origine : réseau d'abord (toujours la dernière version en ligne), copie en cache hors-ligne ou si le réseau est trop lent
async function networkFirst(req) {
  const cache = await caches.open(STATIC);
  const net = fetch(req.mode === 'navigate' ? req.url : req, { cache: 'no-cache' }).then((res) => {
    if (res.ok && res.type === 'basic') cache.put(keyFor(req), res.clone());
    return res;
  });
  net.catch(() => {});
  try {
    return await Promise.race([net, timeout(NET_TIMEOUT)]);
  } catch {
    const hit = await cache.match(keyFor(req)) ?? (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
    if (hit) return hit;
    try { return await net; } catch { return Response.error(); }
  }
}

// CDN et polices : copie en cache servie tout de suite, mise à jour en arrière-plan
async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(req);
  const net = fetch(req.mode === 'cors' ? req : req.url, { mode: 'cors' })
    .catch(() => fetch(req))
    .then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; })
    .catch(() => null);
  if (hit) { event.waitUntil(net); return hit; }
  return (await net) ?? Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(req));
  else if (CDN_HOSTS.has(url.hostname)) event.respondWith(staleWhileRevalidate(event, req));
});
