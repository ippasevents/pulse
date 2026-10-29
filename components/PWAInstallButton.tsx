'use client';

import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'nav' | 'banner' | 'card' | 'bottom';
  showAlways?: boolean;
}

export function PWAInstallButton({
  className = '',
  variant = 'nav',
  showAlways = false
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  // If already installed and running standalone, hide unless forced
  if (isInstalled && !showAlways) {
    if (variant === 'card' || variant === 'banner') {
      return (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '6px',
            background: '#dcfce7',
            color: '#15803d',
            fontSize: '0.8rem',
            fontWeight: 600
          }}
        >
          <span>✓</span>
          <span>App Installed on Home Screen</span>
        </div>
      );
    }
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const outcome = await install();
      if (!outcome) {
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  const renderButton = () => {
    if (variant === 'banner') {
      return (
        <button
          type="button"
          onClick={handleClick}
          className={`btn btn-primary ${className}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 700,
            fontSize: '0.9rem',
            padding: '0.55rem 1.1rem',
            boxShadow: '0 2px 4px rgba(225, 29, 72, 0.25)'
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>📲</span>
          <span>Install App on Phone / PC</span>
        </button>
      );
    }

    if (variant === 'card') {
      return (
        <button
          type="button"
          onClick={handleClick}
          className={`btn btn-primary ${className}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            fontWeight: 600,
            fontSize: '0.85rem'
          }}
        >
          <span>📲</span>
          <span>ആപ്പ് ഇൻസ്റ്റാൾ ചെയ്യുക (Install App)</span>
        </button>
      );
    }

    // Default Nav Button
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`btn btn-primary btn-sm ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: '0.75rem',
          padding: '0.3rem 0.65rem',
          borderRadius: '6px',
          fontWeight: 700,
          background: '#e11d48',
          color: '#ffffff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}
        title="Install IPPAS Pulse as an app on your phone or laptop"
      >
        <span>📲</span>
        <span>Install App</span>
      </button>
    );
  };

  return (
    <>
      {renderButton()}

      {/* Comprehensive Cross-Platform Installation Guide Modal */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowModal(false)}
          style={{ zIndex: 100 }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', padding: '1.5rem' }}
          >
            <div className="modal-header" style={{ marginBottom: '1rem', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>📲</span>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                    Install IPPAS Pulse
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                    ഫോണിലും കമ്പ്യൂട്ടറിലും ആപ്പ് ആയി ഇൻസ്റ്റാൾ ചെയ്യാം
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Direct prompt trigger if available */}
            {isInstallable && (
              <div style={{ marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  onClick={async () => {
                    await install();
                    setShowModal(false);
                  }}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.7rem', fontWeight: 700, fontSize: '0.95rem' }}
                >
                  🚀 Click Here to Install Now
                </button>
              </div>
            )}

            <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6 }}>
              {/* Android Instructions */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  marginBottom: '0.85rem'
                }}
              >
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🤖</span>
                  <span>Android ഫോണുകളിൽ (Google Chrome):</span>
                </div>
                <ol style={{ paddingLeft: '1.25rem', margin: 0, fontSize: '0.8rem' }}>
                  <li style={{ marginBottom: '0.3rem' }}>
                    മുകളിൽ വലതുവശത്തുള്ള <strong>മൂന്ന് കുത്തുകൾ (⋮)</strong> അമർത്തുക.
                  </li>
                  <li style={{ marginBottom: '0.3rem' }}>
                    <strong>"Install app"</strong> അല്ലെങ്കിൽ <strong>"Add to Home screen"</strong> തിരഞ്ഞെടുക്കുക.
                  </li>
                  <li>
                    <strong>"Install"</strong> അമർത്തുക. നിങ്ങളുടെ ഫോൺ സ്ക്രീനിൽ ആപ്പ് ഐക്കൺ വരുന്നതാണ്.
                  </li>
                </ol>
              </div>

              {/* iPhone / iPad Instructions */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  marginBottom: '0.85rem'
                }}
              >
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>🍎</span>
                  <span>iPhone / iPad (Apple Safari):</span>
                </div>
                <ol style={{ paddingLeft: '1.25rem', margin: 0, fontSize: '0.8rem' }}>
                  <li style={{ marginBottom: '0.3rem' }}>
                    സഫാരി ബ്രൗസറിന്റെ താഴെയുള്ള <strong>Share ബട്ടൺ</strong> (ചതുരത്തിൽ മുകളിലേക്ക് അമ്പടയാളം ഉള്ളത്) അമർത്തുക.
                  </li>
                  <li style={{ marginBottom: '0.3rem' }}>
                    താഴേക്ക് സ്ക്രോൾ ചെയ്ത് <strong>"Add to Home Screen"</strong> തിരഞ്ഞെടുക്കുക.
                  </li>
                  <li>
                    മുകളിൽ വലതുവശത്തുള്ള <strong>"Add"</strong> അമർത്തുക.
                  </li>
                </ol>
              </div>

              {/* Laptop / PC Instructions */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.85rem',
                  marginBottom: '1rem'
                }}
              >
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>💻</span>
                  <span>Laptop / Desktop (Chrome / Edge):</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem' }}>
                  മുകളിൽ അഡ്രസ് ബാറിന്റെ (URL) വലതുവശത്തുള്ള <strong>Install ചിഹ്നം (⊕ അല്ലെങ്കിൽ 💻)</strong> ക്ലിക്ക് ചെയ്ത് <strong>"Install"</strong> കൊടുക്കുക.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="btn btn-secondary"
                style={{ width: '100%' }}
              >
                Got It / ശരി മനസ്സിലായി
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default PWAInstallButton;
