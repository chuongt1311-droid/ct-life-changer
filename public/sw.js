const CACHE_NAME = 'life-changer-shell-v1';
const SHELL_URLS = ['/', '/offline'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle same-origin page navigations. Every API call, mentor stream
  // and Supabase request goes straight to the network, untouched.
  if (request.mode !== 'navigate') return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(request)) ?? (await cache.match('/offline'));
    }),
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const { title, body } = event.data.json();
  event.waitUntil(self.registration.showNotification(title, { body, icon: '/icon', badge: '/icon' }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      const existing = clientList.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    }),
  );
});
