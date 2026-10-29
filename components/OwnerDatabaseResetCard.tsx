'use client';

import React, { useState } from 'react';
import { UserRole } from '@/lib/types';
import OwnerResetDatabaseModal from '@/components/OwnerResetDatabaseModal';

interface OwnerDatabaseResetCardProps {
  role: UserRole;
  onResetComplete?: () => void;
}

export default function OwnerDatabaseResetCard({
  role,
  onResetComplete
}: OwnerDatabaseResetCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isOwner = role === 'owner' || role === 'super_admin';

  // If user is NOT the owner, display a strictly locked security badge with no reset buttons
  if (!isOwner) {
    return (
      <div
        className="card"
        style={{
          borderLeft: '4px solid #ef4444',
          background: '#fef2f2',
          border: '1px solid #fecaca'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🔒</span>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#991b1b', margin: 0 }}>
              Database Reset Restricted
            </h2>
            <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '0.1rem' }}>
              Access strictly limited to Owner Profile
            </div>
          </div>
        </div>
        <p style={{ fontSize: '0.82rem', color: '#7f1d1d', margin: 0, lineHeight: 1.5 }}>
          Permission to reset or clear database records is restricted exclusively to the <strong>Owner</strong>. Managers, accountants, and staff members are not authorized to reset the database.
        </p>
      </div>
    );
  }

  // Owner View: Secure Reset Card with Password Verification Requirement
  return (
    <>
      <div
        className="card"
        style={{
          borderLeft: '4px solid #dc2626',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.3rem' }}>⚠️</span>
            <div>
              <h2 className="card-title" style={{ margin: 0, color: '#991b1b' }}>
                Database Reset &amp; Clearing (Owner Re-Authentication)
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                Requires Owner current login password to execute
              </div>
            </div>
          </div>
          <span
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '0.2rem 0.55rem',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.04em'
            }}
          >
            OWNER ONLY
          </span>
        </div>

        <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          To reset the database or wipe existing transactions and orders, you must enter your <strong>Owner login password</strong> for security re-authentication. No data changes can occur without verifying your identity.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsModalOpen(true)}
            style={{
              borderColor: '#fca5a5',
              background: '#fef2f2',
              color: '#991b1b',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <span>🔐</span>
            <span>Reset Database with Password</span>
          </button>
        </div>
      </div>

      <OwnerResetDatabaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={onResetComplete}
      />
    </>
  );
}
