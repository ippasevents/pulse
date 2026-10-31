'use client';

import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { PWAInstallButton } from './PWAInstallButton';

export default function PWAInstallBanner() {
  const { isInstalled, isInstallable, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (isInstalled || dismissed) {
    return null;
  }

  // When browser 1-tap WebAPK prompt is ready, render ultra-clean 1-tap card
  if (isInstallable) {
    return (
      <div
        className="no-print"
        style={{
          background: 'linear-gradient(135deg, #fff1f2 0%, #eef2ff 55%, #ecfdf5 100%)',
          border: '1px solid #fecdd3',
          borderRadius: '12px',
          padding: '0.85rem 1.1rem',
          marginBottom: '1.35rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <img
            src="/pwa-192x192.png"
            alt="IPPAS Pulse"
            referrerPolicy="no-referrer"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              border: '1px solid #fda4af',
              flexShrink: 0
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
              Install IPPAS Pulse on Your Phone / Desktop
            </div>
            <div style={{ fontSize: '0.78rem', color: '#475569' }}>
              Adds icon to your App Drawer &amp; Home Screen in 1 tap &middot; Zero extra permissions needed
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
          <button
            type="button"
            disabled={installing}
            onClick={async () => {
              setInstalling(true);
              await install();
              setInstalling(false);
            }}
            className="btn btn-primary btn-sm"
            style={{
              fontWeight: 700,
              padding: '0.48rem 0.95rem',
              whiteSpace: 'nowrap',
              borderRadius: '8px'
            }}
          >
            {installing ? 'Installing...' : '📲 1-Tap Install App'}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.42rem 0.6rem' }}
            title="Hide banner"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="no-print" style={{ marginBottom: '1.25rem' }}>
      <PWAInstallButton variant="banner" />
    </div>
  );
}
