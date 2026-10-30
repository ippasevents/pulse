'use client';

import React, { useEffect, useState } from 'react';
import { Invoice } from '@/lib/types';
import { store } from '@/lib/store';
import {
  generateInvoicePdfBlob,
  formatWhatsAppInvoiceMessage,
  shareInvoicePdfToWhatsApp
} from '@/lib/invoicePdfGenerator';

interface WhatsAppShareModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function WhatsAppShareModal({
  invoice,
  isOpen,
  onClose
}: WhatsAppShareModalProps) {
  const [state, setState] = useState(store.getState());
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setState(store.getState());
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  if (!isOpen || !invoice) return null;

  const liveInvoice = state.invoices.find((i) => i.id === invoice.id) || invoice;
  const evt = state.events.find((e) => e.id === liveInvoice.event_id);
  const client = state.clients.find((c) => c.id === evt?.client_id);
  const invPayments = state.payments.filter((p) => p.invoice_id === liveInvoice.id);
  const paymentsForThis = invPayments.reduce((s, p) => s + p.amount, 0);
  const balanceDue = Math.max(0, liveInvoice.amount - paymentsForThis);
  const isFullyPaid = liveInvoice.status === 'paid' || (liveInvoice.amount > 0 && balanceDue <= 0);
  const showBankDetails = liveInvoice.show_bank_details !== false;
  const showPaymentDetails = liveInvoice.show_payment_details !== false;

  const rawDigits = (client?.phone || '').replace(/[^0-9]/g, '');
  const cleanPhone = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;
  const messageText = formatWhatsAppInvoiceMessage(liveInvoice, state);

  const handleToggleBank = (checked: boolean) => {
    store.updateInvoice(liveInvoice.id, { show_bank_details: checked });
  };

  const handleTogglePayment = (checked: boolean) => {
    store.updateInvoice(liveInvoice.id, { show_payment_details: checked });
  };

  const handleShareWithPdf = async () => {
    setIsGenerating(true);
    setFeedback(null);

    try {
      const res = await shareInvoicePdfToWhatsApp(liveInvoice, store.getState());

      if (res.success) {
        if (res.sharedDirectlyWithFile) {
          setFeedback({
            type: 'success',
            message: '✓ WhatsApp opened with invoice PDF attached directly!'
          });
        } else {
          setFeedback({
            type: 'info',
            message: '✓ Invoice PDF downloaded and WhatsApp opened. Click 📎 (Attach Document) in the chat to send the file.'
          });
        }
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Unable to share directly to WhatsApp.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'An unexpected error occurred.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadOnly = async () => {
    setIsGenerating(true);
    setFeedback(null);
    try {
      const res = await generateInvoicePdfBlob(liveInvoice, store.getState());
      if (res) {
        const url = URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${liveInvoice.invoice_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setFeedback({
          type: 'success',
          message: `✓ Invoice PDF (${liveInvoice.invoice_number}.pdf) downloaded successfully!`
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Unable to download PDF file.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleOpenDirectChat = () => {
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1250 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '550px',
          width: '95%',
          padding: 0,
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #86efac',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
            color: '#ffffff',
            padding: '1.15rem 1.4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem'
              }}
            >
              💬
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                Share {isFullyPaid || liveInvoice.kind === 'final' ? 'Final Settlement Invoice' : 'Invoice'} on WhatsApp
              </h2>
              <div style={{ fontSize: '0.75rem', color: '#bbf7d0', marginTop: '0.15rem' }}>
                WhatsApp PDF Document Sharing &bull; #{liveInvoice.invoice_number}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '1.4rem',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.4rem', maxHeight: '82vh', overflowY: 'auto' }}>
          {/* Client & Summary Card */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              marginBottom: '0.95rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Client:
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                  {client?.name || 'Valued Client'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                  📞 {client?.phone || 'Phone not added'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {isFullyPaid || liveInvoice.kind === 'final' ? 'Final Settlement Total:' : 'Invoice Total:'}
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#15803d' }}>
                  ₹{liveInvoice.amount.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.75rem', color: !isFullyPaid ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                  {!isFullyPaid ? `Balance Due: ₹${balanceDue.toLocaleString('en-IN')}` : '✓ Fully Paid (Payment Terms Hidden)'}
                </div>
              </div>
            </div>
          </div>

          {/* Bank Details & Payment Details Visibility Toggles */}
          <div
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.7rem 0.9rem',
              marginBottom: '0.95rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.85rem',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
              Show on Invoice PDF &amp; WA:
            </span>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: '#1e293b' }}>
                <input
                  type="checkbox"
                  checked={showBankDetails}
                  onChange={(e) => handleToggleBank(e.target.checked)}
                />
                🏦 Bank Details
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: '#1e293b' }}>
                <input
                  type="checkbox"
                  checked={showPaymentDetails}
                  onChange={(e) => handleTogglePayment(e.target.checked)}
                />
                💳 Payment Details
              </label>
            </div>
          </div>

          {/* Status Feedback */}
          {feedback && (
            <div
              style={{
                background: feedback.type === 'success' ? '#dcfce7' : feedback.type === 'info' ? '#eff6ff' : '#fee2e2',
                border: `1px solid ${feedback.type === 'success' ? '#86efac' : feedback.type === 'info' ? '#93c5fd' : '#fca5a5'}`,
                color: feedback.type === 'success' ? '#15803d' : feedback.type === 'info' ? '#1e40af' : '#991b1b',
                padding: '0.75rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                marginBottom: '1rem',
                fontWeight: 600,
                lineHeight: 1.5
              }}
            >
              {feedback.message}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={handleShareWithPdf}
              disabled={isGenerating}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.85rem 1.25rem',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.55rem',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.25)'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{isGenerating ? '⏳' : '📲'}</span>
              <span>
                {isGenerating ? 'Generating PDF...' : 'Share PDF to WhatsApp'}
              </span>
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginTop: '0.2rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadOnly}
                disabled={isGenerating}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem'
                }}
              >
                <span>📥</span>
                <span>Download PDF File</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleOpenDirectChat}
                disabled={isGenerating}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem',
                  background: '#f0fdf4',
                  borderColor: '#bbf7d0',
                  color: '#15803d',
                  fontWeight: 600
                }}
              >
                <span>💬</span>
                <span>Open WhatsApp Chat</span>
              </button>
            </div>
          </div>

          {/* Message Preview */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                WhatsApp Message Preview
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                onClick={handleCopyText}
              >
                {copied ? '✓ Copied!' : '📋 Copy Text'}
              </button>
            </div>
            <pre
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.76rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '160px',
                overflowY: 'auto',
                margin: 0,
                color: '#1e293b',
                fontFamily: 'inherit'
              }}
            >
              {messageText}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
