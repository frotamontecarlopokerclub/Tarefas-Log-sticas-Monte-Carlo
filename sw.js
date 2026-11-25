// Facilities MC · service worker (v60)
// Só mostra as notificações de nova missão e abre o app ao tocar nelas.
// Não guarda nada em cache: o sistema continua sempre na versão mais nova.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil((async () => {
    const abertos = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abertos) {
      try { if ("navigate" in c) await c.navigate(url); } catch (err) {}
      if ("focus" in c) return c.focus();
    }
    return self.clients.openWindow(url);
  })());
});
