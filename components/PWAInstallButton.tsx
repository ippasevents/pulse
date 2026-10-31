'use client';

import React, { useEffect, useState } from 'react';
import { usePWAInstall } from './usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'banner' | 'bottom' | 'login' | 'card';
  showAlways?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'navbar',
  showAlways = false
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [installingNow, setInstallingNow] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsAndroid(/android/i.test(navigator.userAgent || ''));
    }
  }, []);

  if (isInstalled && !showAlways) {
    return null;
  }

  const handleOneTapInstall = async () => {
    if (isInstalled) return;
    if (isInstallable) {
      setInstallingNow(true);
      const accepted = await install();
      setInstallingNow(false);
      if (accepted) {
        setShowQuickGuide(false);
      }
      return;
    }
    setShowQuickGuide(true);
  };

  const renderTrigger = () => {
    if (variant === 'bottom') {
      return (
        <button
          type="button"
          onClick={handleOneTapInstall}
          className="mobile-nav-item"
          style={{ color: '#e11d48', fontWeight: 700 }}
        >
          <span className="mobile-nav-icon">📲</span>
          <span className="mobile-nav-label" style={{ whiteSpace: 'nowrap' }}>
            {installingNow ? 'Installing...' : 'Install App'}
          </span>
        </button>
      );
    }

    if (variant === 'login') {
      return (
        <button
          type="button"
          onClick={handleOneTapInstall}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.55rem',
            padding: '0.72rem 1rem',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #eef2ff 0%, #fdf2f8 100%)',
            color: '#be123c',
            border: '1px solid #fbcfe8',
            fontWeight: 700,
            fontSize: '0.86rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease'
          }}
        >
          <span>📲</span>
          <span>
            {isInstalled
              ? '✓ IPPAS Pulse App Installed'
              : installingNow
              ? 'Installing App...'
              : 'Install IPPAS Pulse App (1-Tap)'}
          </span>
        </button>
      );
    }

    if (variant === 'banner' || variant === 'card') {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #fff1f2 0%, #eef2ff 100%)',
            border: '1px solid #fecdd3',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0 }}>
            <img
              src="/pwa-192x192.png"
              alt="IPPAS Pulse"
              referrerPolicy="no-referrer"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                border: '1px solid #fda4af',
                flexShrink: 0
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                {isInstalled ? 'IPPAS Pulse Installed' : 'Install IPPAS Pulse App'}
              </div>
              <div style={{ fontSize: '0.74rem', color: '#475569' }}>
                Adds icon to App Drawer &amp; Home Screen • No permissions needed
              </div>
            </div>
          </div>

          {!isInstalled && (
            <button
              type="button"
              onClick={handleOneTapInstall}
              className="btn btn-primary btn-sm"
              style={{
                fontWeight: 700,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                padding: '0.45rem 0.9rem',
                borderRadius: '8px'
              }}
            >
              {installingNow ? 'Installing...' : '📲 Install Now'}
            </button>
          )}
        </div>
      );
    }

    // Default: Compact Navbar Action Button
    return (
      <button
        type="button"
        onClick={handleOneTapInstall}
        style={{
          background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '0.38rem 0.72rem',
          fontSize: '0.78rem',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          boxShadow: '0 2px 6px rgba(225, 29, 72, 0.22)',
          transition: 'transform 0.15s ease, opacity 0.15s ease'
        }}
        title="Install IPPAS Pulse on your phone or computer — zero extra permissions needed"
      >
        <span>📲</span>
        <span>{installingNow ? 'Installing...' : 'Install App'}</span>
      </button>
    );
  };

  return (
    <>
      {renderTrigger()}

      {showQuickGuide && (
        <div className="modal-overlay" onClick={() => setShowQuickGuide(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '430px', padding: '1.35rem' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                paddingBottom: '0.9rem',
                marginBottom: '1rem',
                borderBottom: '1px solid #e2e8f0'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <img
                  src="/pwa-192x192.png"
                  alt="IPPAS Pulse Icon"
                  referrerPolicy="no-referrer"
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '11px',
                    border: '1px solid #fecdd3'
                  }}
                />
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Install IPPAS Pulse App
                  </h3>
                  <div style={{ fontSize: '0.76rem', color: '#059669', fontWeight: 600 }}>
                    ✓ App Drawer Icon + Home Screen Shortcut
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowQuickGuide(false)}
              >
                ✕
              </button>
            </div>

            {isInstallable ? (
              <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <p style={{ fontSize: '0.88rem', color: '#334155', marginBottom: '1rem', lineHeight: 1.6 }}>
                  Install <strong>IPPAS Pulse</strong> alongside your phone&apos;s other apps and on your Home Screen in a single tap. No special permissions are required.
                </p>
                <button
                  type="button"
                  onClick={handleOneTapInstall}
                  className="btn btn-primary"
                  style={{ width: '100%', fontWeight: 700, padding: '0.75rem 1rem' }}
                >
                  📲 Install App Now
                </button>
              </div>
            ) : isIOS ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '0.9rem 1rem',
                    fontSize: '0.86rem',
                    color: '#1e293b',
                    lineHeight: 1.65
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>
                    Add to iPhone / iPad Home Screen (2 Steps):
                  </div>
                  <div>
                    <strong>1.</strong> Tap the <strong>Share (⬆️)</strong> button at the bottom of Safari.
                  </div>
                  <div style={{ marginTop: '0.25rem' }}>
                    <strong>2.</strong> Select <strong>&ldquo;Add to Home Screen&rdquo;</strong> and tap <strong>Add</strong>.
                  </div>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  The IPPAS Pulse app icon will appear immediately on your Home Screen — no extra permissions needed.
                </div>
              </div>
            ) : isAndroid ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '0.9rem 1rem',
                    fontSize: '0.86rem',
                    color: '#1e293b',
                    lineHeight: 1.65
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>
                    Install on Android Smartphone (2 Steps):
                  </div>
                  <div>
                    <strong>1.</strong> Tap the <strong>⋮ (Menu)</strong> icon at the top right of Chrome.
                  </div>
                  <div style={{ marginTop: '0.25rem' }}>
                    <strong>2.</strong> Select <strong>&ldquo;Install app&rdquo;</strong> (or <em>Add to Home screen</em>) and tap <strong>Install</strong>.
                  </div>
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  IPPAS Pulse will automatically appear in your App Drawer and Home Screen — zero extra permissions needed.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '0.9rem 1rem',
                    fontSize: '0.86rem',
                    color: '#1e293b',
                    lineHeight: 1.65
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem' }}>
                    Quick Desktop / Browser Install:
                  </div>
                  <div>
                    Click the <strong>Install icon (⊕)</strong> on the right side of your browser address bar, or open browser menu <strong>⋮ &rarr; Install IPPAS Pulse</strong>.
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowQuickGuide(false)}
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: '1rem', fontWeight: 600 }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
