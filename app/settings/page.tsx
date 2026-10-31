'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { store } from '@/lib/store';
import OwnerAuditBadge from '@/components/OwnerAuditBadge';
import OwnerDatabaseExportCard from '@/components/OwnerDatabaseExportCard';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import OwnerDatabaseResetCard from '@/components/OwnerDatabaseResetCard';

export default function SettingsPage() {
  const [state, setState] = useState(store.getState());
  const [syncStatus, setSyncStatus] = useState(store.getSyncStatus());
  const [form, setForm] = useState(state.settings);
  const [savedNotice, setSavedNotice] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      const next = store.getState();
      setState(next);
      setSyncStatus(store.getSyncStatus());
      setForm(next.settings);
    });
    return unsub;
  }, []);

  const role = state.currentRole;
  const isOwner = role === 'owner' || role === 'super_admin';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateSettings(form);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Catering Business Settings</h1>
          <p className="page-subtitle">
            Configure business identity, contact details printed on client invoices, and database status.
          </p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2 className="card-title">Company Identity &amp; Invoice Info</h2>
          {isOwner && (
            <div style={{ marginBottom: '0.85rem' }}>
              <OwnerAuditBadge
                role={role}
                entry={store.getEntityAudit(String(form.id), ['settings'])}
                prefixLabel="Settings last updated by"
                variant="banner"
                showSummary
              />
            </div>
          )}

          {savedNotice && (
            <div
              style={{
                background: '#dcfce7',
                color: '#15803d',
                padding: '0.6rem 0.8rem',
                borderRadius: '6px',
                fontSize: '0.85rem',
                marginBottom: '1rem'
              }}
            >
              ✓ Settings saved successfully!
            </div>
          )}

          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">Business / Brand Name *</label>
              <input
                type="text"
                className="form-control"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                disabled={!isOwner}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Commercial Kitchen &amp; Office Address</label>
              <textarea
                rows={3}
                className="form-control"
                value={form.address || ''}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                disabled={!isOwner}
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Official Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.phone || ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  disabled={!isOwner}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Billing Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={form.email || ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={!isOwner}
                />
              </div>
            </div>

            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#0f172a' }}>
                🏦 Official Bank Details &amp; Payment Terms
              </h3>

              <div className="form-group">
                <label className="form-label">Bank Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.bank_name || ''}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                  disabled={!isOwner}
                  placeholder="e.g. Federal Bank / State Bank of India"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Account Holder Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.account_name || ''}
                  onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                  disabled={!isOwner}
                  placeholder="e.g. IPPAS Food Service & Events"
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Account Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.account_number || ''}
                    onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                    disabled={!isOwner}
                    placeholder="e.g. 9876-5432-1000"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">IFSC Code</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ textTransform: 'uppercase' }}
                    value={form.ifsc_code || ''}
                    onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })}
                    disabled={!isOwner}
                    placeholder="e.g. FDRL0001234"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">UPI ID (GPay / PhonePe / BHIM)</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.upi_id || ''}
                  onChange={(e) => setForm({ ...form, upi_id: e.target.value })}
                  disabled={!isOwner}
                  placeholder="e.g. ippas@upi or 9847012345@okaxis"
                />
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Payment Terms &amp; Instructions</label>
                  <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
                    ⏱️ Due date strictly within 3 days
                  </span>
                </div>
                <textarea
                  rows={2}
                  className="form-control"
                  value={form.payment_terms || ''}
                  onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                  disabled={!isOwner}
                  placeholder="Payment strictly due within 3 days."
                />
              </div>
            </div>

            {isOwner && (
              <div style={{ marginTop: '1.25rem' }}>
                <button type="submit" className="btn btn-primary">
                  Save Business Details
                </button>
              </div>
            )}
          </form>
        </div>

        <div>
          {/* 4-Role English PDF User Manuals Card */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h2 className="card-title">📘 Role-Based User Manuals (4 PDF Guides)</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Download detailed, step-by-step A4 PDF user manuals tailored separately for each team role — Owner, Manager, Accountant, and Staff.
            </p>
            <Link
              href="/manuals"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}
            >
              📘 Open User Manuals PDF Hub &rarr;
            </Link>
          </div>

          {/* Owner-Only Full Database Backup & Restore */}
          <OwnerDatabaseExportCard role={role} />

          {/* Online-Only Supabase Cloud Database & Realtime Sync Card */}
          <div className="card" style={{ marginBottom: '1.25rem', borderTop: '3px solid #10b981' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: syncStatus.error ? '#ef4444' : '#10b981',
                    boxShadow: '0 0 8px #10b981'
                  }}
                />
                <h2 className="card-title" style={{ margin: 0 }}>
                  ☁️ Supabase Cloud Database (Always Online)
                </h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={syncStatus.isSyncing}
                  onClick={() => store.syncFromSupabase(false)}
                  title="Refresh live records from Supabase cloud database"
                >
                  {syncStatus.isSyncing ? 'Refreshing...' : '↻ Refresh Live Data'}
                </button>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '0.75rem 0.95rem',
                  marginBottom: syncStatus.error ? '0.85rem' : 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.88rem' }}>
                    ✓ Live Connected &bull; Online Supabase Database Only
                  </div>
                  <span
                    style={{
                      background: '#dcfce7',
                      color: '#15803d',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: 700
                    }}
                  >
                    ALWAYS ONLINE
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#15803d', marginTop: '0.35rem' }}>
                  All records are read and written directly to your live Supabase PostgreSQL cloud database in real time. Local offline storage is disabled.
                </div>
              </div>

              {syncStatus.error && (
                <div
                  style={{
                    background: '#fee2e2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    padding: '0.65rem 0.8rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    marginBottom: '0.75rem'
                  }}
                >
                  <strong>Cloud Database Notice:</strong> {syncStatus.error}
                </div>
              )}
            </div>
          </div>

          {/* Account Security & Password */}
          <div className="card" style={{ borderTop: '3px solid #0f172a' }}>
            <h2 className="card-title">🔐 Account Password &amp; Security</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Change the login password for your currently signed-in account. All users can independently update their own passwords.
            </p>
            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="btn btn-secondary"
              style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              🔑 Change Login Password
            </button>
          </div>

          {/* Progressive Web App Installation */}
          <div className="card" style={{ borderTop: '3px solid #e11d48' }}>
            <h2 className="card-title">📱 App Installation</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Install IPPAS Pulse as a standalone application on your Android phone, iPhone / iPad, or Windows / Mac laptop for instant full-screen access, fast loading, and app-like experience.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <PWAInstallButton variant="card" showAlways={true} />
            </div>
          </div>

          {/* WhatsApp & Client Invoice PDF Sharing Card */}
          <div className="card" style={{ borderTop: '3px solid #16a34a' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>💬</span>
                <h2 className="card-title" style={{ margin: 0, color: '#15803d' }}>
                  WhatsApp &amp; Client PDF Sharing
                </h2>
              </div>
              <span
                style={{
                  background: '#dcfce7',
                  color: '#15803d',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  fontSize: '0.72rem',
                  fontWeight: 700
                }}
              >
                ACTIVE &bull; A4 PDF READY
              </span>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '0.85rem', lineHeight: 1.6 }}>
              When clicking the <strong>&ldquo;💬 WA PDF&rdquo;</strong> button from the invoices or event details page, a standard A4 PDF invoice is generated automatically for each client.
            </p>

            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem 0.95rem', fontSize: '0.8rem', color: '#166534', lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>📱 How it Works:</div>
              <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                <li><strong>Mobile Devices (Android / iPhone)</strong>: The invoice PDF is attached directly into your WhatsApp chat via the Web Share API.</li>
                <li><strong>Desktop / Laptop</strong>: The file downloads to your computer and opens WhatsApp Web (you can attach the file via the chat's 📎 button).</li>
              </ul>
            </div>
          </div>

          {/* Owner-Only Database Reset & Clear Data Controls */}
          <OwnerDatabaseResetCard
            role={role}
            onResetComplete={() => setForm(store.getState().settings)}
          />
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
}
