'use client';

import React, { useState } from 'react';
import { UserRole } from '@/lib/types';
import {
  CsvExportSection,
  downloadDatabaseAsCsv,
  downloadDatabaseAsExcel
} from '@/lib/exportDatabase';

interface OwnerDatabaseExportCardProps {
  role: UserRole;
  compact?: boolean;
}

export default function OwnerDatabaseExportCard({
  role,
  compact = false
}: OwnerDatabaseExportCardProps) {
  const [csvSection, setCsvSection] = useState<CsvExportSection>('all');
  const [exportingType, setExportingType] = useState<'excel' | 'csv' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Strictly visible & operable by Owner & Super Admin ONLY
  if (role !== 'owner' && role !== 'super_admin') {
    return null;
  }

  const handleExcelDownload = async () => {
    setExportingType('excel');
    setFeedback(null);
    try {
      await downloadDatabaseAsExcel();
      setFeedback({
        type: 'success',
        text: 'Excel workbook (.xlsx) downloaded with all 13 database sheets!'
      });
      setTimeout(() => setFeedback(null), 4500);
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
      setFeedback({
        type: 'success',
        text: 'CSV database export (.csv) downloaded!'
      });
      setTimeout(() => setFeedback(null), 4500);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Could not generate CSV file.'
      });
    } finally {
      setExportingType(null);
    }
  };

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
                📥 Owner Database Export (Excel &amp; CSV)
              </h2>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: '#be123c',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px'
                }}
              >
                &bull; Owner Only
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Download complete live SQL &amp; app records — Bank/Cash accounts, invoices, events, staff attendance, salaries, and stock.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ fontWeight: 700 }}
              disabled={exportingType !== null}
              onClick={handleExcelDownload}
            >
              {exportingType === 'excel' ? 'Preparing Excel...' : '📊 Download Excel (.xlsx)'}
            </button>

            <select
              className="form-control"
              style={{ width: 'auto', minWidth: '175px', padding: '0.32rem 0.6rem', fontSize: '0.8rem' }}
              value={csvSection}
              onChange={(e) => setCsvSection(e.target.value as CsvExportSection)}
            >
              <option value="all">Full Database (All Tables)</option>
              <option value="treasury_accounts">Bank vs Cash Holdings</option>
              <option value="invoice_payments">Invoice Payment Receipts</option>
              <option value="invoices">All Invoices</option>
              <option value="staff_attendance">Staff Attendance Register</option>
              <option value="staff_salary">Staff Salaries &amp; Balances</option>
              <option value="events">Events &amp; Bookings</option>
              <option value="clients">Clients Directory</option>
              <option value="stock_purchases">Stock Purchases &amp; Dues</option>
              <option value="inventory_menu">Inventory &amp; Menu</option>
            </select>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontWeight: 700 }}
              disabled={exportingType !== null}
              onClick={handleCsvDownload}
            >
              {exportingType === 'csv' ? 'Preparing CSV...' : '📄 Download CSV (.csv)'}
            </button>
          </div>
        </div>

        {feedback && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.5rem 0.75rem',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
        <h2 className="card-title" style={{ margin: 0 }}>
          📥 Owner Database Download (Excel / CSV)
        </h2>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#be123c', textTransform: 'uppercase' }}>
          Owner Exclusive
        </span>
      </div>

      <p style={{ fontSize: '0.84rem', color: '#475569', marginBottom: '0.9rem', lineHeight: 1.5 }}>
        Export the complete up-to-date database (Bank &amp; Cash account holdings, invoices, client receipts, events, quotations, staff attendance, salary balances, stock, and audit logs). Hidden from Managers, Accountants, and Staff.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%', fontWeight: 700, justifyContent: 'center' }}
          disabled={exportingType !== null}
          onClick={handleExcelDownload}
        >
          {exportingType === 'excel'
            ? 'Syncing & Generating Excel Workbook...'
            : '📊 Download Full Database as Excel (.xlsx)'}
        </button>

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
            <option value="staff_salary">Staff Salary &amp; Balances CSV</option>
            <option value="events">Events &amp; Bookings CSV</option>
            <option value="clients">Clients Directory CSV</option>
            <option value="stock_purchases">Stock Purchases &amp; Vendor Dues CSV</option>
            <option value="inventory_menu">Warehouse Stock &amp; Menu CSV</option>
          </select>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontWeight: 700 }}
            disabled={exportingType !== null}
            onClick={handleCsvDownload}
          >
            {exportingType === 'csv' ? 'Exporting...' : '📄 Download CSV (.csv)'}
          </button>
        </div>
      </div>

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
