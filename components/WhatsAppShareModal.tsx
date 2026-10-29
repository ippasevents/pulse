'use client';

import React, { useState } from 'react';
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  if (!isOpen || !invoice) return null;

  const state = store.getState();
  const evt = state.events.find((e) => e.id === invoice.event_id);
  const client = state.clients.find((c) => c.id === evt?.client_id);
  const invPayments = state.payments.filter((p) => p.invoice_id === invoice.id);
  const paymentsForThis = invPayments.reduce((s, p) => s + p.amount, 0);
  const balanceDue = Math.max(0, invoice.amount - paymentsForThis);
  const cleanPhone = (client?.phone || '').replace(/[^0-9]/g, '');
  const messageText = formatWhatsAppInvoiceMessage(invoice, state);

  const handleShareWithPdf = async () => {
    setIsGenerating(true);
    setFeedback(null);

    try {
      const res = await shareInvoicePdfToWhatsApp(invoice, state);

      if (res.success) {
        if (res.sharedDirectlyWithFile) {
          setFeedback({
            type: 'success',
            message: '✓ വാട്സാപ്പ് ഓപ്പൺ ആയി PDF ഡോക്യുമെന്റ് നേരിട്ട് അറ്റാച്ച് ചെയ്തിരിക്കുന്നു! (PDF attached directly via WhatsApp)'
          });
        } else {
          setFeedback({
            type: 'info',
            message: '✓ ഇൻവോയ്സ് PDF കമ്പ്യൂട്ടറിൽ ഡൗൺലോഡ് ചെയ്യുകയും വാട്സാപ്പ് ഓപ്പൺ ആവുകയും ചെയ്തിട്ടുണ്ട്! ചാറ്റിൽ 📎 (Attach Document) ക്ലിക്ക് ചെയ്ത് അയക്കുക.'
          });
        }
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'വാട്സാപ്പിലേക്ക് ഷെയർ ചെയ്യാൻ കഴിഞ്ഞില്ല.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'അപ്രതീക്ഷിത തകരാറുണ്ടായി.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadOnly = async () => {
    setIsGenerating(true);
    setFeedback(null);
    try {
      const res = await generateInvoicePdfBlob(invoice, state);
      if (res) {
        const url = URL.createObjectURL(res.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${invoice.invoice_number}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setFeedback({
          type: 'success',
          message: `✓ ഇൻവോയ്സ് PDF (${invoice.invoice_number}.pdf) വിജയകരമായി ഡൗൺലോഡ് ചെയ്തു!`
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'PDF ഡൗൺലോഡ് ചെയ്യാൻ സാധിച്ചില്ല.'
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
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1250 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '540px',
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
                വാട്സാപ്പ് ഇൻവോയ്സ് PDF ഷെയർ
              </h2>
              <div style={{ fontSize: '0.75rem', color: '#bbf7d0', marginTop: '0.15rem' }}>
                WhatsApp PDF Document Sharing &bull; #{invoice.invoice_number}
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
        <div style={{ padding: '1.25rem 1.4rem' }}>
          {/* Client & Summary Card */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              marginBottom: '1.15rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                  ക്ലയന്റ് (Client):
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
                  ഇൻവോയ്സ് തുക:
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#15803d' }}>
                  ₹{invoice.amount.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.75rem', color: balanceDue > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                  {balanceDue > 0 ? `ബാക്കി: ₹${balanceDue.toLocaleString('en-IN')}` : '✓ Fully Paid'}
                </div>
              </div>
            </div>
          </div>

          {/* Feature Highlight Banner */}
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '0.75rem 0.95rem',
              marginBottom: '1.25rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#15803d', fontWeight: 700, fontSize: '0.85rem' }}>
              <span>📎</span>
              <span>ഓട്ടോമാറ്റിക് PDF അറ്റാച്ച്‌മെന്റ് സൗകര്യം</span>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: '#166534', lineHeight: 1.5 }}>
              സ്മാർട്ട്ഫോണുകളിൽ (Android / iPhone) താഴെയുള്ള <strong>&ldquo;വാട്സാപ്പിൽ PDF അയക്കുക&rdquo;</strong> ബട്ടൺ ക്ലിക്ക് ചെയ്യുമ്പോൾ ഇൻവോയ്സ് PDF ഫയൽ ഓട്ടോമാറ്റിക് ആയി വാട്സാപ്പിൽ അറ്റാച്ച് ആകും. കമ്പ്യൂട്ടറുകളിൽ ഫയൽ ഉടൻ ഡൗൺലോഡ് ആവുകയും വാട്സാപ്പ് തുറക്കുകയും ചെയ്യും.
            </p>
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
            {/* Primary: Share PDF to WhatsApp */}
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
                boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.25)',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{isGenerating ? '⏳' : '📲'}</span>
              <span>
                {isGenerating ? 'PDF തയ്യാറാക്കുന്നു...' : 'വാട്സാപ്പിൽ PDF അയക്കുക (Share PDF to WhatsApp)'}
              </span>
            </button>

            {/* Secondary Actions Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginTop: '0.25rem' }}>
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
                  padding: '0.6rem'
                }}
              >
                <span>💬</span>
                <span>Open Chat Only</span>
              </button>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyText}
              style={{
                marginTop: '0.15rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem'
              }}
            >
              <span>{copied ? '✓' : '📋'}</span>
              <span>{copied ? 'കോപ്പി ചെയ്തു! (Copied)' : 'Copy WhatsApp Message Text'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            padding: '0.75rem 1.4rem',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={isGenerating}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
