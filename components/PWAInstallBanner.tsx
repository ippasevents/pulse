'use client';

import React, { useState, useEffect } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { PWAInstallButton } from './PWAInstallButton';

export function PWAInstallBanner() {
  const { isInstalled } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDismissed =
        localStorage.getItem('ippas_pwa_banner_dismissed') === 'true' ||
        localStorage.getItem('ippas_pwa_installed') === 'true' ||
        sessionStorage.getItem('ippas_pwa_banner_dismissed') === 'true';
      if (isDismissed) setDismissed(true);
    }
  }, []);

  // Strict check: If already installed or dismissed by user, do NOT render the banner at all
  if (isInstalled || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ippas_pwa_banner_dismissed', 'true');
      sessionStorage.setItem('ippas_pwa_banner_dismissed', 'true');
    }
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#ffffff',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        border: '1px solid #334155',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: '260px' }}>
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            background: '#ffffff',
            border: '1px solid rgba(225, 29, 72, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            flexShrink: 0,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <img
            src="/favicon.png"
            alt="IPPAS Icon"
            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }}
          />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span>Install IPPAS Pulse as a Mobile App</span>
            <span
              style={{
                fontSize: '0.68rem',
                background: '#e11d48',
                color: '#fff',
                padding: '0.1rem 0.45rem',
                borderRadius: '4px',
                fontWeight: 800,
                letterSpacing: '0.5px'
              }}
            >
              PWA APP
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0 0', lineHeight: 1.4 }}>
            ഫോണിൽ ആപ്പ് ആയി ഇൻസ്റ്റാൾ ചെയ്ത് ഒറ്റ ടാപ്പിൽ കാറ്ററിംഗ് ഇവന്റുകൾ, കൊട്ടേഷൻ, ബില്ലുകൾ എന്നിവ കൈകാര്യം ചെയ്യാം.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <PWAInstallButton variant="banner" />
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '0.4rem',
            fontSize: '1rem',
            lineHeight: 1
          }}
          title="Dismiss banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default PWAInstallBanner;
