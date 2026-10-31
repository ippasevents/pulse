'use client';

import React, { useEffect, useState } from 'react';
import { AppState } from '@/lib/store';
import { normalizeWhatsAppPhone } from '@/lib/invoicePdfGenerator';
import {
  formatPeriodLabel,
  formatStaffSalarySlipWhatsAppMessage,
  generateSingleStaffSalarySlipPdfBlob,
  StaffPeriodReportRow
} from '@/lib/staffSalaryPdfGenerator';
import {
  isDesktopWebView,
  sharePdfWithCaptionToWhatsApp,
  triggerPdfBlobDownload
} from '@/lib/whatsappDeviceShare';

interface SalarySlipWhatsAppModalProps {
  row: StaffPeriodReportRow | null;
  startDate: string;
  endDate: string;
  state: AppState;
  onClose: () => void;
}

export default function SalarySlipWhatsAppModal({
  row,
  startDate,
  endDate,
  state,
  onClose
}: SalarySlipWhatsAppModalProps) {
  const [phoneInput, setPhoneInput] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [preparedPdf, setPreparedPdf] = useState<{
    blob: Blob;
    file: File;
    filename: string;
  } | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    type: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(isDesktopWebView());
  }, []);

  useEffect(() => {
    if (!row) {
      setPreparedPdf(null);
      setStatusMsg(null);
      return;
    }

    setPhoneInput(row.staff.phone || '');
    setMessageText(
      formatStaffSalarySlipWhatsAppMessage(row, startDate, endDate, state)
    );
    setStatusMsg(null);

    let cancelled = false;
    setIsPreparingPdf(true);
    setPreparedPdf(null);

    generateSingleStaffSalarySlipPdfBlob(row, startDate, endDate, state)
      .then((res) => {
        if (!cancelled) {
          setPreparedPdf(res);
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
  }, [row?.staff.id, startDate, endDate]);

  if (!row) return null;

  const cleanPhone = normalizeWhatsAppPhone(phoneInput);

  const handleSendWhatsAppWithPdfAndText = async () => {
    if (!preparedPdf) return;
    setIsSharing(true);
    setStatusMsg(null);

    const outcome = await sharePdfWithCaptionToWhatsApp({
      file: preparedPdf.file,
      blob: preparedPdf.blob,
      filename: preparedPdf.filename,
      messageText,
      cleanPhone
    });

    setIsSharing(false);

    if (!outcome.success) {
      setStatusMsg({
        type: 'error',
        text: outcome.error || 'Could not share Salary Slip PDF & text.'
      });
      return;
    }

    if (outcome.sharedDirectlyWithFile) {
      setStatusMsg({
        type: 'success',
        text: `✓ ${preparedPdf.filename} and salary summary text attached together! Select WhatsApp and ${row.staff.name} to send.`
      });
    } else {
      setStatusMsg({
        type: 'info',
        text: `📥 ${preparedPdf.filename} downloaded & WhatsApp opened with text pre-filled! Attach the downloaded PDF in chat and press Send.`
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '560px', width: '96%', padding: 0, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
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
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
              💬 Send Salary Slip PDF + Text on WhatsApp
            </h2>
            <p style={{ fontSize: '0.78rem', opacity: 0.92, marginTop: '0.2rem' }}>
              {row.staff.name} • {formatPeriodLabel(startDate, endDate)}
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

        <div style={{ padding: '1.25rem 1.35rem', maxHeight: '80vh', overflowY: 'auto' }}>
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
              <div style={{ fontWeight: 800, color: '#065f46', fontSize: '0.9rem' }}>
                📎 Salary Slip PDF + Summary Text
              </div>
              <div style={{ fontSize: '0.78rem', color: '#047857', marginTop: '0.15rem' }}>
                Earned ₹{row.totalEarnings.toLocaleString('en-IN')} • Paid ₹{row.paymentsReceived.toLocaleString('en-IN')} • Balance ₹{row.periodPayable.toLocaleString('en-IN')}
              </div>
            </div>
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
              {isPreparingPdf ? '⏳ Preparing PDF...' : '✓ PDF + Text Ready'}
            </span>
          </div>

          <div className="form-group" style={{ marginBottom: '0.9rem' }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Staff WhatsApp Number ({row.staff.name})</span>
              {cleanPhone && (
                <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.75rem' }}>
                  +{cleanPhone}
                </span>
              )}
            </label>
            <input
              type="tel"
              className="form-control"
              placeholder="e.g. +91 97451 11001"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.35rem'
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                Attached Salary Text (Sent Together with PDF)
              </span>
              {isDesktop && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(messageText);
                      setCopiedText(true);
                      setTimeout(() => setCopiedText(false), 2000);
                    } catch {
                      // ignore
                    }
                  }}
                  style={{ padding: '0.18rem 0.55rem', fontSize: '0.73rem' }}
                >
                  {copiedText ? '✓ Copied' : '📋 Copy Text'}
                </button>
              )}
            </div>
            <textarea
              className="form-control"
              rows={6}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              style={{
                fontSize: '0.8rem',
                lineHeight: 1.5,
                background: '#f8fafc',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {statusMsg && (
            <div
              style={{
                padding: '0.75rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                marginBottom: '1rem',
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <button
              type="button"
              onClick={handleSendWhatsAppWithPdfAndText}
              disabled={isSharing || isPreparingPdf || !preparedPdf}
              style={{
                width: '100%',
                background: isPreparingPdf
                  ? '#94a3b8'
                  : 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                padding: '0.85rem 1rem',
                fontSize: '0.94rem',
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
                ? '⏳ Preparing Salary Slip PDF...'
                : isSharing
                ? '⏳ Opening WhatsApp...'
                : '📲 Send PDF & Text Together on WhatsApp'}
            </button>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={isPreparingPdf || !preparedPdf}
                onClick={() => {
                  if (preparedPdf) {
                    triggerPdfBlobDownload(preparedPdf.blob, preparedPdf.filename);
                  }
                }}
                style={{ flex: 1, fontSize: '0.83rem', fontWeight: 600 }}
              >
                📥 Download PDF Only
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                style={{ fontSize: '0.83rem', fontWeight: 600 }}
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
