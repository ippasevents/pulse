'use client';

import React, { useState } from 'react';
import { store } from '@/lib/store';

interface OwnerResetDatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function OwnerResetDatabaseModal({
  isOpen,
  onClose,
  onSuccess
}: OwnerResetDatabaseModalProps) {
  const [password, setPassword] = useState('');
  const [confirmWord, setConfirmWord] = useState('');
  const [mode, setMode] = useState<'restore_defaults' | 'clear_all_data'>('restore_defaults');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const state = store.getState();
  const currentUser = store.getCurrentUser();
  const isOwner = state.currentRole === 'owner' || state.currentRole === 'super_admin';

  const handleClose = () => {
    if (!isSubmitting) {
      setPassword('');
      setConfirmWord('');
      setError('');
      setSuccess('');
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!isOwner) {
      setError('Permission denied: Only Owner has authority to reset the database.');
      return;
    }

    if (!password.trim()) {
      setError('Please enter your Owner login password to confirm.');
      return;
    }

    if (confirmWord.trim().toUpperCase() !== 'RESET') {
      setError("Type 'RESET' to confirm database reset.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = store.resetDatabaseSecure({
        password: password.trim(),
        mode
      });

      if (result.success) {
        setSuccess(
          mode === 'clear_all_data'
            ? '✓ All transactional data cleared successfully! Ready for fresh bookings.'
            : '✓ Database reset to default state successfully!'
        );
        setPassword('');
        setConfirmWord('');
        if (onSuccess) {
          onSuccess();
        }
        setTimeout(() => {
          setSuccess('');
          onClose();
        }, 2200);
      } else {
        setError(result.error || 'Failed to reset database. Please verify your password.');
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '540px',
          width: '94%',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '12px',
          border: '2px solid #ef4444',
          boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)'
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
            color: '#fff',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem'
              }}
            >
              🛡️
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Database Reset — Owner Authentication
              </h2>
              <div style={{ fontSize: '0.78rem', color: '#fca5a5', marginTop: '0.15rem' }}>
                Owner Security Verification Required
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: '1.4rem',
              cursor: 'pointer',
              lineHeight: 1,
              padding: '0.2rem'
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          {/* Security Alert Banner */}
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              marginBottom: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#991b1b', fontWeight: 700, fontSize: '0.88rem' }}>
              <span>⚠️</span>
              <span>Mandatory Security Guard</span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.82rem', color: '#7f1d1d', lineHeight: 1.5 }}>
              Permission to reset or clear database records belongs strictly to the <strong>Owner</strong>. To prevent accidental loss, please re-authenticate by entering your current login password below.
            </p>
          </div>

          {/* Active Owner Profile Identifier */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Verifying Account:</div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                {currentUser?.full_name || 'Fazil (Owner)'} ({currentUser?.username || 'owner'})
              </div>
            </div>
            <span
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                padding: '0.25rem 0.65rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}
            >
              OWNER ROLE
            </span>
          </div>

          {/* Mode Selector */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontWeight: 700, marginBottom: '0.5rem', display: 'block' }}>
              Select Action Type:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.75rem 0.9rem',
                  borderRadius: '8px',
                  border: mode === 'restore_defaults' ? '2px solid #ef4444' : '1px solid var(--border)',
                  background: mode === 'restore_defaults' ? '#fff5f5' : '#fff',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="resetMode"
                  checked={mode === 'restore_defaults'}
                  onChange={() => setMode('restore_defaults')}
                  style={{ marginTop: '0.2rem' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>
                    ↺ Restore Seeded Sample Database
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Restores initial sample events, recipes, and reference records. Owner login credentials will be preserved.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.75rem 0.9rem',
                  borderRadius: '8px',
                  border: mode === 'clear_all_data' ? '2px solid #ef4444' : '1px solid var(--border)',
                  background: mode === 'clear_all_data' ? '#fff5f5' : '#fff',
                  cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="resetMode"
                  checked={mode === 'clear_all_data'}
                  onChange={() => setMode('clear_all_data')}
                  style={{ marginTop: '0.2rem' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a' }}>
                    🗑️ Wipe All Transactions (Clean Start)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Clears all events, invoices, and payments for new orders. Company profile, staff roster, and menu catalogue will remain intact.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Owner Password Input */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ fontWeight: 700 }}>
              Enter Owner Password <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter your current owner password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                autoFocus
                required
                style={{ paddingRight: '2.5rem', borderColor: '#ef4444' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Re-authenticate using your owner profile password.
            </div>
          </div>

          {/* Typed Confirmation Box */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontWeight: 700 }}>
              Type <code style={{ color: '#ef4444', background: '#fee2e2', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>RESET</code> below to confirm:
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="RESET"
              value={confirmWord}
              onChange={(e) => setConfirmWord(e.target.value)}
              disabled={isSubmitting}
              required
              style={{ fontWeight: 700, letterSpacing: '0.05em' }}
            />
          </div>

          {/* Error & Success Messages */}
          {error && (
            <div
              style={{
                background: '#fee2e2',
                border: '1px solid #fecaca',
                color: '#991b1b',
                padding: '0.75rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              <span>❌</span>
              <div>{error}</div>
            </div>
          )}

          {success && (
            <div
              style={{
                background: '#dcfce7',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                padding: '0.75rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              <span>✅</span>
              <div>{success}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !password.trim() || confirmWord.trim().toUpperCase() !== 'RESET'}
              style={{
                background: '#dc2626',
                color: '#ffffff',
                border: 'none',
                padding: '0.65rem 1.25rem',
                borderRadius: '6px',
                fontWeight: 700,
                cursor: isSubmitting || !password.trim() || confirmWord.trim().toUpperCase() !== 'RESET' ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || !password.trim() || confirmWord.trim().toUpperCase() !== 'RESET' ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              {isSubmitting ? 'Resetting Database...' : '🔐 Confirm Password & Reset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
