'use client';

import React, { useEffect, useState } from 'react';
import { store } from '@/lib/store';
import { isSupabaseConfigured } from '@/lib/supabase';
import OwnerAuditBadge from '@/components/OwnerAuditBadge';

export default function SettingsPage() {
  const [state, setState] = useState(store.getState());
  const [syncStatus, setSyncStatus] = useState(store.getSyncStatus());
  const [form, setForm] = useState(state.settings);
  const [savedNotice, setSavedNotice] = useState(false);

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
  const isOwner = role === 'owner';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateSettings(form);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleReset = () => {
    if (confirm('Reset all demo state to original seeded database state? Any modifications will be restored to initial sample records.')) {
      store.resetToDefault();
      setForm(store.getState().settings);
    }
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

            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.65rem', color: '#0f172a' }}>
                📧 Automatic Invoice Email Copy
              </h3>

              <div
                className="form-group"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px'
                }}
              >
                <input
                  type="checkbox"
                  id="autoEmailInvoicesSetting"
                  checked={form.auto_email_invoices !== false}
                  onChange={(e) => setForm({ ...form, auto_email_invoices: e.target.checked })}
                  disabled={!isOwner}
                />
                <label
                  htmlFor="autoEmailInvoicesSetting"
                  style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e3a8a', cursor: 'pointer' }}
                >
                  Automatically email every newly created invoice to Gmail
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Recipient Gmail Address for Invoices</label>
                <input
                  type="email"
                  className="form-control"
                  value={form.invoice_notification_email ?? 'ippasevents@gmail.com'}
                  onChange={(e) => setForm({ ...form, invoice_notification_email: e.target.value })}
                  disabled={!isOwner}
                  placeholder="ippasevents@gmail.com"
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
          {/* Connection & Architecture Card */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h2 className="card-title">Database &amp; Supabase Integration</h2>
            <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: syncStatus.error ? '#ef4444' : isSupabaseConfigured ? 'var(--success)' : '#f59e0b'
                    }}
                  />
                  <strong>
                    {isSupabaseConfigured
                      ? syncStatus.isSyncing
                        ? 'Syncing with Supabase Database...'
                        : syncStatus.error
                        ? 'Supabase Schema / Policy Error'
                        : 'Live Connected & Syncing with Supabase'
                      : 'Active In-Memory & LocalStorage Mode'}
                  </strong>
                </div>

                {isSupabaseConfigured && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={syncStatus.isSyncing}
                    onClick={() => store.syncFromSupabase()}
                  >
                    {syncStatus.isSyncing ? 'Syncing...' : '↻ Sync Now'}
                  </button>
                )}
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
                  <strong>Database Error:</strong> {syncStatus.error}
                  <div style={{ marginTop: '0.25rem' }}>
                    Please run <code>migration_06.sql</code> in your Supabase SQL Editor to add the new columns and enable write policies.
                  </div>
                </div>
              )}

              <p style={{ marginBottom: '0.75rem' }}>
                All newly created and edited records (clients, events, quotes, menu items, stock, purchases, staff, shifts, invoices, payments, and users) sync directly with your Supabase tables when configured.
              </p>

              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#0f172a' }}>To connect Supabase &amp; Automatic Email on Vercel:</div>
                <ol style={{ paddingLeft: '1.25rem', marginTop: '0.35rem', fontSize: '0.75rem' }}>
                  <li>Run <code>schema.sql</code> followed by <code>migration_06.sql</code> and <code>migration_07.sql</code> in your Supabase SQL Editor (enables <code>activity_logs</code> &amp; direct DB change triggers)</li>
                  <li>Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in Vercel Environment Variables</li>
                  <li>Set <code>SMTP_USER</code> (sender Gmail) and <code>SMTP_PASS</code> (16-digit Gmail App Password) in Vercel Environment Variables for silent background invoice emails to <code>ippasevents@gmail.com</code></li>
                </ol>
              </div>
            </div>
          </div>

          {/* Reset Demo Data */}
          <div className="card">
            <h2 className="card-title">Demo State Controls</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Reset sample events, client records, inventory pantry counts, and staff rosters back to default initial values.
            </p>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              ↺ Reset Sample Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
