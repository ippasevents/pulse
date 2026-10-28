'use client';

import React, { useState } from 'react';
import { store } from '@/lib/store';
import { BusinessSettings } from '@/lib/types';

interface EditBankDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EditBankDetailsModal({ isOpen, onClose }: EditBankDetailsModalProps) {
  const currentSettings = store.getState().settings;
  const [form, setForm] = useState<Partial<BusinessSettings>>({
    bank_name: currentSettings.bank_name || 'Federal Bank / State Bank of India',
    account_name: currentSettings.account_name || currentSettings.name || 'IPPAS Food Service & Events',
    account_number: currentSettings.account_number || '9876-5432-1000',
    ifsc_code: currentSettings.ifsc_code || 'FDRL0001234',
    upi_id: currentSettings.upi_id || 'ippas@upi',
    payment_terms: currentSettings.payment_terms || 'Full payment strictly due within 3 days. 50% advance deposit upon booking confirmation.'
  });
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateSettings(form);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1050 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px', width: '95%', borderRadius: '12px', padding: '1.5rem' }}
      >
        <div className="modal-header" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              🏦 Edit Bank Details &amp; Payment Terms
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
              Update banking and settlement information printed on official invoices and quotes.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} type="button">✕</button>
        </div>

        {saved && (
          <div style={{ background: '#dcfce7', color: '#15803d', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 600 }}>
            ✓ Bank details saved successfully!
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>
              Bank Name *
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Federal Bank / SBI / HDFC Bank"
              value={form.bank_name || ''}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>
              Account Holder Name *
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. IPPAS Food Service & Events"
              value={form.account_name || ''}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
              required
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>
                Account Number *
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 987654321000"
                value={form.account_number || ''}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>
                IFSC Code *
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. FDRL0001234"
                style={{ textTransform: 'uppercase' }}
                value={form.ifsc_code || ''}
                onChange={(e) => setForm({ ...form, ifsc_code: e.target.value.toUpperCase() })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>
              UPI ID / Google Pay / PhonePe (Optional)
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 9847012345@okaxis or ippas@upi"
              value={form.upi_id || ''}
              onChange={(e) => setForm({ ...form, upi_id: e.target.value })}
            />
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                Payment Terms &amp; Conditions
              </label>
              <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
                ⏱️ Standard 3-Day Due Date
              </span>
            </div>
            <textarea
              rows={2}
              className="form-control"
              placeholder="e.g. Payment due strictly within 3 days. 50% advance deposit upon quotation confirmation."
              value={form.payment_terms || ''}
              onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ fontWeight: 600 }}>
              💾 Save Bank Details
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
