'use client';

import React, { useEffect, useState } from 'react';
import { EventRecord } from '@/lib/types';
import { store } from '@/lib/store';
import { normalizeWhatsAppPhone } from '@/lib/invoicePdfGenerator';
import {
  formatWhatsAppQuotationMessage,
  generateQuotationPdfBlob
} from '@/lib/quotationPdfGenerator';
import {
  composeWhatsAppMessageWithPdfLink,
  isDesktopWebView,
  isTouchCapableOrMobile,
  sharePdfWithCaptionToWhatsApp,
  shareRawPdfFileViaOsSheet,
  triggerPdfBlobDownload,
  uploadSharedPdfForWhatsApp
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
  const [phoneInput, setPhoneInput] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isMessageEdited, setIsMessageEdited] = useState(false);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [preparedPdf, setPreparedPdf] = useState<{
    blob: Blob;
    file: File;
    quoteNumber: string;
  } | null>(null);
  const [uploadedPdfUrl, setUploadedPdfUrl] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    setIsDesktop(isDesktopWebView());
    setIsMobileDevice(isTouchCapableOrMobile());
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const liveEvent = event
    ? state.events.find((e) => e.id === event.id) || event
    : null;
  const client = liveEvent
    ? state.clients.find((c) => c.id === liveEvent.client_id)
    : undefined;

  useEffect(() => {
    if (!isOpen || !event) {
      setPreparedPdf(null);
      setUploadedPdfUrl(null);
      setStatusMsg(null);
      setIsMessageEdited(false);
      return;
    }

    const currentState = store.getState();
    const currentEvt =
      currentState.events.find((e) => e.id === event.id) || event;
    const currentClient = currentState.clients.find(
      (c) => c.id === currentEvt.client_id
    );

    setPhoneInput(currentClient?.phone || '');
    setMessageText(formatWhatsAppQuotationMessage(currentEvt, currentState));
    setIsMessageEdited(false);
    setStatusMsg(null);
  }, [isOpen, event?.id]);

  // Keep message text synced with Bank/Payment toggles unless manually edited
  useEffect(() => {
    if (!isOpen || !liveEvent || isMessageEdited) return;
    setMessageText(formatWhatsAppQuotationMessage(liveEvent, state));
  }, [
    isOpen,
    liveEvent?.id,
    liveEvent?.show_bank_details,
    liveEvent?.show_payment_details,
    liveEvent?.guest_count,
    isMessageEdited,
    state
  ]);

  // Pre-build Quotation PDF AND pre-upload so tapping Send opens Client's WhatsApp immediately!
  useEffect(() => {
    if (!isOpen || !liveEvent) return;

    let cancelled = false;
    setIsPreparingPdf(true);
    setPreparedPdf(null);
    setUploadedPdfUrl(null);

    const docKey = `qtn-${liveEvent.id}-${Date.now().toString(36)}`;

    generateQuotationPdfBlob(liveEvent, state)
      .then(async (res) => {
        if (cancelled || !res) {
          if (!cancelled) setIsPreparingPdf(false);
          return;
        }
        setPreparedPdf(res);
        const pubUrl = await uploadSharedPdfForWhatsApp(
          res.blob,
          `${res.quoteNumber}.pdf`,
          docKey
        );
        if (!cancelled) {
          setUploadedPdfUrl(pubUrl);
          setIsPreparingPdf(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsPreparingPdf(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    liveEvent?.id,
    liveEvent?.show_bank_details,
    liveEvent?.show_payment_details,
    liveEvent?.guest_count,
    state.eventItems.length,
    state.eventExtras.length
  ]);

  if (!isOpen || !liveEvent) return null;

  const quoteNumber = store.getQuotationNumber(liveEvent);
  const { menuTotal, extrasTotal, grandTotal } = store.getEventTotal(liveEvent.id);
  const showBankDetails = liveEvent.show_bank_details !== false;
  const showPaymentDetails = liveEvent.show_payment_details !== false;
  const cleanPhone = normalizeWhatsAppPhone(phoneInput);
  const pdfFilename = `${quoteNumber}.pdf`;

  const handleToggleOption = (
    field: 'show_bank_details' | 'show_payment_details',
    checked: boolean
  ) => {
    store.updateEvent(liveEvent.id, { [field]: checked });
  };

  // Primary Direct-to-Client WhatsApp Send: Attaches BOTH Proposal Text + Official Quotation PDF directly to Client's Number
  const handleSendWhatsAppWithPdfAndText = async () => {
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 10) {
      setStatusMsg({
        type: 'error',
        text: 'Please enter the client’s 10-digit WhatsApp mobile number above so both Proposal Text & PDF open directly in their WhatsApp chat.'
      });
      return;
    }

    setIsSharing(true);
    setStatusMsg(null);

    // Persist updated phone number to client record if changed
    if (client && phoneInput.trim() && phoneInput.trim() !== client.phone) {
      store.updateClient(client.id, { phone: phoneInput.trim() });
    }

    const pdfData =
      preparedPdf || (await generateQuotationPdfBlob(liveEvent, state));
    if (!pdfData) {
      setIsSharing(false);
      setStatusMsg({
        type: 'error',
        text: 'Could not generate Quotation PDF.'
      });
      return;
    }

    const outcome = await sharePdfWithCaptionToWhatsApp({
      file: pdfData.file,
      blob: pdfData.blob,
      filename: `${pdfData.quoteNumber}.pdf`,
      messageText,
      cleanPhone,
      docId: `qtn-${liveEvent.id}`,
      preUploadedPdfUrl: uploadedPdfUrl
    });

    setIsSharing(false);

    if (!outcome.success) {
      setStatusMsg({
        type: 'error',
        text: outcome.error || 'Could not open client WhatsApp chat.'
      });
      return;
    }

    if (liveEvent.status === 'inquiry') {
      store.updateEvent(liveEvent.id, { status: 'quoted' });
    }

    if (outcome.pdfPublicUrl && !uploadedPdfUrl) {
      setUploadedPdfUrl(outcome.pdfPublicUrl);
    }

    setStatusMsg({
      type: 'success',
      text: isDesktop
        ? `✓ Opened ${client?.name || 'Client'}'s WhatsApp (+${cleanPhone}) with BOTH proposal text & official ${pdfData.quoteNumber}.pdf attached (and saved PDF to Downloads)!`
        : `✓ Opened ${client?.name || 'Client'}'s WhatsApp (+${cleanPhone}) directly with BOTH proposal text & official ${pdfData.quoteNumber}.pdf attached together! Just tap Send in WhatsApp.`
    });
  };

  const handleShareRawFileSheet = async () => {
    const pdfData =
      preparedPdf || (await generateQuotationPdfBlob(liveEvent, state));
    if (!pdfData) return;
    const res = await shareRawPdfFileViaOsSheet(pdfData.file, messageText);
    if (res.shared) {
      setStatusMsg({
        type: 'info',
        text: `📎 Raw Quotation PDF opened in Share Sheet (proposal text also copied to clipboard).`
      });
    }
  };

  const handleDownloadPdfOnly = async () => {
    setIsSharing(true);
    const pdfData =
      preparedPdf || (await generateQuotationPdfBlob(liveEvent, state));
    setIsSharing(false);

    if (pdfData) {
      triggerPdfBlobDownload(pdfData.blob, `${pdfData.quoteNumber}.pdf`);
      setStatusMsg({
        type: 'success',
        text: `✓ Downloaded ${pdfData.quoteNumber}.pdf.`
      });
    }
  };

  const handleCopyMessage = async () => {
    try {
      const fullCopy = composeWhatsAppMessageWithPdfLink(
        messageText,
        pdfFilename,
        uploadedPdfUrl
      );
      await navigator.clipboard.writeText(fullCopy);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '580px', width: '96%', padding: 0, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Emerald Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
            color: '#ffffff',
            padding: '1.1rem 1.35rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem'
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.12rem', fontWeight: 800, margin: 0 }}>
              💬 Send Quotation PDF + Text to Client WhatsApp
            </h2>
            <p style={{ fontSize: '0.78rem', opacity: 0.92, marginTop: '0.2rem' }}>
              Catering Proposal #{quoteNumber} • Direct to client&apos;s WhatsApp number
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.18)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              padding: '0.3rem 0.6rem',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '1.25rem 1.35rem', maxHeight: '82vh', overflowY: 'auto' }}>
          {/* PDF + Text Bundle Summary Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfeff 100%)',
              border: '1px solid #a7f3d0',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}
          >
            <div>
              <div style={{ fontWeight: 800, color: '#065f46', fontSize: '0.92rem' }}>
                📎 {pdfFilename} + Proposal Text
              </div>
              <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '0.15rem', fontVariantNumeric: 'tabular-nums' }}>
                Menu ₹{menuTotal.toLocaleString('en-IN')} + Extras ₹{extrasTotal.toLocaleString('en-IN')} = Total ₹{grandTotal.toLocaleString('en-IN')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: isPreparingPdf ? '#b45309' : '#065f46',
                  background: isPreparingPdf ? '#fef3c7' : '#d1fae5',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                {isPreparingPdf ? '⏳ Attaching PDF...' : '✓ PDF + Text Attached'}
              </span>
            </div>
          </div>

          {/* Bank & Payment Toggle Switches */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.7rem 0.9rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
              Include in PDF &amp; Text:
            </span>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showBankDetails}
                  onChange={(e) => handleToggleOption('show_bank_details', e.target.checked)}
                />
                Bank Details
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showPaymentDetails}
                  onChange={(e) => handleToggleOption('show_payment_details', e.target.checked)}
                />
                Payment Details
              </label>
            </div>
          </div>

          {/* Client WhatsApp Number */}
          <div className="form-group" style={{ marginBottom: '0.9rem' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Client WhatsApp Number ({client?.name || 'Client'}) *</span>
              {cleanPhone ? (
                <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>
                  Direct Chat: +{cleanPhone}
                </span>
              ) : (
                <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.74rem' }}>
                  Enter 10-digit mobile number
                </span>
              )}
            </label>
            <input
              type="tel"
              className="form-control"
              placeholder="e.g. +91 98471 23456"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
            />
          </div>

          {/* Editable Attached WhatsApp Proposal Text */}
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.35rem',
                gap: '0.5rem'
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                Proposal Text + Official PDF Attachment
              </span>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                {isMessageEdited && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.18rem 0.5rem', fontSize: '0.72rem' }}
                    onClick={() => {
                      setIsMessageEdited(false);
                      setMessageText(formatWhatsAppQuotationMessage(liveEvent, state));
                    }}
                  >
                    Reset Text
                  </button>
                )}
                {isDesktop && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCopyMessage}
                    style={{ padding: '0.18rem 0.55rem', fontSize: '0.73rem' }}
                  >
                    {copiedText ? '✓ Copied' : '📋 Copy Text'}
                  </button>
                )}
              </div>
            </div>
            <textarea
              className="form-control"
              rows={6}
              value={messageText}
              onChange={(e) => {
                setIsMessageEdited(true);
                setMessageText(e.target.value);
              }}
              style={{
                fontSize: '0.8rem',
                lineHeight: 1.5,
                background: '#f8fafc',
                fontFamily: 'inherit'
              }}
            />
            {uploadedPdfUrl && (
              <div
                style={{
                  marginTop: '0.4rem',
                  padding: '0.45rem 0.7rem',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem'
                }}
              >
                <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📄 Auto-attached with text: {pdfFilename}
                </span>
                <a
                  href={uploadedPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#047857', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}
                >
                  Preview PDF
                </a>
              </div>
            )}
          </div>

          {/* Status Feedback */}
          {statusMsg && (
            <div
              style={{
                padding: '0.75rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                marginBottom: '1rem',
                lineHeight: 1.45,
                background:
                  statusMsg.type === 'success'
                    ? '#dcfce7'
                    : statusMsg.type === 'error'
                    ? '#fee2e2'
                    : '#eff6ff',
                color:
                  statusMsg.type === 'success'
                    ? '#166534'
                    : statusMsg.type === 'error'
                    ? '#b91c1c'
                    : '#1e40af',
                border: `1px solid ${
                  statusMsg.type === 'success'
                    ? '#86efac'
                    : statusMsg.type === 'error'
                    ? '#fca5a5'
                    : '#bfdbfe'
                }`
              }}
            >
              {statusMsg.text}
            </div>
          )}

          {/* Direct Client WhatsApp CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={handleSendWhatsAppWithPdfAndText}
              disabled={isSharing || isPreparingPdf}
              style={{
                width: '100%',
                background: isPreparingPdf
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                padding: '0.85rem 1rem',
                fontSize: '0.92rem',
                borderRadius: '10px',
                cursor: isPreparingPdf ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
                whiteSpace: 'nowrap'
              }}
            >
              {isPreparingPdf
                ? '⏳ Attaching PDF & Text...'
                : isSharing
                ? '⏳ Opening Client WhatsApp...'
                : cleanPhone
                ? `📲 Send Text + PDF to +${cleanPhone}`
                : '📲 Send Text + PDF to Client WhatsApp'}
            </button>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {isMobileDevice && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleShareRawFileSheet}
                  disabled={isSharing || isPreparingPdf}
                  style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  📎 Share Raw PDF File
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDownloadPdfOnly}
                disabled={isSharing || isPreparingPdf}
                style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                📥 Download PDF
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                style={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
