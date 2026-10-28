'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { store } from '@/lib/store';
import { Invoice } from '@/lib/types';
import { downloadElementAsPdf } from '@/lib/downloadPdf';
import EditBankDetailsModal from '@/components/EditBankDetailsModal';
import { getMaxDueDate, getDefaultDueDate, clampDueDate, getTodayString } from '@/lib/dateUtils';

export default function InvoicesPage() {
  const [state, setState] = useState(store.getState());
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  // Default to portrait mode for standard A4 printing and downloading
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('portrait');
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);

  // Unlock / Edit Invoice modal state
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editInvForm, setEditInvForm] = useState({
    subtotal: 0,
    discount: 0,
    amount: 0,
    kind: 'deposit' as 'deposit' | 'final',
    due_date: '',
    status: 'draft' as Invoice['status']
  });

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role = state.currentRole;
  const isFinance = role === 'owner' || role === 'accountant';
  const canViewInvoices = role === 'owner' || role === 'manager' || role === 'accountant';

  if (!canViewInvoices) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Restricted Area</h2>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
          Your current role (<em>{role}</em>) does not have authorization to view financial invoices.
        </p>
      </div>
    );
  }

  const totalInvoiced = state.invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalPaid = state.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPending = Math.max(0, totalInvoiced - totalPaid);

  const handleOpenEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    const subtotal = inv.subtotal !== undefined ? inv.subtotal : inv.amount;
    const discount = inv.discount || 0;
    const amount = Math.max(0, subtotal - discount);
    const maxDue = getMaxDueDate(inv.created_at);
    const initialDue = inv.due_date ? clampDueDate(inv.due_date, inv.created_at) : getDefaultDueDate(inv.created_at);

    setEditInvForm({
      subtotal,
      discount,
      amount,
      kind: inv.kind,
      due_date: initialDue,
      status: inv.status
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    const netAmount = Math.max(0, editInvForm.subtotal - editInvForm.discount);
    const maxDue = getMaxDueDate(editingInvoice.created_at);
    const safeDueDate = editInvForm.due_date > maxDue ? maxDue : editInvForm.due_date;

    store.updateInvoice(editingInvoice.id, {
      ...editInvForm,
      amount: netAmount,
      due_date: safeDueDate
    });
    setEditingInvoice(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoicing &amp; Accounts Receivable</h1>
          <p className="page-subtitle">
            All amounts in INR (₹) with owner discount option. Standard Portrait A4 print with official logo &amp; customizable bank details.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsBankModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
          >
            🏦 Edit Bank Details &amp; Terms (ബാങ്ക് വിവരങ്ങൾ)
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="stats-card">
          <span className="stats-label">Total Invoiced Amount</span>
          <span className="stats-value">₹{totalInvoiced.toLocaleString('en-IN')}</span>
          <span className="stats-sub">Across {state.invoices.length} invoices generated</span>
        </div>
        <div className="stats-card">
          <span className="stats-label">Payments Received</span>
          <span className="stats-value" style={{ color: 'var(--success)' }}>
            ₹{totalPaid.toLocaleString('en-IN')}
          </span>
          <span className="stats-sub">Reconciled to bank &amp; cash</span>
        </div>
        <div className="stats-card">
          <span className="stats-label">Outstanding Balance</span>
          <span className="stats-value" style={{ color: totalPending > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
            ₹{totalPending.toLocaleString('en-IN')}
          </span>
          <span className="stats-sub">Pending client settlements</span>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">All Event Invoices</h2>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Event &amp; Client</th>
                <th>Type</th>
                <th>Due Date</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ textAlign: 'right' }}>Paid Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No invoices recorded yet. Generate invoices from the Event detail view.
                  </td>
                </tr>
              ) : (
                state.invoices.map((inv) => {
                  const evt = state.events.find((e) => e.id === inv.event_id);
                  const client = state.clients.find((c) => c.id === evt?.client_id);
                  const paymentsForThis = state.payments
                    .filter((p) => p.invoice_id === inv.id)
                    .reduce((sum, p) => sum + p.amount, 0);

                  const waText = encodeURIComponent(
                    `Hello ${client?.name}, here is the invoice ${inv.invoice_number} from ${state.settings.name} for ${evt?.title}. Amount: ₹${inv.amount.toLocaleString('en-IN')}. Due date: ${inv.due_date || 'immediate'}. Thank you!`
                  );
                  const waUrl = `https://wa.me/${client?.phone?.replace(/[^0-9]/g, '') || ''}?text=${waText}`;

                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 700 }}>{inv.invoice_number}</td>
                      <td>
                        <Link
                          href={`/events/${evt?.id}`}
                          style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'underline' }}
                        >
                          {evt?.title || 'Unknown Event'}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Client: {client?.name}
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: '#f1f5f9' }}>
                          {inv.kind}
                        </span>
                      </td>
                      <td>{inv.due_date || 'Immediate'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        ₹{inv.amount.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                        ₹{paymentsForThis.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span className={`badge badge-${inv.status}`}>{inv.status}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            title="Print / Save PDF with Logo"
                            onClick={() => setSelectedInvoiceForPrint(inv)}
                          >
                            🖨️ PDF
                          </button>

                          {isFinance && (
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Unlock Invoice for Editing"
                              onClick={() => handleOpenEdit(inv)}
                            >
                              🔓 Unlock
                            </button>
                          )}

                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                            title="Send WhatsApp Message"
                          >
                            💬 WA
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* A4 Print Modal (WITH WIDE A4 & LOGO INCLUDED) */}
      {selectedInvoiceForPrint && (
        <div className="modal-overlay" onClick={() => setSelectedInvoiceForPrint(null)}>
          <div
            className="modal-content print-page"
            style={{
              maxWidth: printOrientation === 'landscape' ? '1120px' : '780px',
              width: '96%',
              background: '#ffffff',
              transition: 'max-width 0.2s ease'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Toolbar */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>🧾 Official Invoice (A4 PDF)</span>
                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                  Logo Included
                </span>

                {/* Wide A4 / Portrait Switcher */}
                <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f1f5f9', padding: '3px', borderRadius: '8px', marginLeft: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintOrientation('landscape');
                      document.body.classList.remove('print-portrait-mode');
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: printOrientation === 'landscape' ? '#0f172a' : 'transparent',
                      color: printOrientation === 'landscape' ? '#ffffff' : '#64748b',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📐 Wide A4 (ലാൻഡ്‌സ്‌കേപ്പ്)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintOrientation('portrait');
                      document.body.classList.add('print-portrait-mode');
                    }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: printOrientation === 'portrait' ? '#0f172a' : 'transparent',
                      color: printOrientation === 'portrait' ? '#ffffff' : '#64748b',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    📄 Portrait
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={isDownloadingPdf}
                  onClick={async () => {
                    setIsDownloadingPdf(true);
                    await downloadElementAsPdf('invoice-printable-area', `${selectedInvoiceForPrint.invoice_number}`, {
                      orientation: printOrientation
                    });
                    setIsDownloadingPdf(false);
                  }}
                  style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {isDownloadingPdf ? '⏳ Generating Wide PDF...' : '📥 Download Wide PDF'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (printOrientation === 'portrait') {
                      document.body.classList.add('print-portrait-mode');
                    } else {
                      document.body.classList.remove('print-portrait-mode');
                    }
                    window.print();
                  }}
                >
                  🖨️ Print
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedInvoiceForPrint(null)}>
                  Close
                </button>
              </div>
            </div>

            {/* Scrollable Container for mobile preview */}
            <div className="wide-scroll-container">
              {(() => {
                const inv = selectedInvoiceForPrint;
                const evt = state.events.find((e) => e.id === inv.event_id);
                const client = state.clients.find((c) => c.id === evt?.client_id);
                const { grandTotal } = evt ? store.getEventTotal(evt.id) : { grandTotal: 0 };
                const evtItems = evt ? state.eventItems.filter((i) => i.event_id === evt.id) : [];
                const paymentsForThis = state.payments
                  .filter((p) => p.invoice_id === inv.id)
                  .reduce((s, p) => s + p.amount, 0);
                const isWide = printOrientation === 'landscape';

                return (
                  <div
                    id="invoice-printable-area"
                    className="wide-a4-sheet"
                    style={{
                      padding: isWide ? '2.5rem 3rem' : '2.25rem 2rem',
                      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                      color: '#111827',
                      background: '#ffffff',
                      maxWidth: isWide ? '1060px' : '750px',
                      minWidth: isWide ? '920px' : 'auto',
                      margin: '0 auto',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Top Header: Logo on left, "Invoice" on right */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <img
                          src="/logo.png"
                          alt="IPPAS Food Service & Events"
                          style={{ height: '70px', width: 'auto', objectFit: 'contain', display: 'block' }}
                        />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '0.5px', color: '#111827' }}>
                            IPPAS FOOD SERVICE &amp; EVENTS
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b', letterSpacing: '0.2px' }}>
                            Premium Outdoor Catering &bull; Event Management &bull; Kerala
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <h1
                          style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontSize: isWide ? '3.4rem' : '3rem',
                            fontWeight: 400,
                            color: '#111827',
                            lineHeight: 1,
                            margin: 0,
                            letterSpacing: '-0.5px'
                          }}
                        >
                          Invoice
                        </h1>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.35rem', fontWeight: 500 }}>
                          Official Tax Invoice / Bill
                        </div>
                      </div>
                    </div>

                    {/* Billed to & Invoice Meta Section */}
                    {isWide ? (
                      /* 3-Column Wide Metadata Layout */
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '2rem', marginBottom: '2.25rem', background: '#f8fafc', padding: '1.25rem 1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '0.4rem' }}>
                            Billed To:
                          </div>
                          <div style={{ fontSize: '0.95rem', color: '#0f172a', lineHeight: 1.45 }}>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#111827' }}>
                              {client?.name || 'Valued Client'}
                            </div>
                            {client?.phone && <div style={{ color: '#334155' }}>📞 {client.phone}</div>}
                            {client?.email && <div style={{ color: '#334155' }}>✉️ {client.email}</div>}
                            {client?.company && <div style={{ color: '#475569' }}>🏢 {client.company}</div>}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '0.4rem' }}>
                            Event Particulars:
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.45 }}>
                            <div style={{ fontWeight: 600, color: '#111827' }}>{evt?.title || 'Catering Event'}</div>
                            {evt?.event_date && (
                              <div style={{ color: '#334155' }}>
                                📅 Date: <strong>{new Date(evt.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                              </div>
                            )}
                            {evt?.venue && <div style={{ color: '#334155' }}>📍 Venue: {evt.venue}</div>}
                            {evt?.guest_count && <div style={{ color: '#334155' }}>👥 Guests: <strong>{evt.guest_count} Pax</strong></div>}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '0.4rem' }}>
                            Invoice Details:
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.5 }}>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>
                              #{inv.invoice_number.replace(/^INV-/, '') || '12345'}
                            </div>
                            <div>
                              Issued: {new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            <div style={{ color: '#475569' }}>
                              Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'On Receipt'}
                            </div>
                            <div style={{ marginTop: '0.35rem' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.2rem 0.55rem',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  background: inv.status === 'paid' ? '#dcfce7' : '#fee2e2',
                                  color: inv.status === 'paid' ? '#15803d' : '#b91c1c'
                                }}
                              >
                                Status: {inv.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Standard 2-Column Metadata Layout */
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.25rem' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827', marginBottom: '0.35rem' }}>
                            Billed to:
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#1f2937', lineHeight: 1.45 }}>
                            <div style={{ fontWeight: 600 }}>{client?.name || 'Valued Client'}</div>
                            {client?.phone && <div>{client.phone}</div>}
                            {client?.email && <div>{client.email}</div>}
                            <div>{evt?.venue || client?.company || '123 Anywhere St., Any City'}</div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', fontSize: '0.9rem', color: '#1f2937', lineHeight: 1.5 }}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>
                            Invoice No. {inv.invoice_number.replace(/^INV-/, '') || '12345'}
                          </div>
                          <div>
                            {new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>
                            Due: {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'On Receipt'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Wide Table with Full-Width Columns */}
                    <div style={{ marginBottom: '1.75rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2.5px solid #111827', background: isWide ? '#f8fafc' : 'transparent' }}>
                            <th style={{ textAlign: 'left', padding: '0.75rem 0.6rem', fontWeight: 700, color: '#111827' }}>
                              Item &amp; Description
                            </th>
                            <th style={{ textAlign: 'center', padding: '0.75rem 0.6rem', fontWeight: 700, color: '#111827', width: isWide ? '15%' : '20%' }}>
                              Quantity / Pax
                            </th>
                            <th style={{ textAlign: 'right', padding: '0.75rem 0.6rem', fontWeight: 700, color: '#111827', width: isWide ? '18%' : '20%' }}>
                              Unit Price
                            </th>
                            <th style={{ textAlign: 'right', padding: '0.75rem 0.6rem', fontWeight: 700, color: '#111827', width: isWide ? '20%' : '22%' }}>
                              Total
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {evtItems.length > 0 ? (
                            evtItems.map((ei) => {
                              const mItem = state.menuItems.find((m) => m.id === ei.menu_item_id);
                              const qty = evt?.guest_count || 1;
                              const lineTotal = ei.price_per_guest * qty;
                              return (
                                <tr key={ei.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                  <td style={{ padding: '0.85rem 0.6rem', color: '#1f2937' }}>
                                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{mItem?.name || 'Catering Dish'}</div>
                                    {mItem?.category && (
                                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{mItem.category}</div>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '0.85rem 0.6rem', color: '#1f2937' }}>
                                    {qty} Pax
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '0.85rem 0.6rem', color: '#1f2937' }}>
                                    ₹{ei.price_per_guest.toLocaleString('en-IN')}
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '0.85rem 0.6rem', color: '#1f2937', fontWeight: 600 }}>
                                    ₹{lineTotal.toLocaleString('en-IN')}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '0.85rem 0.6rem', color: '#1f2937' }}>
                                <div style={{ fontWeight: 600 }}>{evt?.title || 'Catering & Event Package'}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  {inv.kind === 'deposit' ? 'Advance Deposit Payment' : 'Final Event Settlement'}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center', padding: '0.85rem 0.6rem', color: '#1f2937' }}>
                                1 Lot
                              </td>
                              <td style={{ textAlign: 'right', padding: '0.85rem 0.6rem', color: '#1f2937' }}>
                                ₹{inv.amount.toLocaleString('en-IN')}
                              </td>
                              <td style={{ textAlign: 'right', padding: '0.85rem 0.6rem', color: '#1f2937', fontWeight: 600 }}>
                                ₹{inv.amount.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Subtotal & Total Row */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                      <div style={{ width: isWide ? '340px' : '290px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.5rem', fontSize: '0.95rem', fontWeight: 600, color: '#111827' }}>
                          <span>Subtotal</span>
                          <span>₹{grandTotal > 0 ? grandTotal.toLocaleString('en-IN') : inv.amount.toLocaleString('en-IN')}</span>
                        </div>

                        {paymentsForThis > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.5rem', fontSize: '0.9rem', color: '#059669', fontWeight: 600 }}>
                            <span>Paid / Reconciled</span>
                            <span>- ₹{paymentsForThis.toLocaleString('en-IN')}</span>
                          </div>
                        )}

                        {/* Solid Black Highlight Total Bar */}
                        <div
                          style={{
                            background: '#111827',
                            color: '#ffffff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.85rem 1.25rem',
                            marginTop: '0.65rem',
                            width: '100%',
                            boxSizing: 'border-box',
                            borderRadius: '4px'
                          }}
                        >
                          <span style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.5px' }}>
                            Total
                          </span>
                          <span style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                            ₹{inv.amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Section: Script Thank You! & Payment Info on Left, Authorized Company Details on Right */}
                    <div style={{ display: 'grid', gridTemplateColumns: isWide ? '1.4fr 1fr' : '1.2fr 1fr', gap: '2.5rem', marginTop: '2.5rem', alignItems: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '1.75rem' }}>
                      <div>
                        <div
                          style={{
                            fontFamily: "'Caveat', 'Alex Brush', 'Brush Script MT', cursive",
                            fontSize: '3.2rem',
                            lineHeight: 1,
                            color: '#111827',
                            marginBottom: '1rem',
                            transform: 'rotate(-3deg)',
                            display: 'inline-block'
                          }}
                        >
                          Thank You!
                        </div>

                        <div style={{ fontSize: '0.85rem', color: '#1f2937', lineHeight: 1.55 }}>
                          <div style={{ fontWeight: 700, color: '#111827', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.3px', fontSize: '0.8rem' }}>
                            Payment &amp; Banking Information
                          </div>
                          <div>Bank: <strong>Federal Bank / State Bank of India</strong></div>
                          <div>Account Name: <strong>IPPAS Food Service &amp; Events</strong></div>
                          <div>Account No: <strong>9876-5432-1000</strong> &bull; IFSC: <strong>FDRL0001234</strong></div>
                          <div>Pay by: <strong>{inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Immediate'}</strong></div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontSize: '1.35rem',
                            fontWeight: 700,
                            color: '#111827',
                            marginBottom: '0.25rem'
                          }}
                        >
                          {state.settings.name}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.45 }}>
                          {state.settings.address}
                          <br />
                          Phone: {state.settings.phone} &bull; {state.settings.email}
                        </div>
                        <div style={{ marginTop: '1.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1', display: 'inline-block', minWidth: '180px', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                          Authorized Signatory
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}


      {/* UNLOCK / EDIT INVOICE MODAL */}
      {editingInvoice && (
        <div className="modal-overlay" onClick={() => setEditingInvoice(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>
                🔓 Unlock &amp; Edit {editingInvoice.invoice_number}
              </h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingInvoice(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label className="form-label">Invoice Kind</label>
                <select
                  className="form-control"
                  value={editInvForm.kind}
                  onChange={(e) => setEditInvForm({ ...editInvForm, kind: e.target.value as any })}
                >
                  <option value="deposit">Deposit / Advance</option>
                  <option value="final">Final Settlement</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount (INR ₹) *</label>
                <input
                  type="number"
                  className="form-control"
                  value={editInvForm.amount}
                  onChange={(e) => setEditInvForm({ ...editInvForm, amount: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Due Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={editInvForm.due_date}
                  onChange={(e) => setEditInvForm({ ...editInvForm, due_date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-control"
                  value={editInvForm.status}
                  onChange={(e) => setEditInvForm({ ...editInvForm, status: e.target.value as any })}
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid</option>
                  <option value="void">Void</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (confirm(`Delete ${editingInvoice.invoice_number}?`)) {
                      store.deleteInvoice(editingInvoice.id);
                      setEditingInvoice(null);
                    }
                  }}
                >
                  Delete
                </button>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingInvoice(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Save Updates
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
