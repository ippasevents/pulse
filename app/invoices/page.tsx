'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { store } from '@/lib/store';
import { Invoice, Payment, PaymentChannel } from '@/lib/types';
import { downloadElementAsPdf } from '@/lib/downloadPdf';
import EditBankDetailsModal from '@/components/EditBankDetailsModal';
import { getMaxDueDate, getDefaultDueDate, clampDueDate } from '@/lib/dateUtils';
import { sendInvoiceEmailNotification } from '@/lib/emailInvoice';
import OwnerAuditBadge from '@/components/OwnerAuditBadge';
import InvoiceCollectionsCard from '@/components/InvoiceCollectionsCard';
import WhatsAppShareModal from '@/components/WhatsAppShareModal';

export default function InvoicesPage() {
  const [state, setState] = useState(store.getState());
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [selectedInvoiceForWhatsApp, setSelectedInvoiceForWhatsApp] = useState<Invoice | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<{
    type: 'success' | 'info';
    message: string;
    gmailWebUrl?: string;
    mailtoUrl?: string;
  } | null>(null);

  // Edit Invoice modal state (no unlock requirement)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editInvForm, setEditInvForm] = useState({
    subtotal: 0,
    discount: 0,
    amount: 0,
    kind: 'deposit' as 'deposit' | 'final',
    due_date: '',
    status: 'draft' as Invoice['status'],
    notes: ''
  });

  // Part Payment modal state (same invoice, with Bank vs Cash & Destination Account)
  const [partPayInvoice, setPartPayInvoice] = useState<Invoice | null>(null);
  const [partPayForm, setPartPayForm] = useState({
    amount: 0,
    method: 'UPI / GPay',
    payment_channel: 'bank' as PaymentChannel,
    destination_account: '',
    custom_account: '',
    note: ''
  });

  useEffect(() => {
    setState(store.getState());
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role = state.currentRole;
  const isFinance = role === 'owner' || role === 'accountant' || role === 'super_admin';
  const canViewInvoices = isFinance;

  if (!canViewInvoices) {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }} className="card">
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔒</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>Restricted Area (Accountant &amp; Owner Access)</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          Your current active role is <strong>{role.toUpperCase()}</strong>. Invoices, receipts, and receivables are managed exclusively by the <strong>Accountant</strong> and <strong>Owner</strong>.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/dashboard" className="btn btn-primary">
            &larr; Go to Manager Dashboard
          </Link>
          <Link href="/events" className="btn btn-secondary">
            View Upcoming Events
          </Link>
        </div>
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
      status: inv.status,
      notes: inv.notes || ''
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    const netAmount = Math.max(0, Number(editInvForm.subtotal) - Number(editInvForm.discount));
    const maxDue = getMaxDueDate(editingInvoice.created_at);
    const safeDueDate = editInvForm.due_date > maxDue ? maxDue : editInvForm.due_date;

    store.updateInvoice(editingInvoice.id, {
      subtotal: Number(editInvForm.subtotal),
      discount: Number(editInvForm.discount),
      amount: netAmount,
      kind: editInvForm.kind,
      due_date: safeDueDate,
      status: editInvForm.status,
      notes: editInvForm.notes
    });
    setEditingInvoice(null);
  };

  const handleOpenPartPay = (inv: Invoice) => {
    setPartPayInvoice(inv);
    const alreadyPaid = state.payments
      .filter((p) => p.invoice_id === inv.id)
      .reduce((s, p) => s + p.amount, 0);
    const balance = Math.max(0, inv.amount - alreadyPaid);
    const defaultMethod = 'UPI / GPay';
    const defaultChannel: PaymentChannel = 'bank';
    const defaultAcc = store.getDefaultDestinationAccount(defaultChannel, defaultMethod);

    setPartPayForm({
      amount: balance,
      method: defaultMethod,
      payment_channel: defaultChannel,
      destination_account: defaultAcc,
      custom_account: '',
      note: ''
    });
  };

  const handleRecordPartPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partPayInvoice || partPayForm.amount <= 0) return;

    const finalAccount =
      partPayForm.destination_account === '__custom__'
        ? partPayForm.custom_account.trim() ||
          store.getDefaultDestinationAccount(partPayForm.payment_channel, partPayForm.method)
        : partPayForm.destination_account ||
          store.getDefaultDestinationAccount(partPayForm.payment_channel, partPayForm.method);

    store.addPayment({
      invoice_id: partPayInvoice.id,
      amount: Number(partPayForm.amount),
      method: partPayForm.method,
      payment_channel: partPayForm.payment_channel,
      destination_account: finalAccount,
      note: partPayForm.note.trim()
    });

    setPartPayInvoice(null);
  };

  const targetGmail = state.settings.invoice_notification_email || 'ippasevents@gmail.com';
  const isAutoEmailOn = state.settings.auto_email_invoices !== false;

  const handleEmailInvoice = async (inv: Invoice) => {
    setSendingEmailId(inv.id);
    const res = await sendInvoiceEmailNotification(inv, targetGmail);
    setSendingEmailId(null);

    if (res.success) {
      setEmailStatus({
        type: 'success',
        message: `Invoice ${inv.invoice_number} sent to ${res.sentTo}.`
      });
    } else if (!res.configured) {
      setEmailStatus({
        type: 'info',
        message: `Configure SMTP_USER & SMTP_PASS in Vercel Environment Variables for silent background email, or send Invoice ${inv.invoice_number} to ${res.sentTo} now:`,
        gmailWebUrl: res.gmailWebUrl,
        mailtoUrl: res.mailtoUrl
      });
    } else {
      setEmailStatus({
        type: 'info',
        message: `Automatic email error (${res.error}). Use quick send for Invoice ${inv.invoice_number} to ${res.sentTo}:`,
        gmailWebUrl: res.gmailWebUrl,
        mailtoUrl: res.mailtoUrl
      });
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoicing &amp; Accounts Receivable</h1>
          <p className="page-subtitle">
            All amounts in INR (₹) with invoice discount, part-payments, A4 PDF export, and automatic Gmail copy to <strong>{targetGmail}</strong>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.4rem 0.75rem',
              borderRadius: '6px',
              background: isAutoEmailOn ? '#eff6ff' : '#f8fafc',
              border: `1px solid ${isAutoEmailOn ? '#93c5fd' : 'var(--border)'}`,
              fontSize: '0.8rem',
              fontWeight: 600,
              color: isAutoEmailOn ? '#1d4ed8' : '#475569',
              cursor: 'pointer'
            }}
            title={`Toggle automatic sending of newly created invoices to ${targetGmail}`}
          >
            <input
              type="checkbox"
              checked={isAutoEmailOn}
              onChange={(e) =>
                store.updateSettings({
                  auto_email_invoices: e.target.checked,
                  invoice_notification_email: targetGmail
                })
              }
            />
            <span>📧 Auto-Send to {targetGmail}</span>
          </label>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsBankModalOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}
          >
            🏦 Edit Bank Details &amp; Terms
          </button>
        </div>
      </div>

      {emailStatus && (
        <div
          style={{
            background: emailStatus.type === 'success' ? '#dcfce7' : '#eff6ff',
            border: `1px solid ${emailStatus.type === 'success' ? '#86efac' : '#93c5fd'}`,
            color: emailStatus.type === 'success' ? '#166534' : '#1e3a8a',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            fontSize: '0.86rem'
          }}
        >
          <span style={{ fontWeight: 600 }}>{emailStatus.message}</span>
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {emailStatus.gmailWebUrl && (
              <a
                href={emailStatus.gmailWebUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 600 }}
              >
                📧 Open Gmail Compose
              </a>
            )}
            {emailStatus.mailtoUrl && (
              <a
                href={emailStatus.mailtoUrl}
                className="btn btn-secondary btn-sm"
                style={{ fontWeight: 600 }}
              >
                ✉️ Mail App
              </a>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEmailStatus(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

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

      {/* Bank vs Cash & Where Total Amounts Are Held */}
      <InvoiceCollectionsCard breakdown={store.getInvoiceCollectionsBreakdown()} />

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-title">All Event Invoices</h2>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Event &amp; Client</th>
                <th>Type</th>
                <th>Due Date</th>
                <th style={{ textAlign: 'right' }}>Invoice Total</th>
                <th style={{ textAlign: 'right' }}>Paid (Part Pay)</th>
                <th style={{ textAlign: 'right' }}>Balance Due</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {state.invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
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
                  const balanceDue = Math.max(0, inv.amount - paymentsForThis);

                  const waText = encodeURIComponent(
                    `Hello ${client?.name}, here is the invoice ${inv.invoice_number} from ${state.settings.name} for ${evt?.title}. Amount: ₹${inv.amount.toLocaleString('en-IN')}, Paid: ₹${paymentsForThis.toLocaleString('en-IN')}, Balance Due: ₹${balanceDue.toLocaleString('en-IN')}. Due date: ${inv.due_date || 'immediate'}. Thank you!`
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
                        {role === 'owner' && (
                          <OwnerAuditBadge
                            role={role}
                            entry={store.getInvoiceAudit(inv.id)}
                            prefixLabel="Updated by"
                          />
                        )}
                      </td>
                      <td>
                        <span className="badge" style={{ background: '#f1f5f9' }}>
                          {inv.kind === 'deposit' ? 'Advance Deposit' : 'Final Settlement'}
                        </span>
                      </td>
                      <td>{inv.due_date || 'Immediate'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        ₹{inv.amount.toLocaleString('en-IN')}
                        {(inv.discount || 0) > 0 && (
                          <div style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 500 }}>
                            (₹{inv.discount} off)
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                        ₹{paymentsForThis.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: balanceDue > 0 ? '#dc2626' : '#16a34a' }}>
                        ₹{balanceDue.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span className={`badge badge-${inv.status}`}>{inv.status}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            title="Print / Save Standard A4 PDF"
                            onClick={() => setSelectedInvoiceForPrint(inv)}
                          >
                            🖨️ A4 PDF
                          </button>

                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46', fontWeight: 600 }}
                            title="Add Part Payment on same invoice"
                            onClick={() => handleOpenPartPay(inv)}
                          >
                            + Part Pay
                          </button>

                          {isFinance && (
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Edit Invoice Details"
                              onClick={() => handleOpenEdit(inv)}
                            >
                              ✏️ Edit
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8', fontWeight: 600 }}
                            title={`Send Invoice Copy to ${targetGmail}`}
                            disabled={sendingEmailId === inv.id}
                            onClick={() => handleEmailInvoice(inv)}
                          >
                            {sendingEmailId === inv.id ? '⏳...' : '📧 Gmail'}
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d', fontWeight: 600 }}
                            title="Share Invoice PDF directly to Client's WhatsApp"
                            onClick={() => setSelectedInvoiceForWhatsApp(inv)}
                          >
                            💬 WA PDF
                          </button>
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

      {/* Complete Invoice Receipts Ledger — Bank vs Cash & Destination Account */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '0.85rem' }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            💳 All Invoice Payment Receipts &amp; Account Ledger
          </h2>
          <p style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Every client receipt showing whether it came via Bank or Cash and the exact destination account holding the amount.
          </p>
        </div>

        {state.payments.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No client payments recorded yet. Click &ldquo;+ Part Pay&rdquo; on any invoice above to record Bank or Cash receipts.
          </p>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Invoice &amp; Event</th>
                  <th>Channel</th>
                  <th>Destination Account (Deposited To)</th>
                  <th>Method &amp; Reference</th>
                  <th style={{ textAlign: 'right' }}>Amount Received</th>
                  {isFinance && <th style={{ textAlign: 'center' }}>Remove</th>}
                </tr>
              </thead>
              <tbody>
                {[...state.payments]
                  .sort((a, b) => (b.paid_at || '').localeCompare(a.paid_at || ''))
                  .map((p) => {
                    const inv = state.invoices.find((i) => i.id === p.invoice_id);
                    const evt = state.events.find((e) => e.id === inv?.event_id);
                    const client = state.clients.find((c) => c.id === evt?.client_id);
                    const ch = store.inferPaymentChannel(p.method, p.payment_channel);
                    const destAcc = store.resolveDestinationAccount(p);
                    const isCash = ch === 'cash';

                    return (
                      <tr key={p.id}>
                        <td style={{ fontSize: '0.82rem' }}>
                          {new Date(p.paid_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>
                            {inv?.invoice_number || 'Invoice'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {evt?.title || 'Event'} {client?.name ? `• ${client.name}` : ''}
                          </div>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              color: isCash ? '#059669' : '#1d4ed8',
                              textTransform: 'uppercase'
                            }}
                          >
                            {isCash ? '💵 Cash' : '🏦 Bank'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.84rem' }}>
                          {destAcc}
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>
                          <div style={{ fontWeight: 600 }}>{p.method}</div>
                          {p.note && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.note}</div>}
                          {role === 'owner' && (
                            <OwnerAuditBadge
                              role={role}
                              entry={store.getEntityAudit(p.id, ['payment'])}
                              prefixLabel="Logged by"
                            />
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 800,
                            color: isCash ? '#059669' : '#1d4ed8'
                          }}
                        >
                          ₹{p.amount.toLocaleString('en-IN')}
                        </td>
                        {isFinance && (
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                if (confirm('Remove this payment receipt? Invoice and account balances will update immediately.')) {
                                  store.deletePayment(p.id);
                                }
                              }}
                            >
                              ✕
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* STRICT STANDARD A4 PORTRAIT PRINT & PDF MODAL */}
      {selectedInvoiceForPrint && (
        <div className="modal-overlay" onClick={() => setSelectedInvoiceForPrint(null)}>
          <div
            className="modal-content print-page"
            style={{
              maxWidth: '820px',
              width: '96%',
              background: '#ffffff',
              padding: '1.25rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Toolbar */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>🧾 Official Tax Invoice (Standard A4 Portrait)</span>
                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                  A4 Print Ready
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={isDownloadingPdf}
                  onClick={async () => {
                    setIsDownloadingPdf(true);
                    await downloadElementAsPdf('invoice-printable-area', `${selectedInvoiceForPrint.invoice_number}`, {
                      orientation: 'portrait'
                    });
                    setIsDownloadingPdf(false);
                  }}
                  style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {isDownloadingPdf ? '⏳ Generating A4 PDF...' : '📥 Download A4 PDF'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    document.body.classList.add('print-portrait-mode');
                    window.print();
                  }}
                >
                  🖨️ Print A4
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d', fontWeight: 600 }}
                  onClick={() => setSelectedInvoiceForWhatsApp(selectedInvoiceForPrint)}
                >
                  💬 Share WA PDF
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedInvoiceForPrint(null)}>
                  Close
                </button>
              </div>
            </div>

            {/* Standard A4 Portrait Container */}
            <div style={{ maxHeight: '82vh', overflowY: 'auto', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
              {(() => {
                const inv = selectedInvoiceForPrint;
                const evt = state.events.find((e) => e.id === inv.event_id);
                const client = state.clients.find((c) => c.id === evt?.client_id);
                const { grandTotal } = evt ? store.getEventTotal(evt.id) : { grandTotal: 0 };
                const evtItems = evt ? state.eventItems.filter((i) => i.event_id === evt.id) : [];
                const invPayments = state.payments.filter((p) => p.invoice_id === inv.id);
                const paymentsForThis = invPayments.reduce((s, p) => s + p.amount, 0);
                const subtotal = inv.subtotal !== undefined ? inv.subtotal : (grandTotal > 0 ? grandTotal : inv.amount);
                const discount = inv.discount || 0;
                const netAmount = inv.amount;
                const balanceDue = Math.max(0, netAmount - paymentsForThis);

                return (
                  <div
                    id="invoice-printable-area"
                    style={{
                      width: '100%',
                      maxWidth: '750px',
                      minHeight: '260mm',
                      padding: '2.5rem 2.25rem',
                      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                      color: '#111827',
                      background: '#ffffff',
                      margin: '0 auto',
                      boxSizing: 'border-box',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
                    }}
                  >
                    {/* Header: Logo and Title */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', borderBottom: '2px solid #0f172a', paddingBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <img
                          src="/logo.png"
                          alt="IPPAS Food Service & Events"
                          style={{ height: '64px', width: 'auto', objectFit: 'contain', display: 'block' }}
                        />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '0.5px', color: '#0f172a' }}>
                            {state.settings.name || 'IPPAS FOOD SERVICE & EVENTS'}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                            Outdoor Catering &bull; Event Management &bull; Kerala
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Phone: {state.settings.phone} &bull; Email: {state.settings.email}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <h1
                          style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontSize: '2.4rem',
                            fontWeight: 700,
                            color: '#0f172a',
                            lineHeight: 1,
                            margin: 0
                          }}
                        >
                          INVOICE
                        </h1>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.3rem', fontWeight: 600 }}>
                          #{inv.invoice_number}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                          Kind: {inv.kind === 'deposit' ? 'Advance Deposit' : 'Final Settlement'}
                        </div>
                      </div>
                    </div>

                    {/* Metadata: Billed To and Event Details */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem 1.25rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '0.3rem' }}>
                          Billed To:
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                          {client?.name || 'Valued Client'}
                        </div>
                        {client?.company && <div style={{ fontSize: '0.85rem', color: '#334155' }}>🏢 {client.company}</div>}
                        {client?.phone && <div style={{ fontSize: '0.85rem', color: '#334155' }}>📞 {client.phone}</div>}
                        {client?.email && <div style={{ fontSize: '0.85rem', color: '#334155' }}>✉️ {client.email}</div>}
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>
                          📍 Venue: {evt?.venue || 'Kerala'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', fontSize: '0.85rem', lineHeight: 1.5 }}>
                        <div><strong>Event:</strong> {evt?.title || 'Catering Order'}</div>
                        {evt?.event_date && (
                          <div>
                            <strong>Event Date:</strong> {new Date(evt.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                        {evt?.guest_count && <div><strong>Guests:</strong> {evt.guest_count} Pax</div>}
                        <div><strong>Issue Date:</strong> {new Date(inv.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        <div><strong>Due Date:</strong> {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'On Receipt'}</div>
                        <div style={{ marginTop: '0.35rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: inv.status === 'paid' ? '#dcfce7' : (balanceDue === 0 ? '#dcfce7' : '#fee2e2'),
                              color: inv.status === 'paid' ? '#15803d' : (balanceDue === 0 ? '#15803d' : '#b91c1c')
                            }}
                          >
                            Status: {balanceDue === 0 ? 'Fully Paid' : inv.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Particulars Table */}
                    <div style={{ marginBottom: '1.25rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #0f172a', background: '#f1f5f9' }}>
                            <th style={{ textAlign: 'left', padding: '0.6rem 0.5rem', fontWeight: 700 }}>Description</th>
                            <th style={{ textAlign: 'center', padding: '0.6rem 0.5rem', fontWeight: 700 }}>Unit / Type</th>
                            <th style={{ textAlign: 'right', padding: '0.6rem 0.5rem', fontWeight: 700 }}>Rate</th>
                            <th style={{ textAlign: 'right', padding: '0.6rem 0.5rem', fontWeight: 700 }}>Total (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evtItems.length > 0 ? (
                            evtItems.map((item) => {
                              const mi = state.menuItems.find((m) => m.id === item.menu_item_id);
                              const isPerKg = item.pricing_type === 'per_kg';
                              const qty = item.quantity !== undefined ? item.quantity : (isPerKg ? 1 : (evt?.guest_count || 1));
                              const rate = item.price_per_unit || item.price_per_guest || 0;
                              const lineTotal = rate * qty;

                              return (
                                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '0.55rem 0.5rem' }}>
                                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{mi?.name || 'Menu Item'}</div>
                                    {mi?.category && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{mi.category}</div>}
                                  </td>
                                  <td style={{ textAlign: 'center', padding: '0.55rem 0.5rem', color: '#334155' }}>
                                    {qty} {isPerKg ? 'Kg' : 'Pax'}
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '0.55rem 0.5rem', color: '#334155' }}>
                                    ₹{rate.toLocaleString('en-IN')} {isPerKg ? '/Kg' : '/Pax'}
                                  </td>
                                  <td style={{ textAlign: 'right', padding: '0.55rem 0.5rem', fontWeight: 600, color: '#0f172a' }}>
                                    ₹{lineTotal.toLocaleString('en-IN')}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                              <td style={{ padding: '0.6rem 0.5rem' }}>
                                <div style={{ fontWeight: 600 }}>{evt?.title || 'Catering Package'}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  {inv.kind === 'deposit' ? 'Advance Deposit Payment' : 'Final Event Settlement'}
                                </div>
                              </td>
                              <td style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>1 Lot</td>
                              <td style={{ textAlign: 'right', padding: '0.6rem 0.5rem' }}>₹{subtotal.toLocaleString('en-IN')}</td>
                              <td style={{ textAlign: 'right', padding: '0.6rem 0.5rem', fontWeight: 600 }}>₹{subtotal.toLocaleString('en-IN')}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals Section with Discount */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
                      <div style={{ width: '310px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.4rem', fontSize: '0.85rem' }}>
                          <span style={{ color: '#475569' }}>Subtotal:</span>
                          <span style={{ fontWeight: 600 }}>₹{subtotal.toLocaleString('en-IN')}</span>
                        </div>
                        {discount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.4rem', fontSize: '0.85rem', color: '#16a34a' }}>
                            <span>Discount:</span>
                            <span style={{ fontWeight: 700 }}>- ₹{discount.toLocaleString('en-IN')}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.6rem', background: '#0f172a', color: '#ffffff', borderRadius: '4px', marginTop: '0.4rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Net Invoice Total:</span>
                          <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>₹{netAmount.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>

                    {/* Part-Payments History on the SAME invoice */}
                    <div style={{ marginBottom: '1.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.85rem 1rem', background: '#f8fafc' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a' }}>
                          💳 Payment &amp; Installments History
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {invPayments.length} installment{invPayments.length === 1 ? '' : 's'} recorded
                        </span>
                      </div>

                      {invPayments.length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', padding: '0.4rem 0' }}>
                          No payments recorded yet against this invoice.
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#475569' }}>
                              <th style={{ textAlign: 'left', padding: '0.35rem 0.25rem' }}>Receipt Date</th>
                              <th style={{ textAlign: 'left', padding: '0.35rem 0.25rem' }}>Method &amp; Channel</th>
                              <th style={{ textAlign: 'left', padding: '0.35rem 0.25rem' }}>Account</th>
                              <th style={{ textAlign: 'left', padding: '0.35rem 0.25rem' }}>Note</th>
                              <th style={{ textAlign: 'right', padding: '0.35rem 0.25rem' }}>Amount Paid</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invPayments.map((p) => {
                              const ch = store.inferPaymentChannel(p.method, p.payment_channel);
                              const acc = store.resolveDestinationAccount(p);
                              return (
                                <tr key={p.id} style={{ borderBottom: '1px dashed #e2e8f0' }}>
                                  <td style={{ padding: '0.35rem 0.25rem' }}>
                                    {new Date(p.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </td>
                                  <td style={{ padding: '0.35rem 0.25rem', fontWeight: 500 }}>
                                    {p.method} ({ch === 'cash' ? 'Cash' : 'Bank'})
                                  </td>
                                  <td style={{ padding: '0.35rem 0.25rem', fontWeight: 600, color: '#0f172a' }}>
                                    {acc}
                                  </td>
                                  <td style={{ padding: '0.35rem 0.25rem', color: '#64748b' }}>{p.note || '-'}</td>
                                  <td style={{ textAlign: 'right', padding: '0.35rem 0.25rem', fontWeight: 600, color: '#16a34a' }}>
                                    ₹{p.amount.toLocaleString('en-IN')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: '0.85rem' }}>
                          <span style={{ color: '#475569' }}>Total Paid so far: </span>
                          <strong style={{ color: '#16a34a' }}>₹{paymentsForThis.toLocaleString('en-IN')}</strong>
                        </div>
                        <div style={{ fontSize: '0.9rem' }}>
                          <span style={{ color: '#475569' }}>Balance Due: </span>
                          <strong style={{ color: balanceDue > 0 ? '#dc2626' : '#16a34a', fontSize: '1.05rem' }}>
                            ₹{balanceDue.toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Bank & Signature Footer */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', alignItems: 'flex-end' }}>
                      <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.5 }}>
                        <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                          Bank &amp; Payment Details
                        </div>
                        <div>Bank: <strong>{state.settings.bank_name || 'Federal Bank / State Bank of India'}</strong></div>
                        <div>Account Name: <strong>{state.settings.account_name || state.settings.name}</strong></div>
                        <div>Account No: <strong>{state.settings.account_number || '9876-5432-1000'}</strong> &bull; IFSC: <strong>{state.settings.ifsc_code || 'FDRL0001234'}</strong></div>
                        <div>UPI ID: <strong>{state.settings.upi_id || 'ippas@upi'}</strong></div>
                        {state.settings.payment_terms && (
                          <div style={{ marginTop: '0.3rem', color: '#64748b', fontSize: '0.72rem' }}>
                            Terms: {state.settings.payment_terms}
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                          {state.settings.name}
                        </div>
                        <div style={{ marginTop: '1.75rem', paddingTop: '0.4rem', borderTop: '1px dashed #94a3b8', display: 'inline-block', minWidth: '150px', textAlign: 'center', fontSize: '0.72rem', color: '#64748b' }}>
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

      {/* PART-PAYMENT MODAL (Updates the same invoice) */}
      {partPayInvoice && (
        <div className="modal-overlay" onClick={() => setPartPayInvoice(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '95%' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                  💳 Record Part-Payment ({partPayInvoice.invoice_number})
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                  Record a part-payment installment on this same invoice.
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setPartPayInvoice(null)}>✕</button>
            </div>

            {/* Existing payments on this same invoice */}
            {(() => {
              const existingPayments = state.payments.filter((p) => p.invoice_id === partPayInvoice.id);
              const alreadyPaid = existingPayments.reduce((s, p) => s + p.amount, 0);
              const balance = Math.max(0, partPayInvoice.amount - alreadyPaid);

              return (
                <div style={{ marginBottom: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                    <span>Invoice Net Amount:</span>
                    <strong>₹{partPayInvoice.amount.toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#16a34a', marginBottom: '0.35rem' }}>
                    <span>Total Received to Date:</span>
                    <strong>₹{alreadyPaid.toLocaleString('en-IN')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: balance > 0 ? '#dc2626' : '#16a34a', fontWeight: 700, borderTop: '1px solid #e2e8f0', paddingTop: '0.35rem' }}>
                    <span>Remaining Balance Due:</span>
                    <span>₹{balance.toLocaleString('en-IN')}</span>
                  </div>

                  {existingPayments.length > 0 && (
                    <div style={{ marginTop: '0.65rem', borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                        Previous Installments:
                      </div>
                      {existingPayments.map((p) => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#334155', padding: '0.15rem 0', gap: '0.5rem' }}>
                          <span>
                            {new Date(p.paid_at).toLocaleDateString('en-GB')} &bull; {p.method} &rarr; <strong>{store.resolveDestinationAccount(p)}</strong>
                          </span>
                          <span style={{ fontWeight: 600 }}>₹{p.amount.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <form onSubmit={handleRecordPartPayment}>
              <div className="form-group">
                <label className="form-label">Payment Amount (INR ₹) *</label>
                <input
                  type="number"
                  className="form-control"
                  value={partPayForm.amount}
                  onChange={(e) => setPartPayForm({ ...partPayForm, amount: parseFloat(e.target.value) || 0 })}
                  required
                  min={1}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Payment Method *</label>
                  <select
                    className="form-control"
                    value={partPayForm.method}
                    onChange={(e) => {
                      const nextMethod = e.target.value;
                      const nextChannel = store.inferPaymentChannel(nextMethod);
                      const nextAcc = store.getDefaultDestinationAccount(nextChannel, nextMethod);
                      setPartPayForm({
                        ...partPayForm,
                        method: nextMethod,
                        payment_channel: nextChannel,
                        destination_account: nextAcc
                      });
                    }}
                  >
                    <option value="UPI / GPay">UPI / GPay / PhonePe</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Card">Debit / Credit Card</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Received Into (Bank vs Cash) *</label>
                  <select
                    className="form-control"
                    value={partPayForm.payment_channel}
                    onChange={(e) => {
                      const nextChannel = e.target.value as PaymentChannel;
                      const nextAcc = store.getDefaultDestinationAccount(nextChannel, partPayForm.method);
                      setPartPayForm({
                        ...partPayForm,
                        payment_channel: nextChannel,
                        destination_account: nextAcc
                      });
                    }}
                  >
                    <option value="bank">🏦 Bank Account</option>
                    <option value="cash">💵 Cash in Hand</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Destination Account (Deposited To) *</label>
                <select
                  className="form-control"
                  value={partPayForm.destination_account}
                  onChange={(e) => setPartPayForm({ ...partPayForm, destination_account: e.target.value })}
                >
                  {store.getPresetPaymentAccounts(partPayForm.payment_channel).map((acc) => (
                    <option key={acc.label} value={acc.label}>
                      {acc.label}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter Custom Bank / Cash Account...</option>
                </select>
              </div>

              {partPayForm.destination_account === '__custom__' && (
                <div className="form-group">
                  <label className="form-label">Custom Account / Cash Location Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={
                      partPayForm.payment_channel === 'cash'
                        ? 'e.g. Event Venue Cash Counter / Owner Safe'
                        : 'e.g. South Indian Bank (A/c 4455) / Secondary UPI'
                    }
                    value={partPayForm.custom_account}
                    onChange={(e) => setPartPayForm({ ...partPayForm, custom_account: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Reference Note / Transaction ID</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Part 1 advance, UPI Ref 410293..."
                  value={partPayForm.note}
                  onChange={(e) => setPartPayForm({ ...partPayForm, note: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPartPayInvoice(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 600 }}>
                  Save Part-Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT INVOICE MODAL (Subtotal, Discount, Status) */}
      {editingInvoice && (
        <div className="modal-overlay" onClick={() => setEditingInvoice(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '95%' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                ✏️ Edit Invoice ({editingInvoice.invoice_number})
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Subtotal (INR ₹) *</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editInvForm.subtotal}
                    onChange={(e) => setEditInvForm({ ...editInvForm, subtotal: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Discount (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={editInvForm.discount}
                    onChange={(e) => setEditInvForm({ ...editInvForm, discount: parseFloat(e.target.value) || 0 })}
                    min={0}
                  />
                </div>
              </div>

              {/* Calculated Net Amount indicator */}
              <div style={{ background: '#f1f5f9', padding: '0.6rem 0.8rem', borderRadius: '6px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>Net Payable:</span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                  ₹{Math.max(0, editInvForm.subtotal - editInvForm.discount).toLocaleString('en-IN')}
                </span>
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

      {/* Edit Bank Details Modal */}
      <EditBankDetailsModal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
      />

      {/* WhatsApp Invoice PDF Share Modal */}
      <WhatsAppShareModal
        invoice={selectedInvoiceForWhatsApp}
        isOpen={Boolean(selectedInvoiceForWhatsApp)}
        onClose={() => setSelectedInvoiceForWhatsApp(null)}
      />
    </div>
  );
}
