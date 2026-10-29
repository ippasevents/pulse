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
              ഡാറ്റാബേസ് റീസെറ്റ് നിയന്ത്രണം (Database Reset Restricted)
            </h2>
            <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '0.1rem' }}>
              Access strictly limited to Owner Profile
            </div>
          </div>
        </div>
        <p style={{ fontSize: '0.82rem', color: '#7f1d1d', margin: 0, lineHeight: 1.5 }}>
          ഡാറ്റാബേസിലെ വിവരങ്ങൾ റീസെറ്റ് ചെയ്യാനോ ക്ലിയർ ചെയ്യാനോ ഉള്ള പൂർണ്ണ അധികാരം സ്ഥാപനത്തിന്റെ <strong>ഓണർക്ക് (Owner)</strong> മാത്രമായി പരിമിതപ്പെടുത്തിയിരിക്കുന്നു. മാനേജർമാർക്കോ അക്കൗണ്ടന്റുകൾക്കോ മറ്റ് സ്റ്റാഫുകൾക്കോ ഡാറ്റാബേസ് ക്ലിയർ ചെയ്യാൻ അനുമതിയില്ല.
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
                ഡാറ്റാബേസ് റീസെറ്റ് &amp; ക്ലിയറിംഗ് (Owner Re-Authentication)
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
          ഡാറ്റാബേസ് റീസെറ്റ് ചെയ്യുന്നതിനോ അല്ലെങ്കിൽ ഓർഡറുകളും ഇൻവോയ്‌സുകളും ക്ലിയർ ചെയ്യുന്നതിനോ നിങ്ങളുടെ <strong>ഓണർ ലോഗിൻ പാസ്‌വേഡ് (Owner Password)</strong> നൽകി റീ-ഓതന്റിക്കേഷൻ പൂർത്തിയാക്കേണ്ടതുണ്ട്. പാസ്‌വേഡ് പരിശോധന കൂടാതെ ഡാറ്റ മാറ്റാൻ സാധിക്കില്ല.
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
            <span>പാസ്‌വേഡ് നൽകി റീസെറ്റ് ചെയ്യുക (Reset Database with Password)</span>
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
