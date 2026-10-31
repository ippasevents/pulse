// IPPAS Pulse PWA Service Worker
// Caches ONLY static manifest & app icons for instant Android WebAPK App-Drawer + Home Screen installation.
// All application pages and database queries remain strictly live online-only.

const SHELL_CACHE = 'ippas-pwa-shell-v4';
const STATIC_ICON_ASSETS = [
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
  '/logo.png'
];

const OFFLINE_DISCONNECTED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Internet Disconnected - IPPAS Pulse</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body {
      min-height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      text-align: center;
    }
    .card {
      max-width: 420px;
      width: 100%;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 18px;
      padding: 2.25rem 1.85rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .icon {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: rgba(225, 29, 72, 0.16);
      border: 2px solid #fb7185;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.15rem auto;
      font-size: 1.65rem;
    }
    h1 { font-size: 1.4rem; font-weight: 800; color: #ffffff; margin-bottom: 0.6rem; }
    p { font-size: 0.9rem; color: #cbd5e1; line-height: 1.6; margin-bottom: 1.4rem; }
    button {
      width: 100%;
      background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
      color: #ffffff;
      border: none;
      padding: 0.8rem 1rem;
      font-size: 0.92rem;
      font-weight: 700;
      border-radius: 10px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📡</div>
    <h1>Internet Disconnected</h1>
    <p>Please reconnect to the internet to sync live catering records from the cloud database.</p>
    <button type="button" onclick="window.location.reload()">Retry Connection</button>
  </div>
  <script>
    window.addEventListener('online', function () { window.location.reload(); });
  </script>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(STATIC_ICON_ASSETS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Fast cache-first response for manifest & app icons so Android WebAPK minting always succeeds
  if (url.origin === self.location.origin && STATIC_ICON_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((c) => c.put(event.request, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Strictly online-only navigation with clean offline fallback screen
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(OFFLINE_DISCONNECTED_HTML, {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          })
      )
    );
    return;
  }
});
