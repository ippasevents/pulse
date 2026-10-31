'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { store } from '@/lib/store';
import {
  ENGLISH_USER_MANUALS,
  MALAYALAM_EDITION_USER_MANUALS,
  getUserManualsByLanguage,
  MANUAL_ROLE_ORDER,
  ManualLanguage,
  ManualRoleKey
} from '@/lib/userManualsMalayalam';
import {
  downloadAllFourUserManualPdfs,
  downloadRoleUserManualPdf
} from '@/lib/userManualPdfGenerator';

const UI_FONT_FAMILY = `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif`;
const MANUAL_CONTENT_FONT_FAMILY = `'Plus Jakarta Sans', 'Noto Sans Malayalam', -apple-system, BlinkMacSystemFont, sans-serif`;

const ROLE_CARD_SURFACES: Record<
  ManualRoleKey,
  { gradient: string; buttonBg: string; border: string }
> = {
  owner: {
    gradient: 'linear-gradient(180deg, #fff1f2 0%, #ffffff 62%)',
    buttonBg: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
    border: '#fecdd3'
  },
  manager: {
    gradient: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 62%)',
    buttonBg: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    border: '#bfdbfe'
  },
  accountant: {
    gradient: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 62%)',
    buttonBg: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
    border: '#a7f3d0'
  },
  staff: {
    gradient: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 62%)',
    buttonBg: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    border: '#ddd6fe'
  }
};

