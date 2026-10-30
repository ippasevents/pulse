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
    icon: '/favicon.png?v=3',
    shortcut: '/favicon.png?v=3',
    apple: '/apple-touch-icon.png?v=3'
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
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="IPPAS Pulse" />
        <meta name="application-name" content="IPPAS Pulse" />
        <meta name="theme-color" content="#e11d48" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Noto+Sans+Malayalam:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
