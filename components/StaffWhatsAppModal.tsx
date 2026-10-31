'use client';

import React, { useEffect, useState } from 'react';
import { EventRecord, Shift } from '@/lib/types';
import { store } from '@/lib/store';
import {
  WhatsAppTemplateLang,
  buildWhatsAppDirectUrl,
  formatDisplayWhatsAppPhone,
  formatEventCrewRosterMessage,
  formatEventDateReadable,
  formatShiftTime12h,
  formatStaffShiftWhatsAppMessage,
  normalizeWhatsAppPhone
} from '@/lib/staffWhatsApp';
import { isDesktopWebView } from '@/lib/whatsappDeviceShare';

interface StaffWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventRecord | null;
  /** If provided, opens directly for this single assigned shift; otherwise opens Event Crew Broadcast Queue */
  targetShift?: Shift | null;
  initialNote?: string;
}

export default function StaffWhatsAppModal({
  isOpen,
  onClose,
  event,
  targetShift = null,
  initialNote = ''
}: StaffWhatsAppModalProps) {
  const [state, setState] = useState(store.getState());
  const [mode, setMode] = useState<'single' | 'broadcast'>(targetShift ? 'single' : 'broadcast');
  const [activeShiftId, setActiveShiftId] = useState<string>(targetShift?.id || '');
  const [lang] = useState<WhatsAppTemplateLang>('english');
  const [customNote, setCustomNote] = useState<string>(initialNote);
  const [messageText, setMessageText] = useState<string>('');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [rosterCopied, setRosterCopied] = useState<boolean>(false);
  const [sentBanner, setSentBanner] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    setState(store.getState());
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const updateDevice = () => setIsDesktop(isDesktopWebView());
    updateDevice();
    window.addEventListener('resize', updateDevice);
    return () => window.removeEventListener('resize', updateDevice);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSentBanner(null);
    setCopied(false);
    setRosterCopied(false);
    if (targetShift) {
      setMode('single');
      setActiveShiftId(targetShift.id);
      setCustomNote(initialNote || targetShift.duty_note || '');
      const st = store.getState().staff.find((s) => s.id === targetShift.staff_member_id);
      setPhoneInput(st?.phone || '');
    } else {
      setMode('broadcast');
      setActiveShiftId('');
      setCustomNote(initialNote || '');
    }
  }, [isOpen, targetShift, initialNote]);

  const currentShift =
    state.shifts.find((s) => s.id === activeShiftId) || targetShift || null;
  const currentStaff = currentShift
    ? state.staff.find((s) => s.id === currentShift.staff_member_id)
    : undefined;

  useEffect(() => {
    if (!isOpen || !currentShift || !event) return;
    const hrs = store.calculateShiftHours(currentShift.starts_at, currentShift.ends_at);
    const generated = formatStaffShiftWhatsAppMessage({
      shift: currentShift,
      staff: currentStaff ? { ...currentStaff, phone: phoneInput || currentStaff.phone } : undefined,
      event,
      settings: state.settings,
      hours: hrs,
      customNote,
      lang
    });
    setMessageText(generated);
  }, [isOpen, currentShift, currentStaff, event, state.settings, customNote, lang, phoneInput]);

  if (!isOpen || !event) return null;

  const eventShifts = state.shifts.filter((s) => s.event_id === event.id);
  const notifiedCount = eventShifts.filter((s) => Boolean(s.whatsapp_notified_at)).length;

  const handleSaveStaffPhoneIfChanged = () => {
    if (!currentStaff) return;
    const trimmed = phoneInput.trim();
    if (trimmed && trimmed !== currentStaff.phone) {
      store.updateStaff(currentStaff.id, { phone: trimmed });
    }
  };

  const handleMarkSent = (shiftId: string, staffName?: string) => {
    if (mode === 'single') {
      handleSaveStaffPhoneIfChanged();
    }
    store.markShiftWhatsAppNotified(shiftId, customNote || undefined);
    setSentBanner(
      `✓ WhatsApp opened for ${staffName || 'Staff'} — duty notification marked as sent.`
    );
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleCopyFullRoster = async () => {
    try {
      const text = formatEventCrewRosterMessage({
        event,
        shifts: eventShifts,
        staffList: state.staff,
        settings: state.settings,
        calculateHours: (s, e) => store.calculateShiftHours(s, e)
      });
      await navigator.clipboard.writeText(text);
      setRosterCopied(true);
      setTimeout(() => setRosterCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  const normalizedSinglePhone = normalizeWhatsAppPhone(phoneInput || currentStaff?.phone);
  const displaySinglePhone = formatDisplayWhatsAppPhone(phoneInput || currentStaff?.phone);
  const singleWaUrl = buildWhatsAppDirectUrl(phoneInput || currentStaff?.phone, messageText);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1300 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: mode === 'broadcast' ? '640px' : '560px',
          width: '95%',
          padding: 0,
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #86efac',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #15803d 0%, #166534 100%)',
            color: '#ffffff',
            padding: '1.1rem 1.35rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem'
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
                fontSize: '1.35rem',
                flexShrink: 0
              }}
            >
              💬
            </div>
            <div>
              <h2 style={{ fontSize: '1.08rem', fontWeight: 700, margin: 0 }}>
                {mode === 'single'
                  ? 'Staff Duty WhatsApp Notification'
                  : 'Event Crew WhatsApp Broadcast'}
              </h2>
              <div style={{ fontSize: '0.76rem', color: '#bbf7d0', marginTop: '0.15rem' }}>
                {event.title} &bull; {formatEventDateReadable(event.event_date)}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              fontSize: '1.45rem',
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            ×
          </button>
        </div>

        {/* Mode Switcher Tabs (if event has multiple shifts) */}
        {eventShifts.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              padding: '0.6rem 1.35rem',
              background: '#f0fdf4',
              borderBottom: '1px solid #bbf7d0',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {currentShift && (
                <button
                  type="button"
                  onClick={() => setMode('single')}
                  className="btn btn-sm"
                  style={{
                    background: mode === 'single' ? '#15803d' : '#ffffff',
                    color: mode === 'single' ? '#ffffff' : '#166534',
                    border: '1px solid #86efac',
                    fontWeight: 700,
                    fontSize: '0.76rem'
                  }}
                >
                  👤 Individual Staff
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode('broadcast')}
                className="btn btn-sm"
                style={{
                  background: mode === 'broadcast' ? '#15803d' : '#ffffff',
                  color: mode === 'broadcast' ? '#ffffff' : '#166534',
                  border: '1px solid #86efac',
                  fontWeight: 700,
                  fontSize: '0.76rem'
                }}
              >
                👥 All Event Crew ({notifiedCount}/{eventShifts.length} Notified)
              </button>
            </div>

            <div style={{ fontSize: '0.73rem', color: '#166534', fontWeight: 700 }}>
              Format: Official English Duty Notice
            </div>
          </div>
        )}

        {/* Body */}
        <div style={{ padding: '1.15rem 1.35rem', overflowY: 'auto', flex: 1 }}>
          {sentBanner && (
            <div
              style={{
                background: '#dcfce7',
                border: '1px solid #86efac',
                color: '#15803d',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                marginBottom: '1rem'
              }}
            >
              {sentBanner}
            </div>
          )}

          {mode === 'single' && currentShift ? (
            <>
              {/* Staff & Role Summary */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  marginBottom: '1rem'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        fontWeight: 700
                      }}
                    >
                      Assigned Staff
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
                      {currentStaff?.name || 'Staff Member'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#15803d', fontWeight: 700, marginTop: '0.15rem' }}>
                      🎖️ Role: {currentShift.role_label || currentStaff?.role_title || 'Crew'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        fontWeight: 700
                      }}
                    >
                      Shift Schedule
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                      {formatShiftTime12h(currentShift.starts_at)} –{' '}
                      {formatShiftTime12h(currentShift.ends_at)}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                      📍 {event.venue || 'Venue TBD'}
                    </div>
                  </div>
                </div>

                {/* Staff WhatsApp Mobile Number Input (auto-normalized to +91) */}
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
                  <label
                    className="form-label"
                    style={{ fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.3rem', display: 'block' }}
                  >
                    📱 Staff WhatsApp Mobile Number
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="e.g. 9847012345 or +91 98470 12345"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      style={{ flex: 1, minWidth: '200px', fontSize: '0.86rem', padding: '0.45rem 0.65rem' }}
                    />
                    {normalizedSinglePhone ? (
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          background: '#dcfce7',
                          color: '#15803d',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid #86efac'
                        }}
                      >
                        ✓ {displaySinglePhone}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          background: '#fef3c7',
                          color: '#b45309',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '6px',
                          border: '1px solid #fde68a'
                        }}
                      >
                        ⚠️ Enter mobile number
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Special Duty Instructions */}
              <div className="form-group" style={{ marginBottom: '0.85rem' }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  📝 Duty Note / Instructions (Optional)
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Report 30 mins early in black uniform at service gate"
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              {/* Editable WhatsApp Message Preview */}
              <div className="form-group" style={{ marginBottom: '1.1rem' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.35rem'
                  }}
                >
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>
                    WhatsApp Message Preview
                  </label>
                  {isDesktop && (
                    <button
                      type="button"
                      onClick={handleCopyMessage}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.73rem', padding: '0.2rem 0.55rem' }}
                    >
                      {copied ? '✓ Copied!' : '📋 Copy Text'}
                    </button>
                  )}
                </div>
                <textarea
                  className="form-control"
                  rows={8}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  style={{
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                    fontFamily: 'inherit',
                    background: '#f0fdf4',
                    borderColor: '#bbf7d0'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                <a
                  href={singleWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleMarkSent(currentShift.id, currentStaff?.name)}
                  className="btn"
                  style={{
                    flex: 1,
                    minWidth: '220px',
                    background: '#16a34a',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    padding: '0.7rem 1rem',
                    borderRadius: '8px',
                    textAlign: 'center',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 10px rgba(22, 163, 74, 0.25)'
                  }}
                >
                  <span>💬</span>
                  <span>
                    {normalizedSinglePhone
                      ? `Send to ${currentStaff?.name || 'Staff'} on WhatsApp`
                      : 'Open WhatsApp & Choose Contact'}
                  </span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  style={{ padding: '0.7rem 1rem', fontWeight: 600 }}
                >
                  Done
                </button>
              </div>
            </>
          ) : (
            /* Broadcast Queue Mode: All Assigned Crew for this Event */
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                  marginBottom: '0.9rem'
                }}
              >
                <div style={{ fontSize: '0.83rem', color: '#334155' }}>
                  Tap <strong>Send WhatsApp</strong> next to each crew member to send their personalized role &amp; timing directly to their mobile number.
                </div>
                {isDesktop && eventShifts.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyFullRoster}
                    className="btn btn-secondary btn-sm"
                    style={{ fontWeight: 700, fontSize: '0.76rem', whiteSpace: 'nowrap' }}
                  >
                    {rosterCopied ? '✓ Roster Copied!' : '📋 Copy Full Crew List (For Group)'}
                  </button>
                )}
              </div>

              {eventShifts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', padding: '1.5rem 0' }}>
                  No staff roles assigned to this event yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {eventShifts.map((sh) => {
                    const st = state.staff.find((s) => s.id === sh.staff_member_id);
                    const hrs = store.calculateShiftHours(sh.starts_at, sh.ends_at);
                    const msg = formatStaffShiftWhatsAppMessage({
                      shift: sh,
                      staff: st,
                      event,
                      settings: state.settings,
                      hours: hrs,
                      customNote: sh.duty_note || customNote,
                      lang
                    });
                    const waUrl = buildWhatsAppDirectUrl(st?.phone, msg);
                    const formattedPhone = formatDisplayWhatsAppPhone(st?.phone);
                    const isNotified = Boolean(sh.whatsapp_notified_at);

                    return (
                      <div
                        key={sh.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          flexWrap: 'wrap',
                          padding: '0.75rem 0.9rem',
                          borderRadius: '8px',
                          background: isNotified ? '#f0fdf4' : '#ffffff',
                          border: `1px solid ${isNotified ? '#86efac' : '#e2e8f0'}`
                        }}
                      >
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.92rem', color: '#0f172a' }}>
                              {st?.name || 'Staff Member'}
                            </strong>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.45rem',
                                borderRadius: '4px',
                                background: '#e0f2fe',
                                color: '#0369a1'
                              }}
                            >
                              {sh.role_label || st?.role_title || 'Crew'}
                            </span>
                            {isNotified && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '0.1rem 0.45rem',
                                  borderRadius: '4px',
                                  background: '#dcfce7',
                                  color: '#15803d'
                                }}
                              >
                                ✓ Sent
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '0.2rem' }}>
                            📱 {formattedPhone || 'No mobile saved'} &bull; ⏰{' '}
                            {formatShiftTime12h(sh.starts_at)} – {formatShiftTime12h(sh.ends_at)} ({hrs}h)
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveShiftId(sh.id);
                              setPhoneInput(st?.phone || '');
                              setCustomNote(sh.duty_note || '');
                              setMode('single');
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.74rem', padding: '0.35rem 0.6rem' }}
                            title="Customize message or mobile number"
                          >
                            ✏️ Preview
                          </button>

                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleMarkSent(sh.id, st?.name)}
                            className="btn btn-sm"
                            style={{
                              background: '#16a34a',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                              padding: '0.38rem 0.75rem',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}
                          >
                            <span>💬</span>
                            <span>{isNotified ? 'Resend' : 'Send WhatsApp'}</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  style={{ fontWeight: 600 }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
