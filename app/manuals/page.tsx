'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { store } from '@/lib/store';
import {
  MALAYALAM_USER_MANUALS,
  MANUAL_ROLE_ORDER,
  ManualRoleKey
} from '@/lib/userManualsMalayalam';
import {
  downloadAllFourUserManualPdfs,
  downloadRoleUserManualPdf
} from '@/lib/userManualPdfGenerator';

const ML_FONT_FAMILY = `'Noto Sans Malayalam', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif`;

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

export default function MalayalamUserManualsPage() {
  const [state, setState] = useState(store.getState());
  const [downloadingKey, setDownloadingKey] = useState<ManualRoleKey | null>(null);
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

  const businessName = state.settings?.name || 'IPPAS FOOD SERVICE & EVENTS';
  const businessPhone = state.settings?.phone || '+91 98470 11111';

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusBanner({ type, text });
    setTimeout(() => {
      setStatusBanner((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const handleDownloadSinglePdf = async (key: ManualRoleKey) => {
    if (downloadingKey || batchProgress) return;
    setDownloadingKey(key);
    const manual = MALAYALAM_USER_MANUALS[key];
    const ok = await downloadRoleUserManualPdf(key, businessName, businessPhone);
    setDownloadingKey(null);
    if (ok) {
      showToast(
        'success',
        `${manual.titleMl} (${manual.pdfFilename}) വിജയകരമായി ഡൗൺലോഡ് ചെയ്തു.`
      );
    } else {
      showToast(
        'error',
        'PDF തയ്യാറാക്കുന്നതിൽ താൽക്കാലിക തടസ്സം നേരിട്ടു. ദയവായി വീണ്ടും ശ്രമിക്കുക.'
      );
    }
  };

  const handleDownloadAllFourPdfs = async () => {
    if (downloadingKey || batchProgress) return;
    const ok = await downloadAllFourUserManualPdfs(
      businessName,
      businessPhone,
      (idx, key) => {
        const m = MALAYALAM_USER_MANUALS[key];
        setBatchProgress(`${idx} / 4 PDF തയ്യാറാക്കുന്നു: ${m.titleMl}...`);
      }
    );
    setBatchProgress('');
    if (ok) {
      showToast(
        'success',
        'ഓണർ, മാനേജർ, അക്കൗണ്ടന്റ്, സ്റ്റാഫ് എന്നീ 4 മലയാളം യൂസർ മാനുവൽ PDF ഫയലുകളും വെവ്വേറെ ഡൗൺലോഡ് ചെയ്തു.'
      );
    } else {
      showToast('error', 'PDF ഡൗൺലോഡ് പൂർത്തിയാക്കാൻ സാധിച്ചില്ല. വീണ്ടും ശ്രമിക്കുക.');
    }
  };

  const showAllFourGrid = visibleManualKeys.length === 4;

  return (
    <div
      style={{
        fontFamily: ML_FONT_FAMILY,
        maxWidth: '1160px',
        margin: '0 auto',
        paddingBottom: '2.5rem'
      }}
    >
      {/* Clean Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1.25rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
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
            മലയാളം യൂസർ മാനുവലുകൾ (PDF Download)
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
              ? 'പുതിയ മാറ്റങ്ങൾ ഉൾപ്പെടുത്തി പുതുക്കിയ ഓണർ, മാനേജർ, അക്കൗണ്ടന്റ്, സ്റ്റാഫ് മലയാളം യൂസർ മാനുവലുകൾ ഇവിടെ നിന്ന് A4 PDF ഫയലുകളായി നേരിട്ട് ഡൗൺലോഡ് ചെയ്യാം.'
              : 'പുതിയ മാറ്റങ്ങൾ ഉൾപ്പെടുത്തി പുതുക്കിയ ഔദ്യോഗിക മലയാളം യൂസർ മാനുവൽ A4 PDF ഫയലായി ഇവിടെ നിന്ന് ഡൗൺലോഡ് ചെയ്യാം.'}
          </p>
        </div>

        {showAllFourGrid && (
          <button
            type="button"
            onClick={handleDownloadAllFourPdfs}
            disabled={Boolean(downloadingKey || batchProgress)}
            className="btn btn-primary"
            style={{
              whiteSpace: 'nowrap',
              padding: '0.68rem 1.2rem',
              fontSize: '0.86rem',
              fontWeight: 700,
              borderRadius: '10px'
            }}
          >
            {batchProgress || '⬇ 4 PDF-കളും ഒരുമിച്ച് ഡൗൺലോഡ് ചെയ്യുക'}
          </button>
        )}
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

      {/* Simplified PDF-Download-Only Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            visibleManualKeys.length === 1
              ? 'minmax(280px, 560px)'
              : 'repeat(auto-fit, minmax(270px, 1fr))',
          gap: '1.15rem'
        }}
      >
        {visibleManualKeys.map((roleKey, idx) => {
          const m = MALAYALAM_USER_MANUALS[roleKey];
          const surface = ROLE_CARD_SURFACES[roleKey];
          const chapters = m.pages.flatMap((p) => p.chapters);
          const isBusy = downloadingKey === roleKey;

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
              <div>
                <div
                  className="tabular-nums"
                  style={{
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
                  <span>{m.pages.length} A4 പേജുകൾ</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{chapters.length} അധ്യായങ്ങൾ</span>
                </div>

                <h2
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    margin: '0 0 0.4rem 0',
                    lineHeight: 1.35
                  }}
                >
                  {m.titleMl}
                </h2>

                <p
                  style={{
                    fontSize: '0.83rem',
                    color: '#475569',
                    lineHeight: 1.6,
                    margin: '0 0 0.9rem 0'
                  }}
                >
                  {m.subtitleMl}
                </p>

                {/* Concise Table of Contents Preview */}
                <div
                  style={{
                    paddingTop: '0.8rem',
                    borderTop: '1px solid rgba(15, 23, 42, 0.07)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.32rem'
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: '#334155',
                      marginBottom: '0.15rem'
                    }}
                  >
                    ഉൾപ്പെടുത്തിയിട്ടുള്ള അധ്യായങ്ങൾ:
                  </div>
                  {chapters.map((ch) => (
                    <div
                      key={ch.number}
                      style={{
                        fontSize: '0.78rem',
                        color: '#475569',
                        lineHeight: 1.48
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

              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid rgba(15, 23, 42, 0.07)' }}>
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: '#64748b',
                    marginBottom: '0.65rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={m.pdfFilename}
                >
                  PDF ഫയൽ: {m.pdfFilename}
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadSinglePdf(roleKey)}
                  disabled={Boolean(downloadingKey || batchProgress)}
                  style={{
                    width: '100%',
                    background: isBusy ? '#64748b' : surface.buttonBg,
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.68rem 1rem',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    cursor: isBusy ? 'wait' : 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 4px 10px -2px rgba(15, 23, 42, 0.16)',
                    transition: 'transform 0.15s ease, opacity 0.15s ease'
                  }}
                >
                  {isBusy ? '⏳ PDF തയ്യാറാക്കുന്നു...' : '⬇ PDF ഡൗൺലോഡ് ചെയ്യുക'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
