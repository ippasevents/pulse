import type { Metadata, Viewport } from 'next';
import './globals.css';
import AuthGate from '@/components/AuthGate';

export const viewport: Viewport = {
  themeColor: '#e11d48',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
};

export const metadata: Metadata = {
  title: 'IPPAS Pulse - Catering Manager',
  description: 'Catering event management: events, clients, quotes, menu recipes, stock, staff scheduling, invoices, and payments.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'IPPAS Pulse'
  },
  icons: {
    icon: '/favicon.png?v=2',
    shortcut: '/favicon.png?v=2',
    apple: '/favicon.png?v=2'
  },
  openGraph: {
    title: 'IPPAS Pulse - Catering Manager',
    description: 'Catering event management: events, clients, quotes, menu recipes, stock, staff scheduling, invoices, and payments.'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
