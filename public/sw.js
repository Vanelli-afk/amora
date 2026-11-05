// Service worker do Amora. De propósito, nunca guarda páginas nem dados:
// só arquivos estáticos públicos, para nada privado sobrar no aparelho depois de sair.
const VERSION = "amora-v1";
const OFFLINE_URL = "/offline.html";
const MAX_ASSETS = 150;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

const isPublicAsset = (url) => url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (isPublicAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches.open(VERSION).then(async (cache) => {
            await cache.put(request, copy);
            const keys = await cache.keys();
            const extra = keys.filter((k) => new URL(k.url).pathname.startsWith("/_next/static/")).slice(0, Math.max(0, keys.length - MAX_ASSETS));
            await Promise.all(extra.map((k) => cache.delete(k)));
          });
        }
        return response;
      })),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "Amora", body: "", url: "/hoje" };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    // Mensagem fora do formato: mostra o aviso genérico.
  }
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data?.url ?? "/hoje";
  // Só caminhos internos: uma notificação nunca abre outro site.
  const path = typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/hoje";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        return open.focus().then((focused) => focused.navigate(path));
      }
      return self.clients.openWindow(path);
    }),
  );
});
