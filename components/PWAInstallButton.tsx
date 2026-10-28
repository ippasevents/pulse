'use client';

import React, { useState } from 'react';
import { usePWAInstall } from './usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="btn btn-primary btn-sm"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: '0.75rem',
          padding: '0.3rem 0.6rem',
          borderRadius: '6px',
          fontWeight: 600
        }}
      >
        <span>📲</span>
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="btn btn-secondary btn-sm"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            padding: '0.3rem 0.6rem',
            borderRadius: '6px'
          }}
        >
          <span>📲</span>
          <span>Add to Phone</span>
        </button>

        {showIOSGuide && (
          <div className="modal-overlay" onClick={() => setShowIOSGuide(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Install on iPhone / iPad</h3>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowIOSGuide(false)}>✕</button>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: 1.6 }}>
                <p style={{ marginBottom: '0.75rem' }}>
                  To install <strong>IPPAS Pulse</strong> on your home screen:
                </p>
                <ol style={{ paddingLeft: '1.25rem', marginBottom: '1rem' }}>
                  <li style={{ marginBottom: '0.4rem' }}>Tap the <strong>Share</strong> button (box with upward arrow) in Safari.</li>
                  <li style={{ marginBottom: '0.4rem' }}>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                  <li>Tap <strong>Add</strong> in the top right.</li>
                </ol>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
