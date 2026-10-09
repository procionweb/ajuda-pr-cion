self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch {}
  const href = typeof payload.href === 'string' && payload.href.startsWith('/') && !payload.href.startsWith('//') ? payload.href : '/';
  event.waitUntil(self.registration.showNotification(payload.title || 'CRM Prócion', {
    body: payload.body || 'Você tem uma nova notificação no CRM.',
    tag: payload.tag, icon: '/favicon.ico', data: { href },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href;
  if (!href) return;
  const target = new URL(href, self.location.origin);
  if (target.origin !== self.location.origin) return;
  const url = target.href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        await existing.focus();
        await existing.navigate(url);
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});
