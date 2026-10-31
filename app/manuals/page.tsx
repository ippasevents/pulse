'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { store } from '@/lib/store';
import {
  MALAYALAM_USER_MANUALS,
  MANUAL_ROLE_ORDER,
  ManualRoleKey
} from '@/lib/userManualsMalayalam';
import {
  buildManualWhatsAppCaption,
  downloadAllFourUserManualPdfs,
  downloadRoleUserManualPdf,
  generateRoleUserManualPdfBlob,
  printRoleUserManual,
  shareRoleUserManualOnWhatsApp
} from '@/lib/userManualPdfGenerator';
import { isDesktopWebView, triggerPdfBlobDownload } from '@/lib/whatsappDeviceShare';

const ML_FONT_FAMILY = `'Noto Sans Malayalam', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif`;

export default function MalayalamUserManualsPage() {
  const [state, setState] = useState(store.getState());
  const [selectedRole, setSelectedRole] = useState<ManualRoleKey>('owner');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingKey, setDownloadingKey] = useState<ManualRoleKey | null>(null);
  const [sharingKey, setSharingKey] = useState<ManualRoleKey | null>(null);
  const [waModalRoleKey, setWaModalRoleKey] = useState<ManualRoleKey | null>(null);
  const [waPhoneInput, setWaPhoneInput] = useState('');
  const [waMessageText, setWaMessageText] = useState('');
  const [waPreparedPdf, setWaPreparedPdf] = useState<{ blob: Blob; file: File; filename: string } | null>(null);
  const [waPreparingPdf, setWaPreparingPdf] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [copiedKey, setCopiedKey] = useState<ManualRoleKey | null>(null);

  useEffect(() => {
    setIsDesktop(isDesktopWebView());
    const syncState = () => {
      setState(store.getState());
    };
    const unsub = store.subscribe(syncState);
    return unsub;
  }, []);

  // Map current authenticated session strictly into the 4 documented user roles
  const visibleManualKeys: ManualRoleKey[] = useMemo(() => {
    const r = state.currentRole;
    if (r === 'staff') return ['staff'];
    if (r === 'accountant') return ['accountant'];
    if (r === 'manager') return ['manager', 'staff'];
    return MANUAL_ROLE_ORDER;
  }, [state.currentRole]);

  useEffect(() => {
    if (!visibleManualKeys.includes(selectedRole)) {
      setSelectedRole(visibleManualKeys[0]);
    }
  }, [visibleManualKeys, selectedRole]);

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
      showToast('success', `${manual.titleMl} (${manual.pdfFilename}) വിജയകരമായി ഡൗൺലോഡ് ചെയ്തു.`);
    } else {
      showToast('error', 'PDF തയ്യാറാക്കുന്നതിൽ താൽക്കാലിക തടസ്സം നേരിട്ടു. വീണ്ടും ശ്രമിക്കുക.');
    }
  };

  const handleDownloadAllFourPdfs = async () => {
    if (downloadingKey || batchProgress) return;
    const ok = await downloadAllFourUserManualPdfs(
      businessName,
      businessPhone,
      (idx, key) => {
        const m = MALAYALAM_USER_MANUALS[key];
        setBatchProgress(`${idx} / 4 തയ്യാറാക്കുന്നു: ${m.titleMl}...`);
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

  const handlePrintManual = (key: ManualRoleKey) => {
    printRoleUserManual(key, businessName, businessPhone);
  };

  const handleShareWhatsApp = (key: ManualRoleKey) => {
    setWaModalRoleKey(key);
    setWaPhoneInput('');
    setWaMessageText(buildManualWhatsAppCaption(key, businessName));
    setWaPreparedPdf(null);
    setWaPreparingPdf(true);
    generateRoleUserManualPdfBlob(key, businessName, businessPhone)
      .then((res) => {
        setWaPreparedPdf(res);
        setWaPreparingPdf(false);
      })
      .catch(() => {
        setWaPreparingPdf(false);
      });
  };

  const handleConfirmSendManualWhatsApp = async () => {
    if (!waModalRoleKey || !waPreparedPdf || sharingKey) return;
    setSharingKey(waModalRoleKey);
    const manual = MALAYALAM_USER_MANUALS[waModalRoleKey];
    const outcome = await shareRoleUserManualOnWhatsApp({
      roleKey: waModalRoleKey,
      recipientPhone: waPhoneInput,
      businessName,
      businessPhone,
      prebuiltPdf: waPreparedPdf,
      customMessage: waMessageText
    });
    setSharingKey(null);
    if (outcome.success) {
      setWaModalRoleKey(null);
      showToast(
        'success',
        `${manual.titleMl} PDF ഫയലും സന്ദേശവും ഒരുമിച്ച് വാട്സാപ്പിലേക്ക് അയച്ചു.`
      );
    } else {
      showToast('error', outcome.error || 'വാട്സാപ്പ് ഷെയർ പൂർത്തിയാക്കാൻ സാധിച്ചില്ല.');
    }
  };

  const handleCopyCaptionDesktop = async (key: ManualRoleKey) => {
    try {
      const caption = buildManualWhatsAppCaption(key, businessName);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(caption);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2200);
      }
    } catch {
      // ignore clipboard errors
    }
  };

  const activeManual = MALAYALAM_USER_MANUALS[selectedRole] || MALAYALAM_USER_MANUALS.owner;
  const allChapters = useMemo(
    () => activeManual.pages.flatMap((p) => p.chapters),
    [activeManual]
  );

  const filteredChapters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allChapters;
    return allChapters.filter(
      (ch) =>
        ch.titleMl.toLowerCase().includes(q) ||
        ch.summaryMl.toLowerCase().includes(q) ||
        ch.menuLabel.toLowerCase().includes(q) ||
        ch.stepsMl.some((s) => s.toLowerCase().includes(q))
    );
  }, [allChapters, searchQuery]);

  const showAllFourGrid = visibleManualKeys.length === 4;

  return (
    <div style={{ fontFamily: ML_FONT_FAMILY, maxWidth: '1220px', margin: '0 auto', paddingBottom: '2.5rem' }}>
      {/* Top Header */}
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
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: '0.3rem' }}>
            {businessName} &middot; Outdoor Catering &bull; Event Management &bull; Calicut
          </div>
          <h1
            style={{
              fontSize: 'clamp(1.5rem, 2.5vw, 2rem)',
              fontWeight: 800,
              color: '#0f172a',
              margin: 0,
              lineHeight: 1.25,
              textWrap: 'balance'
            }}
          >
            മലയാളം യൂസർ മാനുവലുകൾ (PDF User Manuals)
          </h1>
          <p style={{ fontSize: '0.92rem', color: '#475569', marginTop: '0.45rem', lineHeight: 1.65, marginBottom: 0 }}>
            {showAllFourGrid
              ? 'ഓണർ, മാനേജർ, അക്കൗണ്ടന്റ്, സ്റ്റാഫ് എന്നീ 4 വിഭാഗം ഉപയോക്താക്കൾക്കുമുള്ള പ്രത്യേകം മലയാളം യൂസർ മാനുവലുകൾ ഇവിടെ വായിക്കാനും ഓരോന്നും വെവ്വേറെ A4 PDF ഫയലായി ഡൗൺലോഡ് ചെയ്യാനും സാധിക്കും.'
              : `${activeManual.titleMl} ഇവിടെ വായിക്കാനും ഔദ്യോഗിക A4 PDF ഫയലായി ഡൗൺലോഡ് ചെയ്യാനും സാധിക്കും.`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {showAllFourGrid ? (
            <button
              type="button"
              onClick={handleDownloadAllFourPdfs}
              disabled={Boolean(downloadingKey || batchProgress)}
              className="btn btn-primary"
              style={{
                whiteSpace: 'nowrap',
                padding: '0.65rem 1.15rem',
                fontSize: '0.86rem',
                fontWeight: 700,
                borderRadius: '8px'
              }}
            >
              {batchProgress || '⬇ 4 PDF-കളും വെവ്വേറെ ഡൗൺലോഡ് ചെയ്യുക'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleDownloadSinglePdf(activeManual.key)}
              disabled={Boolean(downloadingKey)}
              className="btn btn-primary"
              style={{
                whiteSpace: 'nowrap',
                padding: '0.65rem 1.15rem',
                fontSize: '0.86rem',
                fontWeight: 700,
                borderRadius: '8px'
              }}
            >
              {downloadingKey === activeManual.key
                ? 'PDF തയ്യാറാക്കുന്നു...'
                : `⬇ ${activeManual.titleMl} (PDF)`}
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {statusBanner && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
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

      {/* 4 Separate PDF Manual Cards */}
      {visibleManualKeys.length > 1 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(265px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}
        >
          {visibleManualKeys.map((roleKey, idx) => {
            const m = MALAYALAM_USER_MANUALS[roleKey];
            const isSelected = selectedRole === roleKey;
            const chapterCount = m.pages.reduce((sum, p) => sum + p.chapters.length, 0);
            const isBusy = downloadingKey === roleKey;
            const isSharing = sharingKey === roleKey;

            return (
              <div
                key={roleKey}
                style={{
                  background: '#ffffff',
                  border: isSelected ? `1.5px solid ${m.accentColor}` : '1px solid #e2e8f0',
                  borderTop: `4px solid ${m.accentColor}`,
                  borderRadius: '12px',
                  padding: '1.15rem 1.2rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.9rem',
                  boxShadow: isSelected ? '0 8px 20px -6px rgba(15, 23, 42, 0.1)' : '0 1px 3px rgba(15, 23, 42, 0.04)'
                }}
              >
                <div>
                  <div
                    className="tabular-nums"
                    style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                      marginBottom: '0.35rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span style={{ fontWeight: 700, color: m.accentColor }}>
                      0{idx + 1}. {m.englishRoleLabel}
                    </span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{m.pages.length} പേജുകൾ</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{chapterCount} അധ്യായങ്ങൾ</span>
                  </div>

                  <h2
                    style={{
                      fontSize: '1.12rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      margin: '0 0 0.35rem 0',
                      lineHeight: 1.35
                    }}
                  >
                    {m.titleMl}
                  </h2>

                  <p
                    style={{
                      fontSize: '0.81rem',
                      color: '#475569',
                      lineHeight: 1.6,
                      margin: 0
                    }}
                  >
                    {m.subtitleMl}
                  </p>
                </div>

                <div>
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
                    ഫയൽ: {m.pdfFilename}
                  </div>

                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleDownloadSinglePdf(roleKey)}
                      disabled={Boolean(downloadingKey || batchProgress)}
                      style={{
                        flex: 1,
                        background: '#0f172a',
                        color: '#ffffff',
                        border: '1px solid #0f172a',
                        borderRadius: '6px',
                        padding: '0.48rem 0.75rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isBusy ? 'തയ്യാറാക്കുന്നു...' : '⬇ PDF ഡൗൺലോഡ്'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedRole(roleKey)}
                      style={{
                        background: isSelected ? '#f1f5f9' : '#ffffff',
                        color: '#0f172a',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '0.48rem 0.7rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      വായിക്കുക
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.45rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handlePrintManual(roleKey)}
                      style={{
                        flex: 1,
                        background: '#ffffff',
                        color: '#334155',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '0.38rem 0.6rem',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      🖨 പ്രിന്റ്
                    </button>

                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(roleKey)}
                      disabled={Boolean(sharingKey)}
                      style={{
                        flex: 1,
                        background: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #6ee7b7',
                        borderRadius: '6px',
                        padding: '0.38rem 0.6rem',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {isSharing ? 'ഷെയർ ചെയ്യുന്നു...' : '💬 WA (PDF + Text)'}
                    </button>

                    {isDesktop && (
                      <button
                        type="button"
                        onClick={() => handleCopyCaptionDesktop(roleKey)}
                        style={{
                          background: '#ffffff',
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '0.38rem 0.6rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                        title="Copy WhatsApp message text (Desktop Web View)"
                      >
                        {copiedKey === roleKey ? '✓ Copied' : 'Copy Text'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Malayalam Manual Reader Section */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '1.5rem'
        }}
      >
        {/* Toolbar: Segmented Role Tabs + Search + Direct PDF Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            paddingBottom: '1.15rem',
            marginBottom: '1.35rem',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          {visibleManualKeys.length > 1 ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.25rem',
                background: '#f1f5f9',
                borderRadius: '8px',
                flexWrap: 'wrap'
              }}
            >
              {visibleManualKeys.map((key) => {
                const m = MALAYALAM_USER_MANUALS[key];
                const active = selectedRole === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedRole(key)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.83rem',
                      fontWeight: active ? 700 : 600,
                      borderRadius: '6px',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      background: active ? '#ffffff' : 'transparent',
                      color: active ? '#0f172a' : '#475569',
                      boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                      transition: 'background 0.15s ease, color 0.15s ease'
                    }}
                  >
                    {m.malayalamRoleName} ({m.englishRoleLabel})
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
              {activeManual.titleMl} ({activeManual.englishRoleLabel})
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap', flex: '1 1 280px', justifyContent: 'flex-end' }}>
            <input
              type="search"
              className="form-control"
              placeholder="അധ്യായം അല്ലെങ്കിൽ വിഷയം തിരയുക..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                maxWidth: '280px',
                padding: '0.45rem 0.75rem',
                fontSize: '0.84rem'
              }}
            />

            <button
              type="button"
              onClick={() => handlePrintManual(activeManual.key)}
              className="btn btn-secondary btn-sm"
              style={{ whiteSpace: 'nowrap', fontWeight: 600 }}
            >
              🖨 പ്രിന്റ് എടുക്കുക
            </button>

            <button
              type="button"
              onClick={() => handleShareWhatsApp(activeManual.key)}
              disabled={Boolean(sharingKey)}
              className="btn btn-secondary btn-sm"
              style={{
                whiteSpace: 'nowrap',
                fontWeight: 700,
                background: '#ecfdf5',
                color: '#047857',
                borderColor: '#6ee7b7'
              }}
            >
              {sharingKey === activeManual.key ? 'ഷെയർ ചെയ്യുന്നു...' : '💬 WhatsApp (PDF + Text)'}
            </button>

            <button
              type="button"
              onClick={() => handleDownloadSinglePdf(activeManual.key)}
              disabled={Boolean(downloadingKey || batchProgress)}
              className="btn btn-primary btn-sm"
              style={{ whiteSpace: 'nowrap', fontWeight: 700 }}
            >
              {downloadingKey === activeManual.key
                ? 'തയ്യാറാക്കുന്നു...'
                : `⬇ ${activeManual.malayalamRoleName} PDF ഡൗൺലോഡ്`}
            </button>
          </div>
        </div>

        {/* Manual Overview Header */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1.25rem 1.4rem',
            marginBottom: '1.5rem'
          }}
        >
          <div
            className="tabular-nums"
            style={{
              fontSize: '0.76rem',
              color: activeManual.accentColor,
              fontWeight: 700,
              marginBottom: '0.35rem'
            }}
          >
            {activeManual.docCode} &middot; {activeManual.pdfFilename}
          </div>
          <h2
            style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              color: '#0f172a',
              margin: '0 0 0.4rem 0'
            }}
          >
            {activeManual.titleMl}
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.65, margin: '0 0 0.85rem 0' }}>
            {activeManual.overviewMl}
          </p>

          <div style={{ paddingTop: '0.85rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.45rem' }}>
              ഉൾപ്പെടുത്തിയിട്ടുള്ള പ്രധാന മൊഡ്യൂളുകൾ:
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '0.35rem 1.25rem'
              }}
            >
              {activeManual.accessibleModulesMl.map((mod, idx) => (
                <div key={idx} style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.55 }}>
                  &bull; {mod}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chapters List */}
        {filteredChapters.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '2.5rem 1rem',
              color: '#64748b',
              border: '1px dashed #cbd5e1',
              borderRadius: '8px'
            }}
          >
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
              തിരയുന്ന വിഷയം കണ്ടെത്താനായില്ല
            </div>
            <div style={{ fontSize: '0.83rem', marginBottom: '0.85rem' }}>
              മറ്റൊരു വാക്ക് ഉപയോഗിച്ച് തിരയുക അല്ലെങ്കിൽ ഫിൽട്ടർ ഒഴിവാക്കുക.
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="btn btn-secondary btn-sm"
            >
              എല്ലാ അധ്യായങ്ങളും കാണിക്കുക
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {filteredChapters.map((chapter) => (
              <section
                key={chapter.number}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1.25rem 1.4rem',
                  background: '#ffffff'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                    paddingBottom: '0.65rem',
                    marginBottom: '0.75rem',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  <h3 style={{ fontSize: '1.08rem', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.4 }}>
                    <span
                      className="tabular-nums"
                      style={{ color: activeManual.accentColor, marginRight: '0.45rem' }}
                    >
                      {chapter.number}.
                    </span>
                    {chapter.titleMl}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                    മെനു: {chapter.menuLabel}
                  </span>
                </div>

                <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.65, margin: '0 0 0.9rem 0' }}>
                  {chapter.summaryMl}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {chapter.stepsMl.map((step, sIdx) => (
                    <div
                      key={sIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.7rem'
                      }}
                    >
                      <span
                        className="tabular-nums"
                        style={{
                          minWidth: '24px',
                          height: '24px',
                          borderRadius: '5px',
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          color: '#0f172a',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginTop: '2px'
                        }}
                      >
                        {sIdx + 1}
                      </span>
                      <div style={{ fontSize: '0.9rem', color: '#1e293b', lineHeight: 1.7, flex: 1 }}>
                        {step}
                      </div>
                    </div>
                  ))}
                </div>

                {chapter.importantNoteMl && (
                  <div
                    style={{
                      marginTop: '0.95rem',
                      padding: '0.75rem 0.95rem',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontSize: '0.84rem',
                      color: '#334155',
                      lineHeight: 1.65
                    }}
                  >
                    <strong style={{ color: '#0f172a' }}>ശ്രദ്ധിക്കുക:</strong> {chapter.importantNoteMl}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}

        {/* Best Practices Footer Section */}
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1.15rem 1.35rem',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px'
          }}
        >
          <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.65rem 0' }}>
            പ്രധാന ശ്രദ്ധിക്കേണ്ട കാര്യങ്ങൾ ({activeManual.malayalamRoleName})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {activeManual.bestPracticesMl.map((tip, idx) => (
              <div key={idx} style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.65 }}>
                &bull; {tip}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unified Malayalam Manual PDF + Text WhatsApp Modal */}
      {waModalRoleKey && (() => {
        const targetManual = MALAYALAM_USER_MANUALS[waModalRoleKey];
        return (
          <div className="modal-overlay" onClick={() => setWaModalRoleKey(null)}>
            <div
              className="modal-content"
              style={{ maxWidth: '540px', width: '96%', padding: 0, overflow: 'hidden' }}
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
                  <h2 style={{ fontSize: '1.08rem', fontWeight: 800, margin: 0 }}>
                    💬 WhatsApp-ലേക്ക് PDF + Text അയക്കുക
                  </h2>
                  <p style={{ fontSize: '0.78rem', opacity: 0.92, marginTop: '0.2rem' }}>
                    {targetManual.titleMl} ({targetManual.pdfFilename})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWaModalRoleKey(null)}
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

              <div style={{ padding: '1.25rem 1.35rem' }}>
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
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: '#065f46', fontSize: '0.9rem' }}>
                      📎 {targetManual.pdfFilename}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: '#047857', marginTop: '0.15rem' }}>
                      PDF ഫയലും മലയാളം വിവരണവും ഒരുമിച്ച് അറ്റാച്ച് ആകും
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: waPreparingPdf ? '#b45309' : '#065f46',
                      background: waPreparingPdf ? '#fef3c7' : '#d1fae5',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '6px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {waPreparingPdf ? '⏳ PDF തയ്യാറാക്കുന്നു...' : '✓ PDF + Text Ready'}
                  </span>
                </div>

                <div className="form-group" style={{ marginBottom: '0.9rem' }}>
                  <label className="form-label">WhatsApp നമ്പർ (Optional)</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="ഉദാ: +91 98470 11111"
                    value={waPhoneInput}
                    onChange={(e) => setWaPhoneInput(e.target.value)}
                  />
                </div>

                <div style={{ marginBottom: '1.1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                      PDF-നൊപ്പം ചേർക്കുന്ന സന്ദേശം:
                    </span>
                    {isDesktop && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCopyCaptionDesktop(waModalRoleKey)}
                        style={{ padding: '0.18rem 0.55rem', fontSize: '0.73rem' }}
                      >
                        {copiedKey === waModalRoleKey ? '✓ Copied' : '📋 Copy Text'}
                      </button>
                    )}
                  </div>
                  <textarea
                    className="form-control"
                    rows={5}
                    value={waMessageText}
                    onChange={(e) => setWaMessageText(e.target.value)}
                    style={{ fontSize: '0.82rem', lineHeight: 1.55, background: '#f8fafc' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <button
                    type="button"
                    disabled={waPreparingPdf || !waPreparedPdf || Boolean(sharingKey)}
                    onClick={handleConfirmSendManualWhatsApp}
                    style={{
                      width: '100%',
                      background: waPreparingPdf
                        ? '#94a3b8'
                        : 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
                      color: '#ffffff',
                      border: 'none',
                      fontWeight: 800,
                      padding: '0.85rem 1rem',
                      fontSize: '0.92rem',
                      borderRadius: '10px',
                      cursor: waPreparingPdf ? 'wait' : 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                    }}
                  >
                    {waPreparingPdf
                      ? '⏳ PDF തയ്യാറാക്കുന്നു...'
                      : '📲 WhatsApp-ലേക്ക് അയക്കുക (PDF + Text)'}
                  </button>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={waPreparingPdf || !waPreparedPdf}
                      onClick={() => {
                        if (waPreparedPdf) {
                          triggerPdfBlobDownload(waPreparedPdf.blob, waPreparedPdf.filename);
                        }
                      }}
                      style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600 }}
                    >
                      ⬇ PDF മാത്രം ഡൗൺലോഡ് ചെയ്യുക
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setWaModalRoleKey(null)}
                      style={{ fontSize: '0.82rem', fontWeight: 600 }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
