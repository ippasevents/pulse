'use client';

import React, { useEffect, useState } from 'react';
import { Invoice } from '@/lib/types';
import { store } from '@/lib/store';
import {
  generateInvoicePdfBlob,
  formatWhatsAppInvoiceMessage,
  shareInvoicePdfToWhatsApp
} from '@/lib/invoicePdfGenerator';
import {
  isDesktopWebView,
  openExternalUrlSafe,
  triggerPdfBlobDownload
} from '@/lib/whatsappDeviceShare';

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
  const [isDesktop, setIsDesktop] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [preparedPdf, setPreparedPdf] = useState<{ blob: Blob; file: File } | null>(null);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    setState(store.getState());
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const updateDeviceMode = () => setIsDesktop(isDesktopWebView());
    updateDeviceMode();
    window.addEventListener('resize', updateDeviceMode);
    return () => window.removeEventListener('resize', updateDeviceMode);
  }, []);

  const liveInvoice = invoice
    ? state.invoices.find((i) => i.id === invoice.id) || invoice
    : null;
  const invPayments = liveInvoice
    ? state.payments.filter((p) => p.invoice_id === liveInvoice.id)
    : [];
  const paymentsForThis = invPayments.reduce((s, p) => s + p.amount, 0);
  const showBankDetails = liveInvoice ? liveInvoice.show_bank_details !== false : true;
  const showPaymentDetails = liveInvoice ? liveInvoice.show_payment_details !== false : true;
  const invoiceId = liveInvoice?.id || '';
  const liveAmount = liveInvoice?.amount || 0;
  const liveDiscount = liveInvoice?.discount || 0;
  const liveDiscountNote = liveInvoice?.discount_note || '';
  const liveStatus = liveInvoice?.status || '';

  // Pre-build PDF as soon as the modal opens so smartphone tap shares PDF + Text synchronously inside user gesture
  useEffect(() => {
    if (!isOpen || !invoiceId) {
      setPreparedPdf(null);
      setIsPreparingPdf(false);
      return;
    }

    let cancelled = false;
    setIsPreparingPdf(true);
    setPreparedPdf(null);

    const latestState = store.getState();
    const targetInv = latestState.invoices.find((i) => i.id === invoiceId);
    if (!targetInv) {
      setIsPreparingPdf(false);
      return;
    }

    generateInvoicePdfBlob(targetInv, latestState)
      .then((res) => {
        if (!cancelled && res) {
          setPreparedPdf({ blob: res.blob, file: res.file });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreparingPdf(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    invoiceId,
    liveAmount,
    liveDiscount,
    liveDiscountNote,
    liveStatus,
    showBankDetails,
    showPaymentDetails,
    paymentsForThis
  ]);

  if (!isOpen || !liveInvoice) return null;

  const evt = state.events.find((e) => e.id === liveInvoice.event_id);
  const client = state.clients.find((c) => c.id === evt?.client_id);
  const balanceDue = Math.max(0, liveInvoice.amount - paymentsForThis);
  const isFullyPaid =
    liveInvoice.status === 'paid' || (liveInvoice.amount > 0 && balanceDue <= 0);

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
      const res = await shareInvoicePdfToWhatsApp(
        liveInvoice,
        store.getState(),
        preparedPdf || undefined
      );

      if (res.success) {
        if (res.sharedDirectlyWithFile) {
          setFeedback({
            type: 'success',
            message:
              '✓ WhatsApp opened with Invoice PDF and message text attached automatically!'
          });
        } else {
          setFeedback({
            type: 'info',
            message:
              '✓ Invoice PDF downloaded and WhatsApp opened with message text ready. Attach the downloaded PDF in chat to send.'
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
      const res =
        preparedPdf || (await generateInvoicePdfBlob(liveInvoice, store.getState()));
      if (res) {
        triggerPdfBlobDownload(res.blob, `${liveInvoice.invoice_number}.pdf`);
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
      // ignore clipboard errors
    }
  };

  const handleOpenDirectChat = () => {
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`;
    openExternalUrlSafe(waUrl);
  };

  const isBusy = isGenerating || (!isDesktop && isPreparingPdf);

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
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
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
                Share{' '}
                {isFullyPaid || liveInvoice.kind === 'final'
                  ? 'Final Settlement Invoice'
                  : 'Invoice'}{' '}
                on WhatsApp
              </h2>
              <div style={{ fontSize: '0.75rem', color: '#bbf7d0', marginTop: '0.15rem' }}>
                PDF Document &amp; Message Auto-Attach &bull; #{liveInvoice.invoice_number}
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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    fontWeight: 600
                  }}
                >
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
                <div
                  style={{
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    fontWeight: 600
                  }}
                >
                  {isFullyPaid || liveInvoice.kind === 'final'
                    ? 'Final Settlement Total:'
                    : 'Invoice Total:'}
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#15803d' }}>
                  ₹{liveInvoice.amount.toLocaleString('en-IN')}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: !isFullyPaid ? '#dc2626' : '#16a34a',
                    fontWeight: 600
                  }}
                >
                  {!isFullyPaid
                    ? `Balance Due: ₹${balanceDue.toLocaleString('en-IN')}`
                    : '✓ Fully Paid (Payment Terms Hidden)'}
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
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#1e293b'
                }}
              >
                <input
                  type="checkbox"
                  checked={showBankDetails}
                  onChange={(e) => handleToggleBank(e.target.checked)}
                />
                🏦 Bank Details
              </label>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#1e293b'
                }}
              >
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
                background:
                  feedback.type === 'success'
                    ? '#dcfce7'
                    : feedback.type === 'info'
                    ? '#eff6ff'
                    : '#fee2e2',
                border: `1px solid ${
                  feedback.type === 'success'
                    ? '#86efac'
                    : feedback.type === 'info'
                    ? '#93c5fd'
                    : '#fca5a5'
                }`,
                color:
                  feedback.type === 'success'
                    ? '#15803d'
                    : feedback.type === 'info'
                    ? '#1e40af'
                    : '#991b1b',
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
              disabled={isBusy}
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
                cursor: isBusy ? 'not-allowed' : 'pointer',
                opacity: isBusy ? 0.85 : 1,
                boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.25)'
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{isBusy ? '⏳' : '📲'}</span>
              <span>
                {isGenerating
                  ? 'Sharing to WhatsApp...'
                  : !isDesktop && isPreparingPdf
                  ? 'Preparing Document & Text...'
                  : 'Share PDF & Text on WhatsApp'}
              </span>
            </button>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.65rem',
                marginTop: '0.2rem'
              }}
            >
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

          {/* Message Preview — Copy Text shown ONLY on Desktop / Laptop Web View */}
          <div style={{ marginTop: '1rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.35rem',
                gap: '0.5rem'
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase'
                }}
              >
                WhatsApp Message Preview
              </span>
              {isDesktop ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem' }}
                  onClick={handleCopyText}
                >
                  {copied ? '✓ Copied!' : '📋 Copy Text'}
                </button>
              ) : (
                <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600 }}>
                  ✓ Auto-attached with PDF
                </span>
              )}
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
