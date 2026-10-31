'use client';

import React, { useEffect, useRef, useState } from 'react';
import { UserRole } from '@/lib/types';
import {
  BackupReminderStatus,
  DatabaseBackupPreview,
  store
} from '@/lib/store';
import {
  CsvExportSection,
  downloadDatabaseAsCsv,
  downloadDatabaseAsExcel
} from '@/lib/exportDatabase';

interface OwnerDatabaseExportCardProps {
  role: UserRole;
  compact?: boolean;
}

function formatBackupDateTime(iso: string | null): string {
  if (!iso) return 'Never downloaded';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function OwnerDatabaseExportCard({
  role,
  compact = false
}: OwnerDatabaseExportCardProps) {
  const [backupStatus, setBackupStatus] = useState<BackupReminderStatus>(() =>
    store.getBackupReminderStatus()
  );
  const [csvSection, setCsvSection] = useState<CsvExportSection>('all');
  const [exportingType, setExportingType] = useState<'json' | 'excel' | 'csv' | null>(null);
  const [showRestorePanel, setShowRestorePanel] = useState(!compact);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [rawBackupJson, setRawBackupJson] = useState<string | null>(null);
  const [backupPreview, setBackupPreview] = useState<DatabaseBackupPreview | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => {
      setBackupStatus(store.getBackupReminderStatus());
    };
    sync();
    const unsub = store.subscribe(sync);
    return unsub;
  }, []);

  // Strictly visible & operable by Owner & Super Admin ONLY
  if (role !== 'owner' && role !== 'super_admin') {
    return null;
  }

  const handleJsonBackupDownload = async () => {
    setExportingType('json');
    setFeedback(null);
    try {
      const res = await store.downloadFullDatabaseBackupJson();
      setBackupStatus(store.getBackupReminderStatus());
      setFeedback({
        type: 'success',
        text: `Full restorable database backup (${res.filename}) downloaded! Next 15-day reminder reset.`
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Could not generate full JSON backup file.'
      });
    } finally {
      setExportingType(null);
    }
  };

  const handleExcelDownload = async () => {
    setExportingType('excel');
    setFeedback(null);
    try {
      await downloadDatabaseAsExcel();
      setBackupStatus(store.getBackupReminderStatus());
      setFeedback({
        type: 'success',
        text: 'Excel workbook (.xlsx) downloaded with all 13 database sheets!'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Could not generate Excel file.'
      });
    } finally {
      setExportingType(null);
    }
  };

  const handleCsvDownload = async () => {
    setExportingType('csv');
    setFeedback(null);
    try {
      await downloadDatabaseAsCsv(csvSection);
      setBackupStatus(store.getBackupReminderStatus());
      setFeedback({
        type: 'success',
        text: 'CSV database export (.csv) downloaded!'
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Could not generate CSV file.'
      });
    } finally {
      setExportingType(null);
    }
  };

  const handleBackupFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    setSelectedFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const preview = store.previewDatabaseBackupPayload(content);
      setBackupPreview(preview);
      if (preview.valid) {
        setRawBackupJson(content);
      } else {
        setRawBackupJson(null);
        setFeedback({
          type: 'error',
          text: preview.error || 'Invalid backup file selected.'
        });
      }
    };
    reader.onerror = () => {
      setRawBackupJson(null);
      setBackupPreview(null);
      setFeedback({
        type: 'error',
        text: 'Could not read the selected backup file.'
      });
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = async () => {
    if (!rawBackupJson || !backupPreview?.valid) return;
    setIsRestoring(true);
    setFeedback(null);
    try {
      const res = await store.restoreFullDatabaseBackup(rawBackupJson);
      if (!res.success) {
        setFeedback({
          type: 'error',
          text: res.error || 'Database restore encountered an error.'
        });
      } else {
        setFeedback({
          type: 'success',
          text:
            res.restoredSummary ||
            `Database restored! (${backupPreview.counts.clients} clients, ${backupPreview.counts.events} events, ${backupPreview.counts.invoices} invoices, ${backupPreview.counts.staff} staff) synced back to the application and cloud database.`
        });
        setRawBackupJson(null);
        setBackupPreview(null);
        setSelectedFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Unexpected error while restoring database.'
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const clearPendingRestore = () => {
    setRawBackupJson(null);
    setBackupPreview(null);
    setSelectedFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderScheduleBanner = () => {
    const daysSince = backupStatus.daysSinceBackup ?? 0;
    const daysUntilNext = Math.max(1, backupStatus.intervalDays - daysSince);
    return (
      <div
        style={{
          padding: '0.65rem 0.85rem',
          borderRadius: '8px',
          marginBottom: '0.9rem',
          background: backupStatus.isDue ? '#fffbeb' : '#f0fdf4',
          border: `1px solid ${backupStatus.isDue ? '#fcd34d' : '#bbf7d0'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          fontSize: '0.8rem'
        }}
      >
        <div style={{ color: backupStatus.isDue ? '#92400e' : '#166534' }}>
          <strong style={{ fontWeight: 800 }}>
            {backupStatus.isDue
              ? '15-Day Database Backup Due: '
              : '15-Day Backup Schedule Active: '}
          </strong>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {backupStatus.lastBackupAt
              ? `Last downloaded ${formatBackupDateTime(backupStatus.lastBackupAt)} (${daysSince} day${daysSince === 1 ? '' : 's'} ago)`
              : 'Full database backup has not been downloaded yet'}
            {!backupStatus.isDue && backupStatus.nextDueAt
              ? ` · Next reminder in ${daysUntilNext} day${daysUntilNext === 1 ? '' : 's'}`
              : ' · Notification remains active until downloaded'}
          </span>
        </div>
      </div>
    );
  };

  const renderRestoreBlock = () => (
    <div
      style={{
        marginTop: '1rem',
        paddingTop: '1rem',
        borderTop: '1px solid #fecdd3'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: '0.4rem'
        }}
      >
        <h3 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          🔄 Restore Full Database from Backup File (.json)
        </h3>
        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
          Recovers 100% of records after a reset
        </span>
      </div>
      <p style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '0.75rem', lineHeight: 1.5 }}>
        If the application or database is ever reset, upload a previously downloaded{' '}
        <strong>IPPAS_Full_Database_Backup_*.json</strong> file below to restore all clients, menus,
        recipes, stock, bookings, quotations, invoices, payments, staff, shifts, and salaries.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleBackupFileSelected}
          style={{ fontSize: '0.8rem', maxWidth: '100%' }}
        />
        {selectedFileName && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={clearPendingRestore}
            disabled={isRestoring}
            style={{ whiteSpace: 'nowrap' }}
          >
            Clear File
          </button>
        )}
      </div>

      {backupPreview?.valid && (
        <div
          style={{
            marginTop: '0.85rem',
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            background: '#ffffff',
            border: '1px solid #cbd5e1'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '0.6rem'
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.86rem', color: '#0f172a' }}>
                Ready to Restore: {backupPreview.businessName || 'IPPAS Backup'}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#64748b',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                Exported: {formatBackupDateTime(backupPreview.exportedAt || null)} &middot;{' '}
                {Object.values(backupPreview.counts).reduce((sum, n) => sum + n, 0)} Core Records
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 800, whiteSpace: 'nowrap' }}
              disabled={isRestoring}
              onClick={handleConfirmRestore}
            >
              {isRestoring
                ? 'Restoring Full Database...'
                : 'Confirm & Restore Full Database'}
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '0.45rem',
              fontSize: '0.76rem',
              color: '#334155',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            <div>Clients: <strong>{backupPreview.counts.clients}</strong></div>
            <div>Events: <strong>{backupPreview.counts.events}</strong></div>
            <div>Invoices: <strong>{backupPreview.counts.invoices}</strong></div>
            <div>Payments: <strong>{backupPreview.counts.payments}</strong></div>
            <div>Menu Items: <strong>{backupPreview.counts.menuItems}</strong></div>
            <div>Stock Items: <strong>{backupPreview.counts.ingredients}</strong></div>
            <div>Purchases: <strong>{backupPreview.counts.stockPurchases}</strong></div>
            <div>Staff: <strong>{backupPreview.counts.staff}</strong></div>
            <div>Shifts: <strong>{backupPreview.counts.shifts}</strong></div>
            <div>Salary Entries: <strong>{backupPreview.counts.salaryRecords}</strong></div>
          </div>
        </div>
      )}
    </div>
  );

  if (compact) {
    return (
      <div
        className="card"
        style={{
          marginBottom: '1.5rem',
          border: '1px solid #fecdd3',
          background: '#fffafb'
        }}
      >
        {renderScheduleBanner()}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 className="card-title" style={{ margin: 0 }}>
                💾 Owner Full Database Backup &amp; Restore
              </h2>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#be123c'
                }}
              >
                &middot; Owner Exclusive
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Download a full restorable snapshot (.json) or spreadsheet (.xlsx / .csv), or upload a backup file to restore data after any reset.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
              disabled={exportingType !== null || isRestoring}
              onClick={handleJsonBackupDownload}
            >
              {exportingType === 'json'
                ? 'Preparing Backup...'
                : '💾 Download Full Backup (.json)'}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
              disabled={exportingType !== null || isRestoring}
              onClick={handleExcelDownload}
            >
              {exportingType === 'excel' ? 'Preparing Excel...' : '📊 Excel (.xlsx)'}
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
              disabled={isRestoring}
              onClick={() => setShowRestorePanel((prev) => !prev)}
            >
              {showRestorePanel ? 'Hide Restore' : '🔄 Restore Backup'}
            </button>
          </div>
        </div>

        {showRestorePanel && renderRestoreBlock()}

        {feedback && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.55rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: feedback.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: feedback.type === 'success' ? '#15803d' : '#991b1b'
            }}
          >
            {feedback.text}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        marginBottom: '1.25rem',
        border: '1px solid #fecdd3',
        background: '#fffafb'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.65rem',
          flexWrap: 'wrap',
          gap: '0.4rem'
        }}
      >
        <h2 className="card-title" style={{ margin: 0 }}>
          💾 Full Database Backup &amp; Restore Center
        </h2>
        <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#be123c' }}>
          Owner Exclusive &middot; 15-Day Auto Reminder
        </span>
      </div>

      {renderScheduleBanner()}

      <p style={{ fontSize: '0.84rem', color: '#475569', marginBottom: '0.9rem', lineHeight: 1.5 }}>
        Download a complete restorable snapshot (<strong>.json</strong>) or formatted financial spreadsheets (<strong>.xlsx</strong> / <strong>.csv</strong>) containing all clients, bookings, menus, stock, invoices, payments, staff salaries, advances, and team accounts.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ fontWeight: 800, justifyContent: 'center', whiteSpace: 'nowrap' }}
            disabled={exportingType !== null || isRestoring}
            onClick={handleJsonBackupDownload}
          >
            {exportingType === 'json'
              ? 'Syncing & Building Backup...'
              : '💾 Download Full Restorable Backup (.json)'}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontWeight: 700, justifyContent: 'center', whiteSpace: 'nowrap' }}
            disabled={exportingType !== null || isRestoring}
            onClick={handleExcelDownload}
          >
            {exportingType === 'excel'
              ? 'Generating Excel Workbook...'
              : '📊 Download Full Excel (.xlsx)'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            className="form-control"
            style={{ flex: 1, minWidth: '180px', fontSize: '0.84rem' }}
            value={csvSection}
            onChange={(e) => setCsvSection(e.target.value as CsvExportSection)}
          >
            <option value="all">Complete Database (All Tables CSV)</option>
            <option value="treasury_accounts">Bank vs Cash Account Holdings CSV</option>
            <option value="invoice_payments">Invoice Payment Receipts CSV</option>
            <option value="invoices">Invoices Summary CSV</option>
            <option value="staff_attendance">Staff Attendance Register CSV</option>
            <option value="staff_salary">Staff Salary, Advances &amp; Balances CSV</option>
            <option value="events">Events &amp; Bookings CSV</option>
            <option value="clients">Clients Directory CSV</option>
            <option value="stock_purchases">Stock Purchases &amp; Vendor Dues CSV</option>
            <option value="inventory_menu">Warehouse Stock &amp; Menu CSV</option>
          </select>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
            disabled={exportingType !== null || isRestoring}
            onClick={handleCsvDownload}
          >
            {exportingType === 'csv' ? 'Exporting...' : '📄 Download CSV (.csv)'}
          </button>
        </div>
      </div>

      {renderRestoreBlock()}

      {feedback && (
        <div
          style={{
            marginTop: '0.85rem',
            padding: '0.6rem 0.8rem',
            borderRadius: '6px',
            fontSize: '0.82rem',
            fontWeight: 600,
            background: feedback.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: feedback.type === 'success' ? '#15803d' : '#991b1b'
          }}
        >
          {feedback.text}
        </div>
      )}
    </div>
  );
}
