'use client';

import React, { useEffect, useState } from 'react';
import { store } from '@/lib/store';
import { isSupabaseConfigured } from '@/lib/supabase';
import OwnerAuditBadge from '@/components/OwnerAuditBadge';
import OwnerDatabaseExportCard from '@/components/OwnerDatabaseExportCard';

export default function SettingsPage() {
  const [state, setState] = useState(store.getState());
  const [syncStatus, setSyncStatus] = useState(store.getSyncStatus());
  const [form, setForm] = useState(state.settings);
  const [savedNotice, setSavedNotice] = useState(false);
  const [isPushingSql, setIsPushingSql] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  const handlePushAllToSql = async () => {
    setIsPushingSql(true);
    setPushFeedback(null);
    const res = await store.pushAllToSupabase();
    setIsPushingSql(false);
    if (res.success) {
      setPushFeedback({
        type: 'success',
        message: '✓ All 18 SQL tables have been synchronized with your current app records!'
      });
      setTimeout(() => setPushFeedback(null), 5000);
    } else {
      setPushFeedback({
        type: 'error',
        message: res.error || 'Could not push records to SQL database.'
      });
    }
  };

  const isSqlActive = syncStatus.isConnected || isSupabaseConfigured;

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
          {/* Owner-Only Full Database Download (Excel / CSV) */}
          <OwnerDatabaseExportCard role={role} />

          {/* Connection & Architecture Card */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h2 className="card-title">Database &amp; Supabase SQL Integration</h2>
            <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: syncStatus.error ? '#ef4444' : isSqlActive ? 'var(--success)' : '#f59e0b'
                    }}
                  />
                  <strong>
                    {isSqlActive
                      ? syncStatus.isWriting
                        ? `Updating SQL Database (${syncStatus.pendingCount} queued)...`
                        : syncStatus.isSyncing
                        ? 'Syncing with Supabase SQL Database...'
                        : syncStatus.error
                        ? 'Supabase SQL Schema / Policy Error'
                        : 'Live Connected — Auto-Updating SQL on Every Change'
                      : 'Active Local Mode (Connect Supabase Env Vars for SQL Sync)'}
                  </strong>
                </div>

                {isSqlActive && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={syncStatus.isSyncing || isPushingSql}
                      onClick={() => store.syncFromSupabase()}
                    >
                      {syncStatus.isSyncing ? 'Syncing...' : '↻ Pull from SQL'}
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={isPushingSql || syncStatus.isWriting}
                        onClick={handlePushAllToSql}
                      >
                        {isPushingSql ? 'Pushing to SQL...' : '⬆️ Push All Data to SQL'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {pushFeedback && (
                <div
                  style={{
                    background: pushFeedback.type === 'success' ? '#dcfce7' : '#fee2e2',
                    border: `1px solid ${pushFeedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                    color: pushFeedback.type === 'success' ? '#15803d' : '#991b1b',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    marginBottom: '0.75rem',
                    fontWeight: 500
                  }}
                >
                  {pushFeedback.message}
                </div>
              )}

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
                    Please run the updated <code>schema.sql</code> (or <code>migration_06.sql</code> + <code>migration_07.sql</code>) in your Supabase SQL Editor so all tables, cascade keys, and write policies are active.
                  </div>
                </div>
              )}

              <p style={{ marginBottom: '0.75rem' }}>
                Every create, edit, stock adjustment, recipe change, quotation update, shift assignment, salary entry, invoice, payment, and deletion automatically writes to your PostgreSQL (Supabase) tables in strict foreign-key order with offline retry protection.
              </p>

              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#0f172a' }}>Supabase SQL &amp; Vercel Setup Checklist:</div>
                <ol style={{ paddingLeft: '1.25rem', marginTop: '0.35rem', fontSize: '0.75rem' }}>
                  <li>Run <code>schema.sql</code> in your Supabase SQL Editor (idempotent — configures all 18 tables, RLS write policies, Realtime, and <code>activity_logs</code> triggers in one run)</li>
                  <li>Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (and optional <code>SUPABASE_SERVICE_ROLE_KEY</code>) in Environment Variables</li>
                  <li>Set <code>SMTP_HOST=smtp.gmail.com</code>, <code>SMTP_PORT=465</code>, <code>SMTP_USER=ippassales@gmail.com</code>, <code>SMTP_PASS</code>, and <code>INVOICE_NOTIFICATION_EMAIL=ippasevents@gmail.com</code> in Vercel Environment Variables for automatic background invoice delivery</li>
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
