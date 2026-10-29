import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'IPPAS Pulse - Catering Manager',
    short_name: 'IPPAS Pulse',
    description: 'Catering event management: events, clients, quotes, menu recipes, stock, shifts, and invoices.',
    start_url: '/?mode=standalone',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#e11d48',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
}
