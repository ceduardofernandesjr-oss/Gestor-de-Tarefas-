// Service worker do Gestor de Tarefas: permite uso offline e instalação como app.
// Páginas: rede primeiro (deploys novos aparecem logo), com cache como reserva offline.
// Demais arquivos (ícones, Tailwind, Lucide, fontes): cache primeiro, atualizando em segundo plano.
const CACHE = 'gestor-tarefas-v2';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/favicon-32.png', 'icons/logo-96.png',
              'icons/logo-192.png', 'icons/logo-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('gestor-tarefas-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const update = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || update;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  // Login e sincronização (Supabase) e páginas de login do Google: sempre direto na rede, nunca do cache.
  if (url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in') || url.hostname === 'accounts.google.com') return;
  const sameOrigin = url.origin === self.location.origin;
  const isPage = req.mode === 'navigate' || (sameOrigin && (url.pathname.endsWith('/') || url.pathname.endsWith('.html')));
  e.respondWith(isPage ? networkFirst(req) : staleWhileRevalidate(req));
});
