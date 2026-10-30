'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { store, EVENT_EXPENSE_CATEGORY_LABELS } from '@/lib/store';
import { EventRecord } from '@/lib/types';
import { printElementById, printHtmlDocument } from '@/lib/printDocument';
import { downloadElementAsPdf } from '@/lib/downloadPdf';

type PnlStatusScope = 'completed' | 'confirmed_completed' | 'all_active';

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function ProfitAndLossPage() {
  const router = useRouter();
  const [state, setState] = useState(store.getState());
  const [statusScope, setStatusScope] = useState<PnlStatusScope>('completed');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    setState(store.getState());
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const isOwnerOnly =
    state.currentRole === 'owner' || state.currentRole === 'super_admin';

  // Strict Owner-Only Enforcement: redirect Accountant, Manager & Staff immediately
  useEffect(() => {
    if (!isOwnerOnly) {
      router.replace('/dashboard');
    }
  }, [isOwnerOnly, router]);

  const applyDatePreset = (preset: 'this_month' | 'last_month' | 'this_year' | 'all') => {
    const now = new Date();
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    if (preset === 'this_month') {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      setStartDate(`${y}-${m}-01`);
      setEndDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
      return;
    }
    if (preset === 'last_month') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
      setStartDate(`${y}-${m}-01`);
      setEndDate(`${y}-${m}-${String(lastDay).padStart(2, '0')}`);
      return;
    }
    if (preset === 'this_year') {
      const y = now.getFullYear();
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
    }
  };

  const pnlRows = useMemo(() => {
    if (!isOwnerOnly) return [];
    const q = searchQuery.trim().toLowerCase();

    return state.events
      .filter((evt) => {
        if (evt.status === 'cancelled') return false;
        if (statusScope === 'completed' && evt.status !== 'completed') return false;
        if (
          statusScope === 'confirmed_completed' &&
          evt.status !== 'completed' &&
          evt.status !== 'confirmed'
        ) {
          return false;
        }
        if (startDate && evt.event_date < startDate) return false;
        if (endDate && evt.event_date > endDate) return false;

        if (q) {
          const client = state.clients.find((c) => c.id === evt.client_id);
          const hay = `${evt.title} ${evt.venue || ''} ${client?.name || ''} ${client?.company || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.event_date.localeCompare(a.event_date))
      .map((evt) => {
        const client = state.clients.find((c) => c.id === evt.client_id);
        const summary = store.getEventFinancialSummary(evt.id);
        return {
          event: evt,
          client,
          summary
        };
      });
  }, [
    isOwnerOnly,
    state.events,
    state.clients,
    state.invoices,
    state.payments,
    state.eventExpenses,
    state.shifts,
    state.staffSalaryRecords,
    state.eventItems,
    state.eventExtras,
    statusScope,
    startDate,
    endDate,
    searchQuery
  ]);

  // Never render any P&L markup to non-owner roles
  if (!isOwnerOnly) {
    return null;
  }

  const totals = pnlRows.reduce(
    (acc, row) => {
      acc.contractRevenue += row.summary.contractRevenue;
      acc.collectedRevenue += row.summary.collectedRevenue;
      acc.pendingReceivable += row.summary.pendingReceivable;
      acc.stockPricingCost += row.summary.stockPricingCost;
      acc.extrasTakenCost += row.summary.extrasTakenCost;
      acc.staffShiftWages += row.summary.staffShiftWages;
      acc.staffAllowances += row.summary.staffAllowances;
      acc.staffExpenseCost += row.summary.staffExpenseCost;
      acc.totalStaffCost += row.summary.totalStaffCost;
      acc.otherExpenseCost += row.summary.otherExpenseCost;
      acc.totalExpenditure += row.summary.totalExpenditure;
      acc.netProfit += row.summary.netProfit;
      if (row.summary.netProfit >= 0) acc.profitableCount += 1;
      else acc.lossCount += 1;
      return acc;
    },
    {
      contractRevenue: 0,
      collectedRevenue: 0,
      pendingReceivable: 0,
      stockPricingCost: 0,
      extrasTakenCost: 0,
      staffShiftWages: 0,
      staffAllowances: 0,
      staffExpenseCost: 0,
      totalStaffCost: 0,
      otherExpenseCost: 0,
      totalExpenditure: 0,
      netProfit: 0,
      profitableCount: 0,
      lossCount: 0
    }
  );

  const overallMarginPercent =
    totals.contractRevenue > 0
      ? Number(((totals.netProfit / totals.contractRevenue) * 100).toFixed(1))
      : 0;

  const handlePrintSingleEventPnl = (evt: EventRecord) => {
    const client = state.clients.find((c) => c.id === evt.client_id);
    const fin = store.getEventFinancialSummary(evt.id);
    const quoteNo = store.getQuotationNumber(evt);
    const isProfit = fin.netProfit >= 0;

    const expenseRowsHtml =
      fin.expenses.length === 0
        ? `<tr><td colspan="4" style="padding:8px 10px;color:#64748b;text-align:center;">No manual extra expense entries logged yet.</td></tr>`
        : fin.expenses
            .map((ex) => {
              const cat = EVENT_EXPENSE_CATEGORY_LABELS[ex.category];
              return `<tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:7px 10px;font-weight:600;">${escapeHtml(cat.short)} <span style="color:#64748b;font-weight:500;font-size:11px;">(${escapeHtml(cat.ml)})</span></td>
                <td style="padding:7px 10px;">${escapeHtml(ex.description)}${ex.notes ? `<div style="font-size:11px;color:#64748b;">${escapeHtml(ex.notes)}</div>` : ''}</td>
                <td style="padding:7px 10px;text-align:center;">${escapeHtml(ex.expense_date)}</td>
                <td style="padding:7px 10px;text-align:right;font-weight:700;">₹${ex.amount.toLocaleString('en-IN')}</td>
              </tr>`;
            })
            .join('');

    const html = `
      <div style="width:194mm;margin:0 auto;padding:8mm 10mm;background:#ffffff;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <img src="/logo.png" alt="Logo" style="height:48px;width:auto;object-fit:contain;" />
            <div>
              <div style="font-weight:800;font-size:18px;color:#0f172a;">${escapeHtml(state.settings.name)}</div>
              <div style="font-size:12px;color:#64748b;">Confidential Owner Profit &amp; Loss Statement</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:22px;font-weight:800;color:#0f172a;">Event P&amp;L Report</div>
            <div style="font-size:12px;color:#be123c;font-weight:700;">OWNER CONFIDENTIAL</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:12px;background:#f8fafc;border:1px solid #cbd5e1;border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:13px;">
          <div>
            <div>Event: <strong>${escapeHtml(evt.title)}</strong></div>
            <div>Client: <strong>${escapeHtml(client?.name || 'Client')}</strong></div>
            <div>Venue: <strong>${escapeHtml(evt.venue || 'TBD')}</strong> &bull; Guests: <strong>${evt.guest_count} Pax</strong></div>
          </div>
          <div style="text-align:right;">
            <div>Event Date: <strong>${escapeHtml(evt.event_date)}</strong></div>
            <div>Status: <strong style="text-transform:uppercase;">${escapeHtml(evt.status)}</strong></div>
            <div>Quote Ref: <strong>#${escapeHtml(quoteNo)}</strong></div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:10px 12px;background:#f8fafc;">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Contract / Invoiced Revenue</div>
            <div style="font-size:19px;font-weight:800;color:#0f172a;margin-top:3px;">₹${fin.contractRevenue.toLocaleString('en-IN')}</div>
            <div style="font-size:11px;color:#475569;">Collected: ₹${fin.collectedRevenue.toLocaleString('en-IN')}</div>
          </div>
          <div style="border:1px solid #fecaca;border-radius:6px;padding:10px 12px;background:#fff1f2;">
            <div style="font-size:11px;color:#9f1239;text-transform:uppercase;font-weight:700;">Total Expenditure (incl. Allowances)</div>
            <div style="font-size:19px;font-weight:800;color:#be123c;margin-top:3px;">₹${fin.totalExpenditure.toLocaleString('en-IN')}</div>
            <div style="font-size:11px;color:#881337;">Shifts + Allowances + 4 Expense Heads</div>
          </div>
          <div style="border:1px solid ${isProfit ? '#86efac' : '#fca5a5'};border-radius:6px;padding:10px 12px;background:${isProfit ? '#f0fdf4' : '#fef2f2'};">
            <div style="font-size:11px;color:${isProfit ? '#166534' : '#991b1b'};text-transform:uppercase;font-weight:700;">${isProfit ? 'Net Profit' : 'Net Loss'}</div>
            <div style="font-size:19px;font-weight:800;color:${isProfit ? '#15803d' : '#dc2626'};margin-top:3px;">${isProfit ? '+' : '-'}₹${Math.abs(fin.netProfit).toLocaleString('en-IN')}</div>
            <div style="font-size:11px;color:${isProfit ? '#166534' : '#991b1b'};">Margin: ${fin.marginPercent}%</div>
          </div>
        </div>

        <h3 style="font-size:14px;font-weight:800;margin:0 0 8px 0;">Expenditure Summary by Category (ചെലവുകളുടെ സംഗ്രഹം)</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:16px;">
          <thead>
            <tr style="background:#f1f5f9;border-bottom:2px solid #0f172a;">
              <th style="text-align:left;padding:7px 10px;">Expense Head</th>
              <th style="text-align:left;padding:7px 10px;">Particulars</th>
              <th style="text-align:right;padding:7px 10px;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:7px 10px;font-weight:700;">1. Stock Pricing (സ്റ്റോക്കിന്റെ പ്രൈസിങ്)</td>
              <td style="padding:7px 10px;color:#475569;">Raw material &amp; kitchen stock cost</td>
              <td style="padding:7px 10px;text-align:right;font-weight:700;">₹${fin.stockPricingCost.toLocaleString('en-IN')}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:7px 10px;font-weight:700;">2. Extras Taken Cost (എക്സ്ട്രാസ് കൊണ്ടുപോയതിന്റെ ചെലവുകൾ)</td>
              <td style="padding:7px 10px;color:#475569;">Rentals, transport, logistics &amp; extra items</td>
              <td style="padding:7px 10px;text-align:right;font-weight:700;">₹${fin.extrasTakenCost.toLocaleString('en-IN')}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:7px 10px;font-weight:700;">3. Staff Wages, Allowances &amp; Expenses (സ്റ്റാഫിന്റെ ചെലവുകൾ)</td>
              <td style="padding:7px 10px;color:#475569;">Shifts (${fin.attendedShiftCount}): ₹${fin.staffShiftWages.toLocaleString('en-IN')} + Allowances: ₹${fin.staffAllowances.toLocaleString('en-IN')} + Staff Extra: ₹${fin.staffExpenseCost.toLocaleString('en-IN')}</td>
              <td style="padding:7px 10px;text-align:right;font-weight:700;">₹${fin.totalStaffCost.toLocaleString('en-IN')}</td>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:7px 10px;font-weight:700;">4. Other Expenses (മറ്റ് ചെലവുകൾ)</td>
              <td style="padding:7px 10px;color:#475569;">Miscellaneous operational costs</td>
              <td style="padding:7px 10px;text-align:right;font-weight:700;">₹${fin.otherExpenseCost.toLocaleString('en-IN')}</td>
            </tr>
            <tr style="background:#f8fafc;border-top:2px solid #0f172a;">
              <td colspan="2" style="padding:8px 10px;font-weight:800;">Total Event Expenditure (Including All Allowances)</td>
              <td style="padding:8px 10px;text-align:right;font-weight:800;color:#be123c;font-size:14px;">₹${fin.totalExpenditure.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>

        <h3 style="font-size:14px;font-weight:800;margin:0 0 8px 0;">Itemized Extra Expense Entries</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;border-bottom:1.5px solid #0f172a;">
              <th style="text-align:left;padding:6px 10px;">Category</th>
              <th style="text-align:left;padding:6px 10px;">Description</th>
              <th style="text-align:center;padding:6px 10px;">Date</th>
              <th style="text-align:right;padding:6px 10px;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${expenseRowsHtml}
          </tbody>
        </table>
      </div>
    `;

    printHtmlDocument(html, {
      title: `Event-PnL-${evt.title.replace(/[^a-zA-Z0-9]/g, '_')}`,
      orientation: 'portrait'
    });
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            <span
              className="badge"
              style={{
                background: '#ffe4e6',
                color: '#be123c',
                border: '1px solid #fecdd3',
                fontWeight: 800,
                fontSize: '0.72rem'
              }}
            >
              🔒 OWNER ONLY — CONFIDENTIAL MODULE
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Hidden from Accountant, Manager &amp; Staff
            </span>
          </div>
          <h1 className="page-title" style={{ margin: 0 }}>
            📈 Event Profit &amp; Loss (P&amp;L) Statement
          </h1>
          <p className="page-subtitle">
            Complete event revenue vs total expenditure (including Stock Pricing, Extras Taken, Staff Wages + All Allowances, and Other Expenses).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            onClick={() =>
              printElementById('pnl-report-printable-area', {
                title: 'Owner-Profit-And-Loss-Statement',
                orientation: 'landscape'
              })
            }
          >
            🖨️ Print P&amp;L Statement
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={isDownloadingPdf}
            style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            onClick={async () => {
              setIsDownloadingPdf(true);
              await downloadElementAsPdf(
                'pnl-report-printable-area',
                `Owner-PnL-Statement-${new Date().toISOString().slice(0, 10)}`,
                { orientation: 'landscape' }
              );
              setIsDownloadingPdf(false);
            }}
          >
            {isDownloadingPdf ? '⏳ Exporting...' : '📥 Download P&L PDF'}
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '0.9rem 1.1rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '0.85rem',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.76rem' }}>
                Event Scope
              </label>
              <select
                className="form-control"
                style={{ minWidth: '215px', padding: '0.42rem 0.65rem', fontSize: '0.84rem' }}
                value={statusScope}
                onChange={(e) => setStatusScope(e.target.value as PnlStatusScope)}
              >
                <option value="completed">✓ Completed Events Only</option>
                <option value="confirmed_completed">Confirmed &amp; Completed Events</option>
                <option value="all_active">All Active Events (excl. Cancelled)</option>
              </select>
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.76rem' }}>
                From Date
              </label>
              <input
                type="date"
                className="form-control"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.84rem' }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.76rem' }}>
                To Date
              </label>
              <input
                type="date"
                className="form-control"
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.84rem' }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" style={{ marginBottom: '0.25rem', fontSize: '0.76rem' }}>
                Search Event / Client
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Search title, client, venue..."
                style={{ minWidth: '200px', padding: '0.4rem 0.65rem', fontSize: '0.84rem' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => applyDatePreset('this_month')}
            >
              This Month
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => applyDatePreset('last_month')}
            >
              Last Month
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => applyDatePreset('this_year')}
            >
              This Year
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => applyDatePreset('all')}
            >
              All Dates
            </button>
          </div>
        </div>
      </div>

      {/* Printable Standalone Report Area */}
      <div id="pnl-report-printable-area" style={{ background: 'transparent' }}>
        {/* Executive P&L KPI Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1.25rem'
          }}
        >
          <div className="stats-card" style={{ borderLeft: '4px solid #2563eb' }}>
            <span className="stats-label">Total Event Revenue</span>
            <span className="stats-value" style={{ color: '#0f172a' }}>
              ₹{totals.contractRevenue.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub">
              Collected: ₹{totals.collectedRevenue.toLocaleString('en-IN')} &bull; Due: ₹
              {totals.pendingReceivable.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="stats-card" style={{ borderLeft: '4px solid #e11d48' }}>
            <span className="stats-label">Total Expenditure (incl. Allowances)</span>
            <span className="stats-value" style={{ color: '#be123c' }}>
              ₹{totals.totalExpenditure.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub">
              Across {pnlRows.length} event{pnlRows.length === 1 ? '' : 's'} (all allowances included)
            </span>
          </div>

          <div
            className="stats-card"
            style={{
              borderLeft: `4px solid ${totals.netProfit >= 0 ? '#16a34a' : '#dc2626'}`,
              background: totals.netProfit >= 0 ? '#f0fdf4' : '#fef2f2'
            }}
          >
            <span className="stats-label">
              {totals.netProfit >= 0 ? 'Net Profit (ലാഭം)' : 'Net Loss (നഷ്ടം)'}
            </span>
            <span
              className="stats-value"
              style={{ color: totals.netProfit >= 0 ? '#15803d' : '#dc2626' }}
            >
              {totals.netProfit >= 0 ? '+' : '-'}₹
              {Math.abs(totals.netProfit).toLocaleString('en-IN')}
            </span>
            <span className="stats-sub" style={{ fontWeight: 600 }}>
              Revenue minus Total Event Expenditure
            </span>
          </div>

          <div className="stats-card" style={{ borderLeft: '4px solid #7c3aed' }}>
            <span className="stats-label">Overall Profit Margin</span>
            <span
              className="stats-value"
              style={{ color: overallMarginPercent >= 0 ? '#6d28d9' : '#dc2626' }}
            >
              {overallMarginPercent}%
            </span>
            <span className="stats-sub">
              Profitable: <strong>{totals.profitableCount}</strong> &bull; Loss:{' '}
              <strong>{totals.lossCount}</strong>
            </span>
          </div>
        </div>

        {/* 4-Category Expenditure Breakdown Strip */}
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
            💸 Expenditure Breakdown Across Events (Including All Staff Allowances)
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '0.85rem'
            }}
          >
            <div style={{ padding: '0.75rem 0.9rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>
                📦 Stock Pricing (സ്റ്റോക്കിന്റെ പ്രൈസിങ്)
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                ₹{totals.stockPricingCost.toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{ padding: '0.75rem 0.9rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>
                🚚 Extras Taken (എക്സ്ട്രാസ് ചെലവുകൾ)
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                ₹{totals.extrasTakenCost.toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{ padding: '0.75rem 0.9rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>
                👥 Staff + Allowances (സ്റ്റാഫിന്റെ ചെലവുകൾ)
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                ₹{totals.totalStaffCost.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>
                Shifts: ₹{totals.staffShiftWages.toLocaleString('en-IN')} &bull; Allowances: ₹
                {totals.staffAllowances.toLocaleString('en-IN')} &bull; Extra: ₹
                {totals.staffExpenseCost.toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{ padding: '0.75rem 0.9rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>
                🧾 Other Expenses (മറ്റ് ചെലവുകൾ)
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
                ₹{totals.otherExpenseCost.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        {/* Event-by-Event P&L Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>
                Event-by-Event Profit &amp; Loss Ledger ({pnlRows.length})
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                Click any event&apos;s Print button to print ONLY that event&apos;s standalone A4 P&amp;L document, or open the event to log/edit extra expenses.
              </p>
            </div>
          </div>

          {pnlRows.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                No events match the selected filter ({statusScope === 'completed' ? 'Completed Events' : 'Selected Scope'}).
              </p>
              {statusScope === 'completed' && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm no-print"
                  style={{ marginTop: '0.75rem' }}
                  onClick={() => setStatusScope('all_active')}
                >
                  Show All Active Events Instead
                </button>
              )}
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event &amp; Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Revenue</th>
                    <th style={{ textAlign: 'right' }}>Stock Pricing</th>
                    <th style={{ textAlign: 'right' }}>Extras Cost</th>
                    <th style={{ textAlign: 'right' }}>Staff + Allowances</th>
                    <th style={{ textAlign: 'right' }}>Other Cost</th>
                    <th style={{ textAlign: 'right' }}>Total Spent</th>
                    <th style={{ textAlign: 'right' }}>Profit / Loss</th>
                    <th className="no-print" style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pnlRows.map(({ event: evt, client, summary: fin }) => {
                    const isProfit = fin.netProfit >= 0;
                    return (
                      <tr key={evt.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{evt.title}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {evt.event_date} &bull; {client?.name || 'Client'} &bull; {evt.guest_count} Pax
                          </div>
                        </td>
                        <td>
                          <span className={`badge badge-${evt.status}`}>{evt.status}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          ₹{fin.contractRevenue.toLocaleString('en-IN')}
                          {fin.pendingReceivable > 0 && (
                            <div style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 600 }}>
                              Due: ₹{fin.pendingReceivable.toLocaleString('en-IN')}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          ₹{fin.stockPricingCost.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          ₹{fin.extrasTakenCost.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 600 }}>
                            ₹{fin.totalStaffCost.toLocaleString('en-IN')}
                          </div>
                          {(fin.staffAllowances > 0 || fin.staffShiftWages > 0) && (
                            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                              Shifts: ₹{fin.staffShiftWages.toLocaleString('en-IN')} | Allow: ₹
                              {fin.staffAllowances.toLocaleString('en-IN')}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          ₹{fin.otherExpenseCost.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#be123c' }}>
                          ₹{fin.totalExpenditure.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              fontWeight: 800,
                              color: isProfit ? '#15803d' : '#dc2626'
                            }}
                          >
                            {isProfit ? '+' : '-'}₹{Math.abs(fin.netProfit).toLocaleString('en-IN')}
                          </div>
                          <div
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: isProfit ? '#16a34a' : '#dc2626'
                            }}
                          >
                            {fin.marginPercent}% margin
                          </div>
                        </td>
                        <td className="no-print" style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              title="Print ONLY this event's Profit & Loss statement"
                              onClick={() => handlePrintSingleEventPnl(evt)}
                            >
                              🖨️ Print
                            </button>
                            <Link
                              href={`/events/${evt.id}`}
                              className="btn btn-primary btn-sm"
                              title="View or manage event expenses"
                            >
                              Expenses &rarr;
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
