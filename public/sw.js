// IPPAS Pulse PWA Service Worker (Strictly Online-Only — Zero Offline Page Caching)
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
      background: #0f172a;
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
      border-radius: 16px;
      padding: 2.5rem 2rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(239, 68, 68, 0.15);
      border: 2px solid #ef4444;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem auto;
      font-size: 1.75rem;
    }
    h1 { font-size: 1.45rem; font-weight: 800; color: #ffffff; margin-bottom: 0.65rem; }
    p { font-size: 0.9rem; color: #94a3b8; line-height: 1.6; margin-bottom: 1.5rem; }
    button {
      width: 100%;
      background: #e11d48;
      color: #ffffff;
      border: none;
      padding: 0.75rem 1rem;
      font-size: 0.92rem;
      font-weight: 700;
      border-radius: 8px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📡</div>
    <h1>Internet Disconnected</h1>
    <p>No active internet connection to Supabase database. Please reconnect to the internet to continue — offline viewing is disabled.</p>
    <button type="button" onclick="window.location.reload()">Retry Connection</button>
  </div>
  <script>
    window.addEventListener('online', function () { window.location.reload(); });
  </script>
</body>
</html>`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

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

  event.respondWith(fetch(event.request));
});
