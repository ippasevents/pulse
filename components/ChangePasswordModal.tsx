'use client';

import React, { useState } from 'react';
import { store } from '@/lib/store';
import { UserRole } from '@/lib/types';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentUser = store.getCurrentUser();
  const currentRole: UserRole = store.getState().currentRole;

  const roleColors: Record<UserRole, string> = {
    super_admin: '#4f46e5',
    owner: '#e11d48',
    manager: '#2563eb',
    accountant: '#059669',
    staff: '#7c3aed'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword.trim()) {
      setError('നിലവിലെ പാസ്‌വേഡ് നൽകുക (Please enter current password)');
      return;
    }

    if (!newPassword.trim()) {
      setError('പുതിയ പാസ്‌വേഡ് നൽകുക (Please enter new password)');
      return;
    }

    if (newPassword.trim().length < 4) {
      setError('പാസ്‌വേഡിൽ കുറഞ്ഞത് 4 അക്ഷരങ്ങളെങ്കിലും ഉണ്ടായിരിക്കണം (Password must be at least 4 characters)');
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setError('നൽകിയ പുതിയ പാസ്‌വേഡുകൾ പരസ്പരം ഒത്തുപോകുന്നില്ല (New password and confirmation do not match)');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = store.changePassword(currentPassword, newPassword);
      if (res.success) {
        setSuccess('✓ പാസ്‌വേഡ് വിജയകരമായി അപ്‌ഡേറ്റ് ചെയ്തു! (Password changed successfully!)');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setSuccess('');
          onClose();
        }, 1800);
      } else {
        setError(res.error || 'പാസ്‌വേഡ് മാറ്റാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.');
      }
    } catch {
      setError('ഒരു അപ്രതീക്ഷിത തകരാറുണ്ടായി. ദയവായി വീണ്ടും ശ്രമിക്കുക.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    if (!isSubmitting) {
      setError('');
      setSuccess('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleModalClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '440px',
          width: '92%',
          borderRadius: '16px',
          padding: '1.75rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.25rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(225, 29, 72, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem'
              }}
            >
              🔑
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Change Login Password
              </h2>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                ലോഗിൻ പാസ്‌വേഡ് മാറ്റുക
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem'
            }}
          >
            ✕
          </button>
        </div>

        {/* Current User Card */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Account:</div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
              {currentUser?.full_name || 'Current User'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Login ID: <strong>{currentUser?.username || currentUser?.phone}</strong>
            </div>
          </div>
          <span
            className="role-tag-badge"
            style={{
              background: roleColors[currentRole] || '#e11d48',
              color: '#ffffff',
              fontSize: '0.72rem'
            }}
          >
            {currentRole.toUpperCase()}
          </span>
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              marginBottom: '1rem',
              fontWeight: 500
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#15803d',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              fontWeight: 600,
              textAlign: 'center'
            }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Current Password */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
              Current Password (നിലവിലെ പാസ്‌വേഡ്) *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrent ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoFocus
                style={{ paddingRight: '2.5rem', fontSize: '0.9rem' }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                style={{
                  position: 'absolute',
                  right: '0.6rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  fontSize: '0.95rem',
                  padding: '0.2rem'
                }}
                title={showCurrent ? 'Hide password' : 'Show password'}
              >
                {showCurrent ? '🙈' : '👁️'}
              </button>
            </div>
            {currentRole === 'staff' && (
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                Default staff password is <strong>password123</strong> or your registered phone number.
              </div>
            )}
          </div>

          {/* New Password */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
              New Password (പുതിയ പാസ്‌വേഡ്) *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter new password (min. 4 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={{ paddingRight: '2.5rem', fontSize: '0.9rem' }}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={{
                  position: 'absolute',
                  right: '0.6rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  fontSize: '0.95rem',
                  padding: '0.2rem'
                }}
                title={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
              Confirm New Password (പുതിയ പാസ്‌വേഡ് ഉറപ്പാക്കുക) *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                className="form-control"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={{ paddingRight: '2.5rem', fontSize: '0.9rem' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{
                  position: 'absolute',
                  right: '0.6rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  fontSize: '0.95rem',
                  padding: '0.2rem'
                }}
                title={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleModalClose}
              disabled={isSubmitting}
              style={{ fontSize: '0.85rem' }}
            >
              Cancel (റദ്ദാക്കുക)
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                padding: '0.6rem 1.25rem'
              }}
            >
              {isSubmitting ? 'Updating...' : 'Save Password (സേവ് ചെയ്യുക)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
