'use client';

import React from 'react';
import Link from 'next/link';
import { InvoiceCollectionsBreakdown } from '@/lib/store';

interface InvoiceCollectionsCardProps {
  breakdown: InvoiceCollectionsBreakdown;
  title?: string;
  subtitle?: string;
  showInvoicesLink?: boolean;
}

export default function InvoiceCollectionsCard({
  breakdown,
  title = '🏦 Invoice Collections — Bank vs Cash & Account Holdings',
  subtitle = 'Complete breakdown of invoice amounts received in Bank vs Cash and exact accounts holding your collected funds.',
  showInvoicesLink = false
}: InvoiceCollectionsCardProps) {
  const bankShare =
    breakdown.totalCollected > 0
      ? Math.round((breakdown.totalBankReceived / breakdown.totalCollected) * 100)
      : 0;
  const cashShare =
    breakdown.totalCollected > 0
      ? Math.round((breakdown.totalCashReceived / breakdown.totalCollected) * 100)
      : 0;

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '0.75rem',
          flexWrap: 'wrap',
          marginBottom: '1rem'
        }}
      >
        <div>
          <h2 className="card-title" style={{ margin: 0 }}>
            {title}
          </h2>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            {subtitle}
          </p>
        </div>
        {showInvoicesLink && (
          <Link href="/invoices" className="btn btn-secondary btn-sm">
            Open Invoices &amp; Accounts &rarr;
          </Link>
        )}
      </div>

      {/* Top 4 Channel Summary Tiles */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.9rem',
          marginBottom: '1.15rem'
        }}
      >
        <div
          style={{
            padding: '0.9rem 1rem',
            borderRadius: '8px',
            border: '1px solid #bfdbfe',
            background: '#eff6ff'
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
            🏦 Received in Bank Accounts
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1d4ed8', marginTop: '0.2rem' }}>
            ₹{breakdown.totalBankReceived.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#3b82f6', marginTop: '0.15rem' }}>
            {breakdown.bankPaymentCount} bank/UPI receipt{breakdown.bankPaymentCount === 1 ? '' : 's'} ({bankShare}%)
          </div>
        </div>

        <div
          style={{
            padding: '0.9rem 1rem',
            borderRadius: '8px',
            border: '1px solid #a7f3d0',
            background: '#ecfdf5'
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>
            💵 Received as Cash in Hand
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#059669', marginTop: '0.2rem' }}>
            ₹{breakdown.totalCashReceived.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '0.15rem' }}>
            {breakdown.cashPaymentCount} cash receipt{breakdown.cashPaymentCount === 1 ? '' : 's'} ({cashShare}%)
          </div>
        </div>

        <div
          style={{
            padding: '0.9rem 1rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: '#f8fafc'
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>
            ✓ Total Collected (Bank + Cash)
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
            ₹{breakdown.totalCollected.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
            Out of ₹{breakdown.totalInvoiced.toLocaleString('en-IN')} invoiced
          </div>
        </div>

        <div
          style={{
            padding: '0.9rem 1rem',
            borderRadius: '8px',
            border: `1px solid ${breakdown.totalPendingReceivable > 0 ? '#fecaca' : '#e2e8f0'}`,
            background: breakdown.totalPendingReceivable > 0 ? '#fef2f2' : '#f8fafc'
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: breakdown.totalPendingReceivable > 0 ? '#991b1b' : '#475569',
              textTransform: 'uppercase'
            }}
          >
            ⏳ Pending With Clients
          </div>
          <div
            style={{
              fontSize: '1.35rem',
              fontWeight: 800,
              color: breakdown.totalPendingReceivable > 0 ? '#dc2626' : '#059669',
              marginTop: '0.2rem'
            }}
          >
            ₹{breakdown.totalPendingReceivable.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
            Uncollected invoice balance
          </div>
        </div>
      </div>

      {/* Exact Account-by-Account Breakdown: Where Total Amounts Are Held */}
      <div>
        <div
          style={{
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#0f172a',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.3px'
          }}
        >
          Where Total Collected Amounts Are Located (Account-wise Breakdown)
        </div>

        {breakdown.accountHoldings.length === 0 ? (
          <div
            style={{
              padding: '0.85rem',
              borderRadius: '6px',
              background: '#f8fafc',
              color: 'var(--text-muted)',
              fontSize: '0.84rem'
            }}
          >
            No invoice payments collected yet. When payments are recorded, each Bank Account and Cash Counter balance will appear here.
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Destination Account / Location</th>
                  <th>Channel</th>
                  <th style={{ textAlign: 'center' }}>Receipts</th>
                  <th>Last Received</th>
                  <th style={{ textAlign: 'right' }}>Total Amount in Account</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.accountHoldings.map((acc) => {
                  const isCash = acc.channel === 'cash';
                  return (
                    <tr key={`${acc.channel}-${acc.accountName}`}>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>
                        {isCash ? '💵 ' : '🏦 '}
                        {acc.accountName}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: isCash ? '#059669' : '#1d4ed8',
                            textTransform: 'uppercase'
                          }}
                        >
                          {isCash ? 'Cash in Hand' : 'Bank Account'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{acc.paymentCount}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {acc.lastReceivedAt
                          ? new Date(acc.lastReceivedAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })
                          : '—'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 800,
                          color: isCash ? '#059669' : '#1d4ed8',
                          fontSize: '0.95rem'
                        }}
                      >
                        ₹{acc.totalReceived.toLocaleString('en-IN')}
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
  );
}
