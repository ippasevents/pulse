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
      setError('അനുമതിയില്ല: ഡാറ്റാബേസ് റീസെറ്റ് ചെയ്യാൻ ഓണർക്ക് (Owner) മാത്രമാണ് അധികാരമുള്ളത്.');
      return;
    }

    if (!password.trim()) {
      setError('സ്ഥിരീകരിക്കുന്നതിനായി നിങ്ങളുടെ നിലവിലെ ഓണർ പാസ്‌വേഡ് നൽകുക. (Please enter your Owner password)');
      return;
    }

    if (confirmWord.trim().toUpperCase() !== 'RESET') {
      setError("സ്ഥിരീകരണത്തിനായി 'RESET' എന്ന് കൃത്യമായി ടൈപ്പ് ചെയ്യുക. (Type 'RESET' to confirm)");
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
            ? '✓ ഡാറ്റാബേസ് വിജയകരമായി ക്ലിയർ ചെയ്തു! പുതിയ ഇവന്റുകൾക്കായി റെഡിയാണ്. (All transactional data cleared successfully!)'
            : '✓ ഡാറ്റാബേസ് വിജയകരമായി റീസെറ്റ് ചെയ്ത് ഡീഫോൾട്ട് സ്റ്റേറ്റിലേക്ക് മാറ്റി! (Database reset to defaults successfully!)'
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
        setError(result.error || 'റീസെറ്റ് ചെയ്യാൻ സാധിച്ചില്ല. നൽകിയ പാസ്‌വേഡ് പരിശോധിക്കുക.');
      }
    } catch (err: any) {
      setError(err?.message || 'അപ്രതീക്ഷിത തകരാറുണ്ടായി. വീണ്ടും ശ്രമിക്കുക.');
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
                ഡാറ്റാബേസ് റീസെറ്റ് — ഓണർ ഓതന്റിക്കേഷൻ
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
              <span>നിർബന്ധിത സുരക്ഷാ പരിശോധന (Security Guard)</span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.82rem', color: '#7f1d1d', lineHeight: 1.5 }}>
              ഡാറ്റാബേസിലെ വിവരങ്ങൾ റീസെറ്റ് ചെയ്യാനോ ക്ലിയർ ചെയ്യാനോ ഉള്ള പൂർണ്ണ അധികാരം <strong>ഓണർക്ക് (Owner)</strong> മാത്രമാണ്. തെറ്റായ മാറ്റങ്ങൾ ഒഴിവാക്കാൻ നിങ്ങളുടെ നിലവിലെ ലോഗിൻ പാസ്‌വേഡ് അടിച്ച് റീ-ഓതന്റിക്കേറ്റ് ചെയ്യേണ്ടതുണ്ട്.
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
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>സ്ഥിരീകരിക്കുന്ന അക്കൗണ്ട് (Verifying Account):</div>
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
              റീസെറ്റ് രീതി തിരഞ്ഞെടുക്കുക (Select Action Type):
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
                    ↺ റീസെറ്റ് ചെയ്ത് ഡീഫോൾട്ട് സാമ്പിൾ ഡാറ്റ ആക്കുക (Restore Seeded Sample Database)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    ഇനിഷ്യൽ സാമ്പിൾ ഇവന്റുകളും റഫറൻസ് ഡാറ്റയും തിരികെ കൊണ്ടുവരുന്നു. ഓണർ ലോഗിൻ ക്രഡൻഷ്യലുകൾ നഷ്ടപ്പെടില്ല.
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
                    🗑️ മുഴുവൻ ഇവന്റുകളും ഇൻവോയ്‌സുകളും ക്ലിയർ ചെയ്യുക (Wipe All Transactions - Clean Start)
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    പുതിയ ഓർഡറുകൾക്കായി ഇവന്റുകൾ, ഇൻവോയ്‌സുകൾ, പെയ്‌മെന്റുകൾ എന്നിവ ക്ലിയർ ചെയ്യുന്നു. കമ്പനി പ്രൊഫൈലും മെനുവും നിലനിൽക്കും.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Owner Password Input */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ fontWeight: 700 }}>
              ഓണർ ലോഗിൻ പാസ്‌വേഡ് നൽകുക (Enter Owner Current Password) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="നിങ്ങളുടെ നിലവിലെ ഓണർ പാസ്‌വേഡ്..."
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
              ഓണർ പ്രൊഫൈലിലെ യഥാർത്ഥ പാസ്‌വേഡ് അടിച്ച് റീ-ഓതന്റിക്കേറ്റ് ചെയ്യുക.
            </div>
          </div>

          {/* Typed Confirmation Box */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontWeight: 700 }}>
              സ്ഥിരീകരണത്തിനായി താഴെ <code style={{ color: '#ef4444', background: '#fee2e2', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>RESET</code> എന്ന് ടൈപ്പ് ചെയ്യുക:
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
              റദ്ദാക്കുക (Cancel)
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
              {isSubmitting ? 'റീസെറ്റ് ചെയ്യുന്നു...' : '🔐 പാസ്‌വേഡ് സ്ഥിരീകരിച്ച് റീസെറ്റ് ചെയ്യുക'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
