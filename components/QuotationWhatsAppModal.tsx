'use client';

import React, { useEffect, useState } from 'react';
import { EventRecord } from '@/lib/types';
import { store } from '@/lib/store';
import {
  generateQuotationPdfBlob,
  formatWhatsAppQuotationMessage,
  shareQuotationPdfToWhatsApp
} from '@/lib/quotationPdfGenerator';
import {
  isDesktopWebView,
  openExternalUrlSafe,
  triggerPdfBlobDownload
} from '@/lib/whatsappDeviceShare';

interface QuotationWhatsAppModalProps {
  event: EventRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function QuotationWhatsAppModal({
  event,
  isOpen,
  onClose
}: QuotationWhatsAppModalProps) {
  const [state, setState] = useState(store.getState());
  const [isDesktop, setIsDesktop] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [preparedPdf, setPreparedPdf] = useState<{
    blob: Blob;
    file: File;
    quoteNumber: string;
  } | null>(null);
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

  const liveEvent = event
    ? state.events.find((e) => e.id === event.id) || event
    : null;
  const eventId = liveEvent?.id || '';
  const totals = liveEvent
    ? store.getEventTotal(liveEvent.id)
    : { menuTotal: 0, extrasTotal: 0, grandTotal: 0 };
  const evtItemsCount = liveEvent
    ? state.eventItems.filter((i) => i.event_id === liveEvent.id).length
    : 0;
  const evtExtrasCount = liveEvent
    ? state.eventExtras.filter((x) => x.event_id === liveEvent.id).length
    : 0;
  const showBankDetails = liveEvent ? liveEvent.show_bank_details !== false : true;
  const showPaymentDetails = liveEvent ? liveEvent.show_payment_details !== false : true;
  const paymentTermsStr = liveEvent?.payment_terms || '';

  // Pre-build Quotation PDF on modal open so smartphone tap shares PDF + Text synchronously inside user gesture
  useEffect(() => {
    if (!isOpen || !eventId) {
      setPreparedPdf(null);
      setIsPreparingPdf(false);
      return;
    }

    let cancelled = false;
    setIsPreparingPdf(true);
    setPreparedPdf(null);

    const latestState = store.getState();
    const targetEvent = latestState.events.find((e) => e.id === eventId);
    if (!targetEvent) {
      setIsPreparingPdf(false);
      return;
    }

    generateQuotationPdfBlob(targetEvent, latestState)
      .then((res) => {
        if (!cancelled && res) {
          setPreparedPdf(res);
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
    eventId,
    totals.grandTotal,
    evtItemsCount,
    evtExtrasCount,
    showBankDetails,
    showPaymentDetails,
    paymentTermsStr
  ]);

  if (!isOpen || !liveEvent) return null;

  const client = state.clients.find((c) => c.id === liveEvent.client_id);
  const quoteNumber = store.getQuotationNumber(liveEvent);
  const { menuTotal, extrasTotal, grandTotal } = totals;

  const rawDigits = (client?.phone || '').replace(/[^0-9]/g, '');
  const cleanPhone = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits;
  const messageText = formatWhatsAppQuotationMessage(liveEvent, state);

  const handleToggleBank = (checked: boolean) => {
    store.updateEvent(liveEvent.id, { show_bank_details: checked });
  };

  const handleTogglePayment = (checked: boolean) => {
    store.updateEvent(liveEvent.id, { show_payment_details: checked });
  };

  const handleShareWithPdf = async () => {
    setIsGenerating(true);
    setFeedback(null);
    try {
      const res = await shareQuotationPdfToWhatsApp(
        liveEvent,
        store.getState(),
        preparedPdf || undefined
      );
      if (res.success) {
        if (res.sharedDirectlyWithFile) {
          setFeedback({
            type: 'success',
            message: `✓ WhatsApp opened with Quotation PDF (${res.quoteNumber}.pdf) and message text attached automatically!`
          });
        } else {
          setFeedback({
            type: 'info',
            message: `✓ Quotation PDF (${res.quoteNumber}.pdf) downloaded and Client WhatsApp chat opened with message text ready. Attach the downloaded PDF in chat to send.`
          });
        }
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Unable to share Quotation to WhatsApp.'
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
        preparedPdf || (await generateQuotationPdfBlob(liveEvent, store.getState()));
      if (res) {
        triggerPdfBlobDownload(res.blob, `${res.quoteNumber}.pdf`);
        setFeedback({
          type: 'success',
          message: `✓ Quotation PDF (${res.quoteNumber}.pdf) downloaded successfully!`
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Unable to download Quotation PDF.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenDirectChat = () => {
    if (liveEvent.status === 'inquiry') {
      store.updateEvent(liveEvent.id, { status: 'quoted' });
    }
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`;
    openExternalUrlSafe(waUrl);
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

  const isBusy = isGenerating || (!isDesktop && isPreparingPdf);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1260 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '95%',
          padding: 0,
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #86efac',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.12)'
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
            color: '#ffffff',
            padding: '1.1rem 1.4rem',
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
                fontSize: '1.35rem'
              }}
            >
              📲
            </div>
            <div>
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, margin: 0 }}>
                Send Quotation to Client WhatsApp
              </h2>
              <div style={{ fontSize: '0.76rem', color: '#bbf7d0', marginTop: '0.15rem' }}>
                Catering Proposal &bull; #{quoteNumber}
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
        <div style={{ padding: '1.2rem 1.4rem', maxHeight: '82vh', overflowY: 'auto' }}>
          {/* Client & Quote Summary */}
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
                  Client WhatsApp:
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>
                  {client?.name || 'Valued Client'}
                </div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: cleanPhone ? '#15803d' : '#dc2626',
                    fontWeight: 600
                  }}
                >
                  📞 {client?.phone || 'Client phone number not added yet'}
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
                  Quotation #{quoteNumber}
                </div>
                <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#15803d' }}>
                  ₹{grandTotal.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.74rem', color: '#475569' }}>
                  {evtItemsCount} Menu (₹{menuTotal.toLocaleString('en-IN')}) + {evtExtrasCount}{' '}
                  Logistics/Extras (₹{extrasTotal.toLocaleString('en-IN')})
                </div>
              </div>
            </div>
          </div>

          {/* Bank & Payment Details Toggles */}
          <div
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.7rem 0.9rem',
              marginBottom: '0.95rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
              Include in Quotation PDF &amp; Message:
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

          {/* Feedback */}
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
                padding: '0.7rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                marginBottom: '0.95rem',
                fontWeight: 600,
                lineHeight: 1.45
              }}
            >
              {feedback.message}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={handleShareWithPdf}
              disabled={isBusy}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.82rem 1.2rem',
                fontWeight: 700,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: isBusy ? 'not-allowed' : 'pointer',
                opacity: isBusy ? 0.85 : 1,
                boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.25)'
              }}
            >
              <span style={{ fontSize: '1.15rem' }}>{isBusy ? '⏳' : '📲'}</span>
              <span>
                {isGenerating
                  ? 'Sharing Quotation...'
                  : !isDesktop && isPreparingPdf
                  ? 'Preparing Quotation PDF & Text...'
                  : `Send Quotation PDF & Text (${quoteNumber})`}
              </span>
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadOnly}
                disabled={isGenerating}
                style={{ padding: '0.58rem', fontWeight: 600 }}
              >
                📥 Download PDF
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleOpenDirectChat}
                disabled={isGenerating}
                style={{
                  padding: '0.58rem',
                  fontWeight: 600,
                  background: '#f0fdf4',
                  borderColor: '#bbf7d0',
                  color: '#15803d'
                }}
              >
                💬 Open WhatsApp Chat
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
                maxHeight: '170px',
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