export default function UserManualsPage() {
  const [state, setState] = useState(store.getState());
  const [selectedLanguage, setSelectedLanguage] = useState<ManualLanguage>('en');
  const [downloadingToken, setDownloadingToken] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    const syncState = () => {
      setState(store.getState());
    };
    const unsub = store.subscribe(syncState);
    return unsub;
  }, []);

  // Strict 4-role visibility mapping (Owner, Manager, Accountant, Staff — zero mention of any hidden role)
  const visibleManualKeys: ManualRoleKey[] = useMemo(() => {
    const r = state.currentRole;
    if (r === 'staff') return ['staff'];
    if (r === 'accountant') return ['accountant'];
    if (r === 'manager') return ['manager', 'staff'];
    return MANUAL_ROLE_ORDER;
  }, [state.currentRole]);

  const activeManualsMap = useMemo(
    () => getUserManualsByLanguage(selectedLanguage),
    [selectedLanguage]
  );

  const businessName = state.settings?.name || 'IPPAS FOOD SERVICE & EVENTS';
  const businessPhone = state.settings?.phone || '+91 98470 11111';

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => {
      setStatusBanner((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const handleDownloadSinglePdf = async (key: ManualRoleKey, lang: ManualLanguage) => {
    if (downloadingToken || batchProgress) return;
    const token = `${key}:${lang}`;
    setDownloadingToken(token);
    const manual = getUserManualsByLanguage(lang)[key];
    const ok = await downloadRoleUserManualPdf(key, businessName, businessPhone, lang);
    setDownloadingToken(null);
    if (ok) {
      showToast(
        'success',
        `Downloaded ${manual.englishRoleLabel} User Manual (${lang === 'ml' ? 'Malayalam' : 'English'} PDF: ${manual.pdfFilename}) successfully.`
      );
    } else {
      showToast(
        'error',
        'Unable to generate the PDF manual right now. Please try again.'
      );
    }
  };

  const handleDownloadAllFourPdfs = async (lang: ManualLanguage) => {
    if (downloadingToken || batchProgress) return;
    const manuals = getUserManualsByLanguage(lang);
    const editionName = lang === 'ml' ? 'Malayalam' : 'English';
    const ok = await downloadAllFourUserManualPdfs(
      businessName,
      businessPhone,
      (idx, key) => {
        const m = manuals[key];
        setBatchProgress(
          `Generating ${editionName} PDF ${idx} of 4: ${m.englishRoleLabel} Manual...`
        );
      },
      lang
    );
    setBatchProgress('');
    if (ok) {
      showToast(
        'success',
        `Downloaded all 4 official ${editionName} User Manual PDFs (Owner, Manager, Accountant & Staff).`
      );
    } else {
      showToast('error', 'Could not complete the batch PDF download. Please try again.');
    }
  };

  const showAllFourGrid = visibleManualKeys.length === 4;

  return (
    <div
      style={{
        fontFamily: UI_FONT_FAMILY,
        maxWidth: '1160px',
        margin: '0 auto',
        paddingBottom: '2.5rem'
      }}
    >
      {/* Clean Page Header (100% English App Chrome + Bilingual Manual Edition Controls) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1.25rem',
          flexWrap: 'wrap',
          marginBottom: '1.35rem',
          paddingBottom: '1.25rem',
          borderBottom: '1px solid #e2e8f0'
        }}
      >
        <div style={{ maxWidth: '720px' }}>
          <div
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              color: '#64748b',
              marginBottom: '0.3rem'
            }}
          >
            {businessName} &middot; Outdoor Catering &bull; Event Management &bull; Calicut
          </div>
          <h1
            style={{
              fontSize: 'clamp(1.45rem, 2.4vw, 1.95rem)',
              fontWeight: 800,
              color: '#0f172a',
              margin: 0,
              lineHeight: 1.25,
              textWrap: 'balance'
            }}
          >
            Official Role-Based User Manuals (English &amp; Malayalam PDFs)
          </h1>
          <p
            style={{
              fontSize: '0.9rem',
              color: '#475569',
              marginTop: '0.45rem',
              lineHeight: 1.65,
              marginBottom: 0
            }}
          >
            {showAllFourGrid
              ? 'Download the revised A4 PDF User Manuals in both English and Malayalam for Owner, Manager, Accountant, and Staff—covering historical stock & menu price locks, mandatory quotation Labour Charges, shift rate switching, and full database backup & restore.'
              : 'Download your official step-by-step A4 PDF User Manual in either English or Malayalam with complete instructions for every workflow in your workspace.'}
          </p>
        </div>

        {/* Language Edition Switcher + Batch Download */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '0.65rem'
          }}
        >
          <div
            role="tablist"
            aria-label="Select User Manual Language Edition"
            style={{
              display: 'inline-flex',
              padding: '0.28rem',
              borderRadius: '10px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              gap: '0.25rem'
            }}
          >
            {(
              [
                { id: 'en' as const, label: 'English Edition' },
                { id: 'ml' as const, label: 'Malayalam Edition' }
              ] as const
            ).map((tab) => {
              const active = selectedLanguage === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedLanguage(tab.id)}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '7px',
                    border: 'none',
                    background: active ? '#0f172a' : 'transparent',
                    color: active ? '#ffffff' : '#334155',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'background 0.15s ease, color 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {showAllFourGrid && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handleDownloadAllFourPdfs('en')}
                disabled={Boolean(downloadingToken || batchProgress)}
                className="btn btn-primary"
                style={{
                  whiteSpace: 'nowrap',
                  padding: '0.58rem 0.95rem',
                  fontSize: '0.81rem',
                  fontWeight: 700,
                  borderRadius: '9px'
                }}
              >
                {batchProgress && batchProgress.includes('English')
                  ? batchProgress
                  : 'Download All 4 English PDFs'}
              </button>
              <button
                type="button"
                onClick={() => handleDownloadAllFourPdfs('ml')}
                disabled={Boolean(downloadingToken || batchProgress)}
                className="btn btn-secondary"
                style={{
                  whiteSpace: 'nowrap',
                  padding: '0.58rem 0.95rem',
                  fontSize: '0.81rem',
                  fontWeight: 700,
                  borderRadius: '9px',
                  borderColor: '#94a3b8',
                  color: '#0f172a',
                  background: '#ffffff'
                }}
              >
                {batchProgress && batchProgress.includes('Malayalam')
                  ? batchProgress
                  : 'Download All 4 Malayalam PDFs'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Download Confirmation Banner */}
      {statusBanner && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            border: `1px solid ${statusBanner.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            background: statusBanner.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: statusBanner.type === 'success' ? '#166534' : '#991b1b',
            fontSize: '0.86rem',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem'
          }}
        >
          <span>{statusBanner.text}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.9rem'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Role-Based Bilingual PDF Download Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            visibleManualKeys.length === 1
              ? 'minmax(280px, 580px)'
              : 'repeat(auto-fit, minmax(275px, 1fr))',
          gap: '1.15rem'
        }}
      >
        {visibleManualKeys.map((roleKey, idx) => {
          const m = activeManualsMap[roleKey];
          const enManual = ENGLISH_USER_MANUALS[roleKey];
          const mlManual = MALAYALAM_EDITION_USER_MANUALS[roleKey];
          const surface = ROLE_CARD_SURFACES[roleKey];
          const chapters = m.pages.flatMap((p) => p.chapters);
          const isBusyEn = downloadingToken === `${roleKey}:en`;
          const isBusyMl = downloadingToken === `${roleKey}:ml`;
          const anyBusy = Boolean(downloadingToken || batchProgress);

          return (
            <div
              key={roleKey}
              style={{
                background: surface.gradient,
                border: `1px solid ${surface.border}`,
                borderTop: `4px solid ${m.accentColor}`,
                borderRadius: '14px',
                padding: '1.35rem 1.35rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.1rem',
                boxShadow: '0 4px 14px -4px rgba(15, 23, 42, 0.06)'
              }}
            >
              <div style={{ fontFamily: MANUAL_CONTENT_FONT_FAMILY }}>
                <div
                  className="tabular-nums"
                  style={{
                    fontFamily: UI_FONT_FAMILY,
                    fontSize: '0.75rem',
                    color: '#64748b',
                    marginBottom: '0.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <span style={{ fontWeight: 800, color: m.accentColor }}>
                    0{idx + 1}. {m.englishRoleLabel}
                  </span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{m.pages.length} A4 Pages</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{chapters.length} Chapters</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{selectedLanguage === 'ml' ? 'Malayalam Preview' : 'English Preview'}</span>
                </div>

                <h2
                  style={{
                    fontSize: selectedLanguage === 'ml' ? '1.14rem' : '1.2rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    margin: '0 0 0.4rem 0',
                    lineHeight: 1.4
                  }}
                >
                  {m.titleMl}
                </h2>

                <p
                  style={{
                    fontSize: selectedLanguage === 'ml' ? '0.81rem' : '0.83rem',
                    color: '#475569',
                    lineHeight: selectedLanguage === 'ml' ? 1.68 : 1.6,
                    margin: '0 0 0.9rem 0'
                  }}
                >
                  {m.subtitleMl}
                </p>

                {/* Concise Table of Contents Preview in Selected Language */}
                <div
                  style={{
                    paddingTop: '0.8rem',
                    borderTop: '1px solid rgba(15, 23, 42, 0.07)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.34rem'
                  }}
                >
                  <div
                    style={{
                      fontFamily: UI_FONT_FAMILY,
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: '#334155',
                      marginBottom: '0.15rem'
                    }}
                  >
                    Included Chapters ({selectedLanguage === 'ml' ? 'Malayalam Edition' : 'English Edition'}):
                  </div>
                  {chapters.map((ch) => (
                    <div
                      key={ch.number}
                      style={{
                        fontSize: selectedLanguage === 'ml' ? '0.77rem' : '0.78rem',
                        color: '#475569',
                        lineHeight: selectedLanguage === 'ml' ? 1.58 : 1.48
                      }}
                    >
                      <strong
                        className="tabular-nums"
                        style={{ color: m.accentColor, marginRight: '0.35rem' }}
                      >
                        {ch.number}.
                      </strong>
                      {ch.titleMl}
                    </div>
                  ))}
                </div>
              </div>

              {/* Dual Direct Download Buttons (English PDF + Malayalam PDF) */}
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid rgba(15, 23, 42, 0.07)' }}>
                <div
                  style={{
                    fontSize: '0.71rem',
                    color: '#64748b',
                    marginBottom: '0.6rem',
                    lineHeight: 1.45
                  }}
                >
                  <div>EN File: {enManual.pdfFilename}</div>
                  <div>ML File: {mlManual.pdfFilename}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadSinglePdf(roleKey, 'en')}
                    disabled={anyBusy}
                    style={{
                      width: '100%',
                      background: isBusyEn ? '#64748b' : surface.buttonBg,
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      padding: '0.64rem 0.95rem',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: anyBusy ? 'wait' : 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 10px -2px rgba(15, 23, 42, 0.16)'
                    }}
                  >
                    {isBusyEn ? 'Generating English PDF...' : 'Download English PDF'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadSinglePdf(roleKey, 'ml')}
                    disabled={anyBusy}
                    style={{
                      width: '100%',
                      background: isBusyMl ? '#e2e8f0' : '#ffffff',
                      color: m.accentColor,
                      border: `1.5px solid ${m.accentColor}`,
                      borderRadius: '10px',
                      padding: '0.6rem 0.95rem',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: anyBusy ? 'wait' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isBusyMl ? 'Generating Malayalam PDF...' : 'Download Malayalam PDF'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
