/* Wanderloom PWA — installability + background Web Push */
const CACHE = 'wanderloom-pwa-v2';
const PRECACHE = ['/manifest.json', '/icon-192.png', '/icon-512.png', '/crm'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isPublicDnaPath =
    url.pathname === '/welcome/vip' ||
    url.pathname.startsWith('/welcome/vip/') ||
    url.pathname === '/welcome/client' ||
    url.pathname.startsWith('/welcome/client/') ||
    url.pathname === '/welcome' ||
    url.pathname.startsWith('/welcome/') ||
    url.pathname === '/onboarding' ||
    url.pathname.startsWith('/onboarding/') ||
    url.pathname === '/dna-success';

  // DNA links must always hit the network — never serve a stale cached error or /crm fallback
  if (isPublicDnaPath) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        if (response.ok && request.url.startsWith(self.location.origin)) {
          caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/crm'))),
  );
});

/** Background Web Push → OS notification (works even when app is closed) */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: 'رسالة جديدة - Wanderloom',
      body: event.data ? event.data.text() : 'لديك رسالة جديدة من الفريق',
    };
  }

  const title = data.title || 'رسالة جديدة - Wanderloom';
  const options = {
    body: data.body || 'لديك رسالة جديدة من الفريق',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: data.tag || 'wanderloom-team-chat',
    renotify: true,
    data: {
      url: data.url || '/crm',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/crm';

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if ('focus' in client && client.url.includes('/crm')) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              /* ignore navigate errors */
            }
          }
          return;
        }
      }

      if (clients.openWindow) {
        await clients.openWindow(targetUrl);
      }
    })(),
  );
});
