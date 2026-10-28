'use client';

import React, { useEffect, useState } from 'react';
import { store } from '@/lib/store';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function SettingsPage() {
  const [state, setState] = useState(store.getState());
  const [form, setForm] = useState(state.settings);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setState(store.getState());
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
          {/* Connection & Architecture Card */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <h2 className="card-title">Database &amp; Supabase Integration</h2>
            <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: isSupabaseConfigured ? 'var(--success)' : '#f59e0b'
                  }}
                />
                <strong>
                  {isSupabaseConfigured
                    ? 'Connected to Remote Supabase Backend'
                    : 'Active In-Memory & LocalStorage Mode'}
                </strong>
              </div>

              <p style={{ marginBottom: '0.75rem' }}>
                The application schema is completely synchronized with <code>schema.sql</code> and updates 2 through 5.
              </p>

              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#0f172a' }}>To connect remote Supabase:</div>
                <ol style={{ paddingLeft: '1.25rem', marginTop: '0.35rem', fontSize: '0.75rem' }}>
                  <li>Run <code>schema.sql</code> in your Supabase SQL editor</li>
                  <li>Provide <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code></li>
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
