'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { store, StockEstimationItem } from '@/lib/store';
import { EventRecord, EventStatus, MenuItem, Invoice, Payment, PaymentChannel, PricingType, ShiftAttendanceStatus } from '@/lib/types';
import { downloadElementAsPdf } from '@/lib/downloadPdf';
import { sendInvoiceEmailNotification } from '@/lib/emailInvoice';
import OwnerAuditBadge, { formatAuditTimestamp, getActorRoleStyle } from '@/components/OwnerAuditBadge';
import InvoiceCollectionsCard from '@/components/InvoiceCollectionsCard';
import WhatsAppShareModal from '@/components/WhatsAppShareModal';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params?.id as string;

  const [state, setState] = useState(store.getState());
  const [activeTab, setActiveTab] = useState<'quote' | 'stock' | 'shifts' | 'invoices' | 'details'>('quote');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Print Modals - Standard A4 Portrait Only
  const [isPrintQuoteOpen, setIsPrintQuoteOpen] = useState(false);
  const [isPrintStockOpen, setIsPrintStockOpen] = useState(false);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [selectedInvoiceForWhatsApp, setSelectedInvoiceForWhatsApp] = useState<Invoice | null>(null);

  // Edit details form state
  const [editForm, setEditForm] = useState({
    title: '',
    event_date: '',
    start_time: '',
    end_time: '',
    venue: '',
    guest_count: 100,
    status: 'inquiry' as EventStatus,
    notes: ''
  });

  // Extra line item form
  const [extraDesc, setExtraDesc] = useState('');
  const [extraAmount, setExtraAmount] = useState<number>(0);

  // Shift assignment form
  const [shiftStaffId, setShiftStaffId] = useState('');
  const [shiftRoleLabel, setShiftRoleLabel] = useState('Server');
  const [shiftStart, setShiftStart] = useState('16:00');
  const [shiftEnd, setShiftEnd] = useState('23:00');

  // New Invoice form with Discount & Auto-Email to Gmail
  const [invKind, setInvKind] = useState<'deposit' | 'final'>('deposit');
  const [invSubtotal, setInvSubtotal] = useState<number>(50000);
  const [invDiscount, setInvDiscount] = useState<number>(0);
  const [invDueDate, setInvDueDate] = useState('');
  const [invNotes, setInvNotes] = useState('');
  const [autoEmailInvoice, setAutoEmailInvoice] = useState<boolean>(
    state.settings.auto_email_invoices !== false
  );
  const [sendingEmailInvId, setSendingEmailInvId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'info';
    message: string;
    gmailWebUrl?: string;
    mailtoUrl?: string;
  } | null>(null);

  // Edit Invoice modal state (allows editing discount & subtotal on same invoice)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editInvForm, setEditInvForm] = useState({
    subtotal: 0,
    discount: 0,
    kind: 'deposit' as 'deposit' | 'final',
    due_date: '',
    status: 'draft' as Invoice['status'],
    notes: ''
  });

  // Record Part-Payment modal state (against the same invoice, with Bank/Cash & Destination Account)
  const [partPayInvoice, setPartPayInvoice] = useState<Invoice | null>(null);
  const [partPayAmount, setPartPayAmount] = useState<number>(0);
  const [partPayMethod, setPartPayMethod] = useState('bank transfer');
  const [partPayChannel, setPartPayChannel] = useState<PaymentChannel>('bank');
  const [partPayDestAccount, setPartPayDestAccount] = useState('');
  const [partPayCustomAccount, setPartPayCustomAccount] = useState('');
  const [partPayNote, setPartPayNote] = useState('');

  // Per-kg item quantity staging when adding dishes
  const [kgQuantities, setKgQuantities] = useState<Record<string, number>>({});

  // Payment Terms state
  const [paymentTerms, setPaymentTerms] = useState<string>('');

  // Shortage Stock Procurement Modal state
  const [isShortageModalOpen, setIsShortageModalOpen] = useState(false);
  const [shortageVendorName, setShortageVendorName] = useState('Metro Wholesale / Market Supplier');
  const [shortageVendorPhone, setShortageVendorPhone] = useState('');
  const [shortageBillNo, setShortageBillNo] = useState('');
  const [shortagePaidAmt, setShortagePaidAmt] = useState<number>(0);
  const [shortageMethod, setShortageMethod] = useState('bank transfer');
  const [shortageChannel, setShortageChannel] = useState<PaymentChannel>('bank');
  const [shortageDestAccount, setShortageDestAccount] = useState('');
  const [shortageCustomAccount, setShortageCustomAccount] = useState('');
  const [shortageNotes, setShortageNotes] = useState('');

  useEffect(() => {
    setState(store.getState());
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  useEffect(() => {
    setAutoEmailInvoice(state.settings.auto_email_invoices !== false);
  }, [state.settings.auto_email_invoices]);

  const event = state.events.find((e) => e.id === eventId);
  const client = state.clients.find((c) => c.id === event?.client_id);

  useEffect(() => {
    if (event) {
      setEditForm({
        title: event.title,
        event_date: event.event_date,
        start_time: event.start_time || '',
        end_time: event.end_time || '',
        venue: event.venue || '',
        guest_count: event.guest_count,
        status: event.status,
        notes: event.notes || ''
      });
      setPaymentTerms(event.payment_terms || '');
      const totals = store.getEventTotal(event.id);
      setInvSubtotal(totals.grandTotal > 0 ? totals.grandTotal : 50000);
    }
  }, [event]);

  if (!event) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Event not found</h2>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>The event you are looking for does not exist or was removed.</p>
        <Link href="/events" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Events
        </Link>
      </div>
    );
  }

  const role = state.currentRole;
  const canEditOps = role === 'owner' || role === 'manager' || role === 'super_admin';
  const isFinance = role === 'owner' || role === 'accountant' || role === 'super_admin';
  const canEditQuote = canEditOps || isFinance;
  const auditSummary = (role === 'owner' || role === 'super_admin') ? store.getEventAuditSummary(event.id) : null;

  const { menuTotal, extrasTotal, grandTotal } = store.getEventTotal(event.id);
  const displayTotal = isFinance ? grandTotal : menuTotal;

  // Selected items
  const eventItems = state.eventItems.filter((ei) => ei.event_id === event.id);
  const selectedMenuItemIds = new Set(eventItems.map((ei) => ei.menu_item_id));

  // Event extras
  const extras = state.eventExtras.filter((x) => x.event_id === event.id);

  // Shifts for this event
  const shifts = state.shifts.filter((s) => s.event_id === event.id);

  // Invoices for this event
  const invoices = state.invoices.filter((i) => i.event_id === event.id);

  // Total Invoiced & Payments across this event
  const totalInvoicedForEvent = invoices.reduce((s, inv) => s + inv.amount, 0);
  const totalPaidForEvent = state.payments
    .filter((p) => invoices.some((i) => i.id === p.invoice_id))
    .reduce((s, p) => s + p.amount, 0);
  const remainingEventBalance = Math.max(0, grandTotal - totalPaidForEvent);

  // Automatic Stock Estimation for this event
  const stockEst = store.getEventStockEstimation(event.id);

  // Confirmed Staff Pay — strictly counted ONLY for staff marked 'present'
  let attendedStaffCost = 0;
  let attendedStaffCount = 0;
  shifts.forEach((sh) => {
    if (sh.attendance_status === 'present' && event.status !== 'cancelled') {
      attendedStaffCount += 1;
      const staffMember = state.staff.find((st) => st.id === sh.staff_member_id);
      if (staffMember) {
        const hrs = store.calculateShiftHours(sh.starts_at, sh.ends_at);
        attendedStaffCost += Math.round(hrs * Number(staffMember.hourly_rate || 0));
      }
    }
  });

  const handleUpdateDetails = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateEvent(event.id, {
      ...editForm,
      payment_terms: paymentTerms
    });
    setStatusBanner({ type: 'success', message: 'Event details updated successfully.' });
  };

  // Confirm Quotation: sets status to confirmed, creates unified master invoice, checks inventory shortages
  const handleConfirmQuotation = () => {
    store.updateEvent(event.id, {
      status: 'confirmed',
      payment_terms: paymentTerms || event.payment_terms
    });
    const masterInv = store.ensureEventInvoice(event.id);
    const updatedStockEst = store.getEventStockEstimation(event.id);

    if (updatedStockEst.totalShortageCount > 0) {
      setStatusBanner({
        type: 'info',
        message: `✓ Quotation confirmed! Unified Master Invoice #${masterInv.invoice_number} generated. ⚠️ ${updatedStockEst.totalShortageCount} raw materials required for this menu are low in warehouse stock. Please place an order below.`
      });
    } else {
      setStatusBanner({
        type: 'success',
        message: `✓ Quotation confirmed! Unified Master Invoice #${masterInv.invoice_number} generated. All required ingredients are available in warehouse.`
      });
    }
  };

  // Mark Event Completed: triggers automatic deduction of recipe ingredients from warehouse inventory
  const handleCompleteEvent = () => {
    const proceed = confirm(
      'Mark this event as completed? The quantities for all ingredients in this event menu will be automatically deducted from warehouse inventory.'
    );
    if (!proceed) return;

    store.updateEvent(event.id, { status: 'completed' });
    setStatusBanner({
      type: 'success',
      message: '🎉 Event completed successfully! Menu ingredients have been automatically deducted from warehouse stock.'
    });
  };

  // Open Shortage Order Procurement Modal
  const handleOpenShortageOrderModal = () => {
    const defaultMethod = 'bank transfer';
    const defaultChannel: PaymentChannel = 'bank';
    const defaultAcc = store.getDefaultDestinationAccount(defaultChannel, defaultMethod);
    setShortageVendorName('Metro Wholesale / Market Supplier');
    setShortageVendorPhone('');
    setShortageBillNo(`PO-${Date.now().toString().slice(-6)}`);
    setShortagePaidAmt(stockEst.totalEstimatedCost);
    setShortageMethod(defaultMethod);
    setShortageChannel(defaultChannel);
    setShortageDestAccount(defaultAcc);
    setShortageCustomAccount('');
    setShortageNotes(`Procurement for ${event.title} (${event.event_date})`);
    setIsShortageModalOpen(true);
  };

  // Place Shortage Purchase Order and auto-add to Warehouse Stock
  const handlePlaceShortagePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const shortageItems = stockEst.items.filter((it) => it.isShortage);
    if (shortageItems.length === 0) {
      alert('No shortage items detected.');
      return;
    }

    const totalCost = shortageItems.reduce((s, it) => s + it.estimatedCost, 0);
    const finalAccount =
      shortageDestAccount === '__custom__'
        ? shortageCustomAccount.trim() || store.getDefaultDestinationAccount(shortageChannel, shortageMethod)
        : shortageDestAccount || store.getDefaultDestinationAccount(shortageChannel, shortageMethod);

    store.addStockPurchase(
      {
        vendor_name: shortageVendorName || 'Wholesale Supplier',
        vendor_phone: shortageVendorPhone,
        bill_number: shortageBillNo || `PO-${Date.now().toString().slice(-6)}`,
        purchase_date: new Date().toISOString().slice(0, 10),
        items: shortageItems.map((it) => ({
          item_name: it.ingredientName,
          quantity: it.shortageQty,
          unit: it.unit,
          unit_price: it.costPerUnit || 0,
          total_price: it.estimatedCost,
          ingredient_id: it.ingredientId
        })),
        total_amount: totalCost,
        paid_amount: shortagePaidAmt,
        payment_method: `${shortageMethod} (${shortageChannel === 'cash' ? 'Cash' : 'Bank'} - ${finalAccount})`,
        notes: shortageNotes || `Shortage Stock Purchase for Event: ${event.title} (${event.event_date})`
      },
      true // updateWarehouseStock = true: directly adds purchased items to warehouse inventory!
    );

    setIsShortageModalOpen(false);
    setStatusBanner({
      type: 'success',
      message: `📦 Stock purchase order placed successfully! Purchased items have been automatically added to warehouse inventory.`
    });
  };

  // Sync Master Invoice with Latest Event Total
  const handleSyncInvoice = () => {
    store.syncInvoiceWithEventTotal(event.id);
    setStatusBanner({
      type: 'success',
      message: `Unified Master Invoice synced with the latest event total (₹${grandTotal.toLocaleString('en-IN')}).`
    });
  };

  // Save Quotation Payment Terms
  const handleSavePaymentTerms = (newTerms: string) => {
    setPaymentTerms(newTerms);
    store.updateEvent(event.id, { payment_terms: newTerms });
    setStatusBanner({
      type: 'success',
      message: 'Quotation Payment Terms updated successfully.'
    });
  };

  // Add Dish (No locking system!)
  const handleAddDish = (dish: MenuItem) => {
    const pType = dish.pricing_type || 'per_guest';
    const rate = dish.price_per_unit || dish.price_per_guest || 0;
    const customKg = kgQuantities[dish.id];
    const qty = pType === 'per_kg' ? (customKg !== undefined ? customKg : 10) : undefined;
    store.setEventItem(event.id, dish.id, rate, pType, qty);
  };

  const handleRemoveDish = (dishId: string) => {
    store.removeEventItem(event.id, dishId);
  };

  const handleUpdateItemQuantity = (eventItemId: string, newQty: number) => {
    store.updateEventItem(eventItemId, { quantity: Math.max(0.1, newQty) });
  };

  const handleAddExtra = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraDesc || extraAmount <= 0) return;
    store.addEventExtra(event.id, extraDesc, extraAmount);
    setExtraDesc('');
    setExtraAmount(0);
  };

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftStaffId) return;

    const targetStaff = state.staff.find((st) => st.id === shiftStaffId);
    const existingStaffShifts = state.shifts.filter(
      (s) => s.staff_member_id === shiftStaffId && s.id !== event.id
    );

    let hasOverlap = false;
    for (const otherShift of existingStaffShifts) {
      const otherEvt = state.events.find((ev) => ev.id === otherShift.event_id);
      if (otherEvt && otherEvt.event_date === event.event_date) {
        hasOverlap = true;
        break;
      }
    }

    if (hasOverlap) {
      const proceed = confirm(
        `⚠️ Warning: ${targetStaff?.name} is already assigned to another event/shift on ${event.event_date}! Do you want to schedule anyway?`
      );
      if (!proceed) return;
    }

    const isoStart = `${event.event_date}T${shiftStart}:00Z`;
    const isoEnd = `${event.event_date}T${shiftEnd}:00Z`;

    store.addShift({
      event_id: event.id,
      staff_member_id: shiftStaffId,
      role_label: shiftRoleLabel,
      starts_at: isoStart,
      ends_at: isoEnd
    });
  };

  const handleSendInvoiceEmail = async (inv: Invoice, isAutomatic: boolean = false) => {
    const targetEmail = state.settings.invoice_notification_email || 'ippasevents@gmail.com';
    setSendingEmailInvId(inv.id);
    const res = await sendInvoiceEmailNotification(inv, targetEmail);
    setSendingEmailInvId(null);

    if (res.success) {
      setStatusBanner({
        type: 'success',
        message: isAutomatic
          ? `Invoice ${inv.invoice_number} created and automatically emailed to ${res.sentTo}.`
          : `Invoice ${inv.invoice_number} emailed successfully to ${res.sentTo}.`
      });
    } else if (!res.configured) {
      setStatusBanner({
        type: 'info',
        message: isAutomatic
          ? `Invoice ${inv.invoice_number} created! Add SMTP_USER & SMTP_PASS in Vercel Environment Variables for silent background delivery, or send immediately to ${res.sentTo} below:`
          : `Server SMTP credentials are not configured yet. Click below to send Invoice ${inv.invoice_number} directly to ${res.sentTo}:`,
        gmailWebUrl: res.gmailWebUrl,
        mailtoUrl: res.mailtoUrl
      });
    } else {
      setStatusBanner({
        type: 'info',
        message: `Invoice ${inv.invoice_number} saved, but automatic email encountered an error (${res.error}). Use quick send to ${res.sentTo}:`,
        gmailWebUrl: res.gmailWebUrl,
        mailtoUrl: res.mailtoUrl
      });
    }
  };

  // Create Invoice with Subtotal, Discount, and Optional Auto-Email to Gmail
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const net = Math.max(0, invSubtotal - invDiscount);
    const createdInv = store.addInvoice({
      event_id: event.id,
      kind: invKind,
      subtotal: invSubtotal,
      discount: invDiscount,
      amount: net,
      due_date: invDueDate || event.event_date,
      status: 'draft',
      notes: invNotes
    });
    setInvDiscount(0);
    setInvNotes('');

    if (autoEmailInvoice) {
      await handleSendInvoiceEmail(createdInv, true);
    } else {
      setStatusBanner({
        type: 'success',
        message: `Invoice ${createdInv.invoice_number} generated successfully.`
      });
    }
  };

  // Open Edit Invoice Modal (Same Invoice editing)
  const handleOpenEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditInvForm({
      subtotal: inv.subtotal !== undefined ? inv.subtotal : inv.amount,
      discount: inv.discount || 0,
      kind: inv.kind,
      due_date: inv.due_date || '',
      status: inv.status,
      notes: inv.notes || ''
    });
  };

  const handleSaveInvoiceEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    store.updateInvoice(editingInvoice.id, {
      subtotal: editInvForm.subtotal,
      discount: editInvForm.discount,
      kind: editInvForm.kind,
      due_date: editInvForm.due_date,
      status: editInvForm.status,
      notes: editInvForm.notes
    });
    setEditingInvoice(null);
  };

  // Open Part Payment Modal (Record on the SAME invoice)
  const handleOpenPartPayment = (inv: Invoice) => {
    const paymentsForInv = state.payments
      .filter((p) => p.invoice_id === inv.id)
      .reduce((s, p) => s + p.amount, 0);
    const balance = Math.max(0, inv.amount - paymentsForInv);
    const defaultMethod = 'bank transfer';
    const defaultChannel: PaymentChannel = 'bank';
    const defaultAcc = store.getDefaultDestinationAccount(defaultChannel, defaultMethod);

    setPartPayInvoice(inv);
    setPartPayAmount(balance);
    setPartPayMethod(defaultMethod);
    setPartPayChannel(defaultChannel);
    setPartPayDestAccount(defaultAcc);
    setPartPayCustomAccount('');
    setPartPayNote(`Part payment against ${inv.invoice_number}`);
  };

  const handleSavePartPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partPayInvoice || partPayAmount <= 0) return;

    const finalAccount =
      partPayDestAccount === '__custom__'
        ? partPayCustomAccount.trim() ||
          store.getDefaultDestinationAccount(partPayChannel, partPayMethod)
        : partPayDestAccount ||
          store.getDefaultDestinationAccount(partPayChannel, partPayMethod);

    store.addPayment({
      invoice_id: partPayInvoice.id,
      amount: partPayAmount,
      method: partPayMethod,
      payment_channel: partPayChannel,
      destination_account: finalAccount,
      note: partPayNote
    });

    setPartPayInvoice(null);
    setStatusBanner({
      type: 'success',
      message: `Part-payment recorded to "${finalAccount}" (${partPayChannel === 'cash' ? 'Cash' : 'Bank'}).`
    });
  };

  return (
    <div>
      {/* Navigation Breadcrumb */}
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/events" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          &larr; Back to Events list
        </Link>
      </div>

      {statusBanner && (
        <div
          style={{
            background: statusBanner.type === 'success' ? '#dcfce7' : '#eff6ff',
            border: `1px solid ${statusBanner.type === 'success' ? '#86efac' : '#93c5fd'}`,
            color: statusBanner.type === 'success' ? '#166534' : '#1e3a8a',
            padding: '0.8rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            fontSize: '0.88rem'
          }}
        >
          <div style={{ fontWeight: 600 }}>{statusBanner.message}</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {statusBanner.gmailWebUrl && (
              <a
                href={statusBanner.gmailWebUrl}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-sm"
                style={{ fontWeight: 600 }}
              >
                📧 Send in Gmail
              </a>
            )}
            {statusBanner.mailtoUrl && (
              <a
                href={statusBanner.mailtoUrl}
                className="btn btn-secondary btn-sm"
                style={{ fontWeight: 600 }}
              >
                ✉️ Open Mail App
              </a>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setStatusBanner(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>{event.title}</h1>
            <span className={`badge badge-${event.status}`}>{event.status}</span>
          </div>
          <p className="page-subtitle">
            Client: <strong>{client?.name}</strong> {client?.company ? `(${client.company})` : ''} &bull; {event.event_date} &bull; {event.venue || 'No venue'} &bull; <strong>{event.guest_count} Guests</strong>
          </p>
        </div>

        {/* Header Actions: Status progression & A4 PDF Quotation & Total */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
            {(event.status === 'inquiry' || event.status === 'quoted') && canEditOps && (
              <button
                type="button"
                onClick={handleConfirmQuotation}
                className="btn btn-sm"
                style={{ background: '#16a34a', color: '#ffffff', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                title="Confirm quotation and auto-generate Master Invoice"
              >
                ✓ Confirm Quotation
              </button>
            )}

            {event.status === 'confirmed' && canEditOps && (
              <button
                type="button"
                onClick={handleCompleteEvent}
                className="btn btn-sm"
                style={{ background: '#2563eb', color: '#ffffff', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                title="Mark event completed and automatically deduct raw materials from inventory"
              >
                🏁 Mark Event Completed
              </button>
            )}

            {event.status === 'completed' && (
              <span className="badge" style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 700, padding: '0.35rem 0.65rem' }}>
                ✓ Completed &amp; Stock Deducted
              </span>
            )}

            <button
              onClick={() => setIsPrintQuoteOpen(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
            >
              📄 A4 Quotation PDF
            </button>
          </div>

          <div style={{ textAlign: 'right', marginTop: '0.25rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Quote Total</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--primary)' }}>
              ₹{displayTotal.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      </div>

      {/* Stock Shortage Warning / Reassurance Banner */}
      {stockEst.totalShortageCount > 0 && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '0.85rem 1.1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span>⚠️ Raw Material Shortage Detected</span>
              <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 700 }}>
                {stockEst.totalShortageCount} Raw Material Items Insufficient
              </span>
            </div>
            <div style={{ fontSize: '0.84rem', color: '#7f1d1d', marginTop: '0.25rem' }}>
              Ingredients required to prepare this menu are low in warehouse inventory. Estimated purchase cost: <strong>₹{stockEst.totalEstimatedCost.toLocaleString('en-IN')}</strong>.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: '#dc2626', color: '#ffffff', fontWeight: 700, padding: '0.4rem 0.8rem' }}
              onClick={handleOpenShortageOrderModal}
            >
              📦 Place Stock Purchase Order
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontWeight: 600 }}
              onClick={() => setActiveTab('stock')}
            >
              🔍 View Stock Details
            </button>
          </div>
        </div>
      )}

      {stockEst.totalShortageCount === 0 && stockEst.items.length > 0 && event.status === 'confirmed' && (
        <div
          style={{
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '0.65rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
            fontSize: '0.84rem'
          }}
        >
          <div style={{ color: '#166534', fontWeight: 600 }}>
            ✓ Warehouse stock is sufficient (All {stockEst.items.length} recipe raw materials are available in warehouse inventory).
          </div>
          <div style={{ fontSize: '0.78rem', color: '#15803d' }}>
            {event.stock_deducted
              ? '✓ Ingredients for this event have already been deducted from inventory.'
              : 'Ingredients will be automatically deducted from inventory upon event completion.'}
          </div>
        </div>
      )}

      {/* Owner & Super Admin Event & Quotation Login ID Attribution Banner */}
      {(role === 'owner' || role === 'super_admin') && (auditSummary?.eventAudit || auditSummary?.quoteAudit) && (
        <div
          className="no-print"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.15rem'
          }}
        >
          {auditSummary?.eventAudit && (
            <OwnerAuditBadge
              role={role}
              entry={auditSummary.eventAudit}
              prefixLabel="Event last updated by"
              variant="banner"
              showSummary
            />
          )}
          {auditSummary?.quoteAudit && (
            <OwnerAuditBadge
              role={role}
              entry={auditSummary.quoteAudit}
              prefixLabel="Quotation last edited by"
              variant="banner"
              showSummary
            />
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem', overflowX: 'auto' }}>
        <button
          className={`btn ${activeTab === 'quote' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('quote')}
        >
          🍽️ Menu &amp; Quote ({eventItems.length})
        </button>
        {canEditOps && (
          <button
            className={`btn ${activeTab === 'stock' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
            onClick={() => setActiveTab('stock')}
          >
            📦 Stock Estimation A4 ({stockEst.items.length})
          </button>
        )}
        {canEditOps && (
          <button
            className={`btn ${activeTab === 'shifts' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
            onClick={() => setActiveTab('shifts')}
          >
            👥 Staff Shifts ({shifts.length})
          </button>
        )}
        {isFinance && (
          <button
            className={`btn ${activeTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
            onClick={() => setActiveTab('invoices')}
          >
            🧾 Invoices &amp; Part-Payments ({invoices.length})
          </button>
        )}
        {canEditOps && (
          <button
            className={`btn ${activeTab === 'details' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
            onClick={() => setActiveTab('details')}
          >
            ⚙️ Edit Details
          </button>
        )}
      </div>

      {/* ----------------------------------------------------------------------------------- */}
      {/* TAB 1: MENU & QUOTE (No lock system, supports Per Guest & Per Kg) */}
      {/* ----------------------------------------------------------------------------------- */}
      {activeTab === 'quote' && (
        <div>
          <div className="grid-2">
            {/* Selected dishes quote */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 className="card-title" style={{ margin: 0 }}>
                  Event Menu ({event.guest_count} Guests)
                </h2>
                <button
                  onClick={() => setIsPrintQuoteOpen(true)}
                  className="btn btn-secondary btn-sm"
                  title="Preview Quotation A4 PDF with Logo"
                >
                  📄 A4 PDF Preview
                </button>
              </div>

              {role === 'owner' && auditSummary?.quoteAudit && (
                <div style={{ marginBottom: '0.85rem' }}>
                  <OwnerAuditBadge
                    role={role}
                    entry={auditSummary.quoteAudit}
                    prefixLabel="Last quotation edit"
                    variant="banner"
                    showSummary
                  />
                </div>
              )}

              {eventItems.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No menu items added to this quote yet. Select items from the catalog on the right.
                </p>
              ) : (
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Dish / Item</th>
                        <th>Type</th>
                        <th style={{ textAlign: 'center' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Rate</th>
                        <th style={{ textAlign: 'right' }}>Subtotal</th>
                        {canEditQuote && <th style={{ textAlign: 'center' }}>Remove</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {eventItems.map((item) => {
                        const dish = state.menuItems.find((m) => m.id === item.menu_item_id);
                        const isKg = item.pricing_type === 'per_kg';
                        const rate = item.price_per_unit || item.price_per_guest || 0;
                        const qty = isKg
                          ? (item.quantity !== undefined ? item.quantity : 1)
                          : (item.quantity !== undefined ? item.quantity : event.guest_count);
                        const lineTotal = rate * qty;

                        return (
                          <tr key={item.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{dish?.name || 'Custom Item'}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {dish?.category}
                              </div>
                              {role === 'owner' && (
                                <OwnerAuditBadge
                                  role={role}
                                  entry={store.getEntityAudit(item.id, ['quotation'])}
                                  prefixLabel="Edited by"
                                />
                              )}
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  background: isKg ? '#f0fdf4' : '#eff6ff',
                                  color: isKg ? '#166534' : '#1e40af',
                                  fontSize: '0.7rem'
                                }}
                              >
                                {isKg ? '⚖️ Per Kg' : '👥 Per Guest'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {isKg ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <input
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    className="form-control"
                                    style={{ width: '68px', padding: '0.2rem 0.35rem', textAlign: 'center', fontSize: '0.85rem' }}
                                    value={item.quantity !== undefined ? item.quantity : 10}
                                    onChange={(e) => handleUpdateItemQuantity(item.id, parseFloat(e.target.value) || 1)}
                                  />
                                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>kg</span>
                                </div>
                              ) : (
                                <span style={{ fontWeight: 600 }}>{qty} pax</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              ₹{rate.toLocaleString('en-IN')}{isKg ? '/kg' : '/pax'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                              ₹{lineTotal.toLocaleString('en-IN')}
                            </td>
                            {canEditQuote && (
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleRemoveDish(item.menu_item_id)}
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

              {/* Extras & Logistics Lines */}
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Logistics, Crockery &amp; Extra Charges
                </h3>
                {extras.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No extras or logistics fees added.</p>
                ) : (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          {canEditQuote && <th style={{ textAlign: 'center' }}>Remove</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {extras.map((ex) => (
                          <tr key={ex.id}>
                            <td>
                              <div>{ex.description}</div>
                              {role === 'owner' && (
                                <OwnerAuditBadge
                                  role={role}
                                  entry={store.getEntityAudit(ex.id, ['quotation'])}
                                  prefixLabel="Added by"
                                />
                              )}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              ₹{ex.amount.toLocaleString('en-IN')}
                            </td>
                            {canEditQuote && (
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => store.removeEventExtra(ex.id)}
                                >
                                  ✕
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add Extra Charge Form */}
                {canEditQuote && (
                  <form onSubmit={handleAddExtra} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Copper Chafing Dishes, Transport, Linen"
                      style={{ flex: 2, minWidth: '180px' }}
                      value={extraDesc}
                      onChange={(e) => setExtraDesc(e.target.value)}
                    />
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Amount ₹"
                      style={{ flex: 1, minWidth: '100px' }}
                      value={extraAmount || ''}
                      onChange={(e) => setExtraAmount(parseFloat(e.target.value) || 0)}
                    />
                    <button type="submit" className="btn btn-secondary btn-sm" style={{ fontWeight: 600 }}>
                      + Add Extra
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Menu catalog to pick from */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 className="card-title" style={{ margin: 0 }}>
                  Dish Catalog (Per Guest &amp; Per Kg)
                </h2>
                <Link href="/menu" className="btn btn-secondary btn-sm">
                  + New Dish
                </Link>
              </div>

              <div style={{ maxHeight: '550px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {state.menuItems
                  .filter((m) => m.active)
                  .map((dish) => {
                    const isSelected = selectedMenuItemIds.has(dish.id);
                    const isKg = dish.pricing_type === 'per_kg';
                    const rate = dish.price_per_unit || dish.price_per_guest || 0;

                    return (
                      <div
                        key={dish.id}
                        style={{
                          border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: isSelected ? 'var(--primary-light)' : 'white',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{dish.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.15rem' }}>
                            <span>{dish.category}</span>
                            <span>&bull;</span>
                            <span style={{ fontWeight: 700, color: isKg ? '#059669' : 'var(--primary)' }}>
                              ₹{rate} {isKg ? '/ kg' : '/ guest'}
                            </span>
                            <span
                              className="badge"
                              style={{
                                background: isKg ? '#f0fdf4' : '#eff6ff',
                                color: isKg ? '#166534' : '#1e40af',
                                fontSize: '0.65rem'
                              }}
                            >
                              {isKg ? '⚖️ Per Kg' : '👥 Per Guest'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {isKg && !isSelected && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <input
                                type="number"
                                min="1"
                                className="form-control"
                                style={{ width: '55px', padding: '0.2rem', textAlign: 'center', fontSize: '0.75rem' }}
                                value={kgQuantities[dish.id] !== undefined ? kgQuantities[dish.id] : 10}
                                onChange={(e) =>
                                  setKgQuantities({
                                    ...kgQuantities,
                                    [dish.id]: parseFloat(e.target.value) || 1
                                  })
                                }
                                placeholder="kg"
                              />
                              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>kg</span>
                            </div>
                          )}

                          {isSelected ? (
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>
                              ✓ Added
                            </span>
                          ) : (
                            canEditQuote && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleAddDish(dish)}
                              >
                                + Add
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Quotation Payment Terms & Instant Confirmation Card */}
          <div className="card" style={{ marginTop: '1.25rem', borderTop: '2px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                  📜 Quotation Payment Terms
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  Specify the advance deposit and milestone payment terms to print directly on this quotation and master invoice.
                </p>
              </div>

              {(event.status === 'inquiry' || event.status === 'quoted') && canEditOps && (
                <button
                  type="button"
                  onClick={handleConfirmQuotation}
                  className="btn btn-sm"
                  style={{ background: '#16a34a', color: '#ffffff', fontWeight: 700, padding: '0.45rem 0.9rem' }}
                >
                  ✓ Confirm Quotation
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 600 }}>Quick Presets:</span>
              {[
                '50% Advance upon confirmation, 40% 2 days prior to event, 10% on settlement',
                '30% Advance on booking, 50% on event morning, 20% post event settlement',
                '100% Full Advance prior to event setup',
                'Payment strictly due within 3 days. 50% advance deposit upon confirmation.'
              ].map((term) => (
                <button
                  key={term}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => handleSavePaymentTerms(term)}
                >
                  {term.length > 45 ? term.slice(0, 42) + '...' : term}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 50% Advance on confirmation, 40% 2 days prior, 10% on settlement"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                disabled={!canEditQuote}
                style={{ flex: 1 }}
              />
              {canEditQuote && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 600, whiteSpace: 'nowrap' }}
                  onClick={() => handleSavePaymentTerms(paymentTerms)}
                >
                  Save Terms
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------- */}
      {/* TAB 2: AUTOMATIC STOCK ESTIMATION & A4 PRINTABLE REQUISITION */}
      {/* ----------------------------------------------------------------------------------- */}
      {activeTab === 'stock' && (
        <div>
          {/* Automatic Estimation Summary Banner */}
          <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
            <div className="stats-card" style={{ borderLeft: '4px solid #2563eb' }}>
              <span className="stats-label">Raw Materials Needed</span>
              <span className="stats-value" style={{ color: '#2563eb' }}>
                {stockEst.items.length} Items
              </span>
              <span className="stats-sub">Across all selected event recipes</span>
            </div>

            <div className="stats-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <span className="stats-label">Shortage / To Purchase</span>
              <span className="stats-value" style={{ color: stockEst.totalShortageCount > 0 ? '#dc2626' : 'var(--success)' }}>
                {stockEst.totalShortageCount} Items
              </span>
              <span className="stats-sub">Warehouse quantity insufficient</span>
            </div>

            <div className="stats-card" style={{ borderLeft: '4px solid #059669' }}>
              <span className="stats-label">Estimated Purchase Cost</span>
              <span className="stats-value" style={{ color: '#059669' }}>
                ₹{stockEst.totalEstimatedCost.toLocaleString('en-IN')}
              </span>
              <span className="stats-sub">For required shortage procurement</span>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>
                  Automatic Stock Estimation
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Scaled requirement for {event.guest_count} guests &amp; kg orders compared with current warehouse inventory
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {stockEst.totalShortageCount > 0 && canEditOps && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: '#dc2626', color: '#ffffff', fontWeight: 700 }}
                    onClick={handleOpenShortageOrderModal}
                  >
                    📦 Place Purchase Order
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                  onClick={() => setIsPrintStockOpen(true)}
                >
                  🖨️ Print / Download A4 Sheet
                </button>
                <Link href="/stock" className="btn btn-secondary btn-sm">
                  Warehouse Stock &rarr;
                </Link>
              </div>
            </div>

            {stockEst.items.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No recipe ingredients linked to the selected dishes. Please configure recipes in the <strong>Menu &amp; Recipes</strong> module.
              </p>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Unit</th>
                      <th style={{ textAlign: 'right' }}>Total Needed</th>
                      <th style={{ textAlign: 'right' }}>In-Stock Qty</th>
                      <th style={{ textAlign: 'right' }}>Shortage / To Buy</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'right' }}>Est. Purchase Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockEst.items.map((item) => (
                      <tr key={item.ingredientId} style={{ background: item.isShortage ? '#fff5f5' : 'transparent' }}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.ingredientName}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Used in: {item.contributingDishes.join(', ')}
                          </div>
                        </td>
                        <td>{item.unit}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {item.qtyNeeded} {item.unit}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {item.currentStock} {item.unit}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: item.isShortage ? '#dc2626' : 'var(--text-muted)' }}>
                          {item.shortageQty > 0 ? `${item.shortageQty} ${item.unit}` : '0'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {item.isShortage ? (
                            <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c', fontWeight: 700 }}>
                              ⚠️ Shortage
                            </span>
                          ) : (
                            <span className="badge" style={{ background: '#dcfce7', color: '#15803d' }}>
                              ✓ Sufficient
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          ₹{item.estimatedCost.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------- */}
      {/* TAB 3: SHIFTS & STAFF */}
      {/* ----------------------------------------------------------------------------------- */}
      {activeTab === 'shifts' && (
        <div className="grid-2">
          {/* Shifts & Attendance Register table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
              <div>
                <h2 className="card-title" style={{ margin: 0 }}>Event Staff Attendance Register</h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  Shift pay is displayed &amp; counted ONLY when staff is marked <strong>Present</strong>.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#059669' }}>
                  Attended Pay ({attendedStaffCount}/{shifts.length}): ₹{attendedStaffCost.toLocaleString('en-IN')}
                </div>
                {(canEditOps || isFinance) && shifts.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontWeight: 700 }}
                    onClick={() => store.markEventShiftsAttendance(event.id, 'present')}
                  >
                    ✓ Mark All Present
                  </button>
                )}
              </div>
            </div>

            {shifts.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No staff shifts assigned yet. Add shifts using the form on the right.
              </p>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Role &amp; Times</th>
                      <th style={{ textAlign: 'center' }}>Attendance</th>
                      <th style={{ textAlign: 'right' }}>Shift Pay</th>
                      {canEditOps && <th style={{ textAlign: 'center' }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((sh) => {
                      const staffMember = state.staff.find((st) => st.id === sh.staff_member_id);
                      const hrs = store.calculateShiftHours(sh.starts_at, sh.ends_at);
                      const attStatus: ShiftAttendanceStatus =
                        sh.attendance_status === 'present' || sh.attendance_status === 'absent'
                          ? sh.attendance_status
                          : 'pending';
                      const isPresent = attStatus === 'present' && event.status !== 'cancelled';
                      const earnedWage = isPresent ? Math.round(hrs * Number(staffMember?.hourly_rate || 0)) : 0;

                      return (
                        <tr key={sh.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{staffMember?.name || 'Unknown'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {staffMember?.phone}
                            </div>
                            {(role === 'owner' || role === 'super_admin') && (
                              <OwnerAuditBadge
                                role={role}
                                entry={store.getEntityAudit(sh.id, ['shift'])}
                                prefixLabel="Updated by"
                              />
                            )}
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>
                            <div style={{ fontWeight: 600 }}>
                              {sh.role_label || staffMember?.role_title}
                            </div>
                            <div style={{ color: 'var(--text-muted)' }}>
                              {sh.starts_at.slice(11, 16)} - {sh.ends_at.slice(11, 16)} ({hrs} hrs)
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {canEditOps || isFinance ? (
                              <div style={{ display: 'inline-flex', gap: '0.28rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{
                                    background: attStatus === 'present' ? '#16a34a' : '#f1f5f9',
                                    color: attStatus === 'present' ? '#ffffff' : '#334155',
                                    border: `1px solid ${attStatus === 'present' ? '#15803d' : '#cbd5e1'}`,
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    padding: '0.2rem 0.45rem'
                                  }}
                                  onClick={() => store.updateShiftAttendance(sh.id, 'present')}
                                >
                                  ✓ Present
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{
                                    background: attStatus === 'absent' ? '#dc2626' : '#f1f5f9',
                                    color: attStatus === 'absent' ? '#ffffff' : '#334155',
                                    border: `1px solid ${attStatus === 'absent' ? '#b91c1c' : '#cbd5e1'}`,
                                    fontWeight: 700,
                                    fontSize: '0.72rem',
                                    padding: '0.2rem 0.45rem'
                                  }}
                                  onClick={() => store.updateShiftAttendance(sh.id, 'absent')}
                                >
                                  ✕ Absent
                                </button>
                              </div>
                            ) : (
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color:
                                    attStatus === 'present'
                                      ? '#15803d'
                                      : attStatus === 'absent'
                                      ? '#dc2626'
                                      : '#b45309'
                                }}
                              >
                                {attStatus === 'present'
                                  ? '✓ Present'
                                  : attStatus === 'absent'
                                  ? '✕ Absent'
                                  : '⏳ Pending'}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isPresent ? (
                              <span style={{ fontWeight: 800, color: '#059669' }}>
                                ₹{earnedWage.toLocaleString('en-IN')}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                            )}
                          </td>
                          {canEditOps && (
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => store.removeShift(sh.id)}
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

          {/* Add Shift Form */}
          {canEditOps && (
            <div className="card">
              <h2 className="card-title">Assign Staff Member to Shift</h2>
              <form onSubmit={handleAddShift}>
                <div className="form-group">
                  <label className="form-label">Staff Member *</label>
                  <select
                    className="form-control"
                    value={shiftStaffId}
                    onChange={(e) => setShiftStaffId(e.target.value)}
                    required
                  >
                    <option value="">Choose staff...</option>
                    {state.staff.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.role_title} - ₹{st.hourly_rate}/hr)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Event Assignment Role</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Banquet Captain, Sous Chef, Buffet Server"
                    value={shiftRoleLabel}
                    onChange={(e) => setShiftRoleLabel(e.target.value)}
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Shift Start</label>
                    <input
                      type="time"
                      className="form-control"
                      value={shiftStart}
                      onChange={(e) => setShiftStart(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Shift End</label>
                    <input
                      type="time"
                      className="form-control"
                      value={shiftEnd}
                      onChange={(e) => setShiftEnd(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    + Schedule Shift
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------------------------- */}
      {/* TAB 4: INVOICES & PART-PAYMENTS ON SAME INVOICE (With Discounts) */}
      {/* ----------------------------------------------------------------------------------- */}
      {activeTab === 'invoices' && (
        <div>
          {/* Summary Financial Bar */}
          <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
            <div className="stats-card">
              <span className="stats-label">Quote Value</span>
              <span className="stats-value">₹{grandTotal.toLocaleString('en-IN')}</span>
              <span className="stats-sub">Total event contract value</span>
            </div>
            <div className="stats-card">
              <span className="stats-label">Payments Collected</span>
              <span className="stats-value" style={{ color: 'var(--success)' }}>
                ₹{totalPaidForEvent.toLocaleString('en-IN')}
              </span>
              <span className="stats-sub">Across all part-payments</span>
            </div>
            <div className="stats-card">
              <span className="stats-label">Remaining Balance</span>
              <span className="stats-value" style={{ color: remainingEventBalance > 0 ? '#dc2626' : 'var(--text-main)' }}>
                ₹{remainingEventBalance.toLocaleString('en-IN')}
              </span>
              <span className="stats-sub">Pending client payment</span>
            </div>
          </div>

          {isFinance && (
            <InvoiceCollectionsCard
              breakdown={store.getInvoiceCollectionsBreakdown(event.id)}
              title="🏦 Event Collections — Bank vs Cash & Account Holdings"
              subtitle="Exact Bank vs Cash split and destination accounts holding client receipts for this event."
            />
          )}

          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            {/* Invoices list with Part-Payments on Same Invoice */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    Unified Master Invoice &amp; Settlement Bill
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                    Single invoice lifecycle: covers initial advance deposit through final settlement with complete payment history.
                  </p>
                </div>
                {isFinance && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    onClick={handleSyncInvoice}
                    title="Synchronize master invoice subtotal with latest event total"
                  >
                    🔄 Sync with Event Total (₹{grandTotal.toLocaleString('en-IN')})
                  </button>
                )}
              </div>
              {invoices.length === 0 ? (
                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem 0' }}>
                    No invoice generated for this event yet. You can confirm the quotation or generate the unified master invoice directly:
                  </p>
                  {isFinance && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ fontWeight: 700 }}
                      onClick={() => {
                        const inv = store.ensureEventInvoice(event.id);
                        setStatusBanner({ type: 'success', message: `Unified Master Invoice #${inv.invoice_number} generated successfully.` });
                      }}
                    >
                      ⚡ Generate Unified Master Invoice (₹{grandTotal.toLocaleString('en-IN')})
                    </button>
                  )}
                </div>
              ) : (
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Type</th>
                        <th style={{ textAlign: 'right' }}>Net Amount</th>
                        <th style={{ textAlign: 'right' }}>Paid Amount</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => {
                        const paymentsForThis = state.payments
                          .filter((p) => p.invoice_id === inv.id)
                          .reduce((s, p) => s + p.amount, 0);
                        const balance = Math.max(0, inv.amount - paymentsForThis);

                        return (
                          <tr key={inv.id}>
                            <td>
                              <div style={{ fontWeight: 700 }}>{inv.invoice_number}</div>
                              {inv.discount > 0 && (
                                <div style={{ fontSize: '0.72rem', color: '#15803d' }}>
                                  Discount: -₹{inv.discount.toLocaleString('en-IN')}
                                </div>
                              )}
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
                                {inv.kind}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              ₹{inv.amount.toLocaleString('en-IN')}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                              ₹{paymentsForThis.toLocaleString('en-IN')}
                              {balance > 0 && (
                                <div style={{ fontSize: '0.7rem', color: '#dc2626' }}>
                                  Due: ₹{balance.toLocaleString('en-IN')}
                                </div>
                              )}
                            </td>
                            <td>
                              <span className={`badge badge-${inv.status}`}>{inv.status}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <button
                                  className="btn btn-primary btn-sm"
                                  title="Print or Download Standard A4 PDF"
                                  onClick={() => setSelectedInvoiceForPrint(inv)}
                                >
                                  🖨️ A4 PDF
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

                                {isFinance && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      title={`Email Invoice to ${state.settings.invoice_notification_email || 'ippasevents@gmail.com'}`}
                                      disabled={sendingEmailInvId === inv.id}
                                      onClick={() => handleSendInvoiceEmail(inv, false)}
                                      style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8', fontWeight: 600 }}
                                    >
                                      {sendingEmailInvId === inv.id ? '⏳...' : '📧 Gmail'}
                                    </button>

                                    <button
                                      className="btn btn-secondary btn-sm"
                                      title="Record Advance Deposit or Milestone Payment on this invoice"
                                      onClick={() => handleOpenPartPayment(inv)}
                                      style={{ fontWeight: 600, background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}
                                    >
                                      + Record Advance / Pay
                                    </button>

                                    <button
                                      className="btn btn-secondary btn-sm"
                                      title="Edit Invoice Subtotal / Discount"
                                      onClick={() => handleOpenEditInvoice(inv)}
                                    >
                                      Edit
                                    </button>
                                  </>
                                )}
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

            {/* Generate Invoice with Discount Form */}
            {isFinance ? (
              <div className="card">
                <h2 className="card-title">Generate Invoice with Discount</h2>
                <form onSubmit={handleCreateInvoice}>
                  <div className="form-group">
                    <label className="form-label">Invoice Kind</label>
                    <select
                      className="form-control"
                      value={invKind}
                      onChange={(e) => setInvKind(e.target.value as any)}
                    >
                      <option value="deposit">Deposit / Advance Booking</option>
                      <option value="final">Final Balance Settlement</option>
                    </select>
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Subtotal (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        value={invSubtotal}
                        onChange={(e) => setInvSubtotal(parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Discount (₹)</label>
                      <input
                        type="number"
                        min="0"
                        className="form-control"
                        placeholder="0"
                        value={invDiscount || ''}
                        onChange={(e) => setInvDiscount(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Net Payable Amount:</span>
                    <strong style={{ fontSize: '1.15rem', color: 'var(--primary)' }}>
                      ₹{Math.max(0, invSubtotal - invDiscount).toLocaleString('en-IN')}
                    </strong>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={invDueDate}
                      onChange={(e) => setInvDueDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Invoice Notes</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 50% advance received, balance before function"
                      value={invNotes}
                      onChange={(e) => setInvNotes(e.target.value)}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.55rem',
                      padding: '0.7rem 0.8rem',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      marginBottom: '1rem'
                    }}
                  >
                    <input
                      type="checkbox"
                      id="autoEmailInvoiceToggle"
                      checked={autoEmailInvoice}
                      onChange={(e) => setAutoEmailInvoice(e.target.checked)}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <label
                      htmlFor="autoEmailInvoiceToggle"
                      style={{ fontSize: '0.82rem', color: '#1e3a8a', cursor: 'pointer', lineHeight: 1.4 }}
                    >
                      <strong>Automatically email invoice copy to Gmail</strong>
                      <div style={{ fontSize: '0.75rem', color: '#2563eb' }}>
                        Sends invoice details to{' '}
                        <strong>{state.settings.invoice_notification_email || 'ippasevents@gmail.com'}</strong>
                      </div>
                    </label>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', fontWeight: 600 }}>
                    Create Invoice
                  </button>
                </form>
              </div>
            ) : (
              <div className="card" style={{ background: '#f8fafc' }}>
                <h2 className="card-title">Invoicing Access</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  Invoices, discounts, and payments are managed exclusively by the Owner and Accountant.
                </p>
              </div>
            )}
          </div>

          {/* Part-Payments Breakdown on this Event */}
          <div className="card">
            <h2 className="card-title">Part-Payment Installment Receipts</h2>
            {state.payments.filter((p) => invoices.some((i) => i.id === p.invoice_id)).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No payments logged yet for this event. Use "+ Part Pay" on an invoice above.
              </p>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Payment Date</th>
                      <th>Applied Invoice</th>
                      <th>Channel</th>
                      <th>Destination Account</th>
                      <th>Method &amp; Notes</th>
                      <th style={{ textAlign: 'right' }}>Amount Paid</th>
                      {isFinance && <th style={{ textAlign: 'center' }}>Remove</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {state.payments
                      .filter((p) => invoices.some((i) => i.id === p.invoice_id))
                      .map((pmt) => {
                        const inv = invoices.find((i) => i.id === pmt.invoice_id);
                        const ch = store.inferPaymentChannel(pmt.method, pmt.payment_channel);
                        const destAcc = store.resolveDestinationAccount(pmt);
                        const isCash = ch === 'cash';

                        return (
                          <tr key={pmt.id}>
                            <td>{pmt.paid_at.slice(0, 10)}</td>
                            <td>
                              <span style={{ fontWeight: 700 }}>{inv?.invoice_number}</span>
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
                            <td style={{ fontSize: '0.85rem' }}>
                              <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{pmt.method}</div>
                              {pmt.note && <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>{pmt.note}</div>}
                              {role === 'owner' && (
                                <OwnerAuditBadge
                                  role={role}
                                  entry={store.getEntityAudit(pmt.id, ['payment'])}
                                  prefixLabel="Logged by"
                                />
                              )}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: isCash ? '#059669' : '#1d4ed8' }}>
                              ₹{pmt.amount.toLocaleString('en-IN')}
                            </td>
                            {isFinance && (
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => {
                                    if (confirm('Delete this payment receipt? The invoice balance will be restored.')) {
                                      store.deletePayment(pmt.id);
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
        </div>
      )}

      {/* ----------------------------------------------------------------------------------- */}
      {/* TAB 5: EDIT DETAILS */}
      {/* ----------------------------------------------------------------------------------- */}
      {activeTab === 'details' && (
        <div style={{ display: 'grid', gridTemplateColumns: role === 'owner' ? 'repeat(auto-fit, minmax(360px, 1fr))' : 'minmax(0, 750px)', gap: '1.25rem', alignItems: 'start' }}>
          <div className="card">
            <h2 className="card-title">Edit Event Specifications</h2>
            <form onSubmit={handleUpdateDetails}>
              <div className="form-group">
                <label className="form-label">Event Title</label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                  disabled={!canEditOps}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Event Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={editForm.event_date}
                    onChange={(e) => setEditForm({ ...editForm, event_date: e.target.value })}
                    required
                    disabled={!canEditOps}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Guest Count (Pax)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={editForm.guest_count}
                    onChange={(e) => setEditForm({ ...editForm, guest_count: parseInt(e.target.value) || 1 })}
                    required
                    disabled={!canEditOps}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={editForm.start_time}
                    onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                    disabled={!canEditOps}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={editForm.end_time}
                    onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                    disabled={!canEditOps}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Venue Location</label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.venue}
                  onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                  disabled={!canEditOps}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Pipeline Status</label>
                <select
                  className="form-control"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as EventStatus })}
                  disabled={!canEditOps}
                >
                  <option value="inquiry">Inquiry</option>
                  <option value="quoted">Quoted</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Quotation Payment Terms</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 50% Advance on confirmation, 40% 2 days prior, 10% on settlement"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  disabled={!canEditOps}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Operational Notes</label>
                <textarea
                  rows={3}
                  className="form-control"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  disabled={!canEditOps}
                />
              </div>

              {canEditOps && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this event? This will remove all associated shifts and quote lines.')) {
                        store.deleteEvent(event.id);
                        router.push('/events');
                      }
                    }}
                  >
                    Delete Event
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Changes
                  </button>
                </div>
              )}
            </form>
          </div>

          {role === 'owner' && (
            <div className="card" style={{ borderLeft: '4px solid #e11d48' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    🛡️ Event &amp; Quotation Audit Trail
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Visible exclusively to Owner — exact Login IDs for every event, quote, shift, or invoice change.
                  </p>
                </div>
                <span className="badge" style={{ background: '#ffe4e6', color: '#be123c', fontWeight: 800, fontSize: '0.68rem' }}>
                  OWNER ONLY
                </span>
              </div>

              {!auditSummary?.history || auditSummary.history.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  No updates recorded for this event yet.
                </p>
              ) : (
                <div style={{ maxHeight: '520px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {auditSummary.history.map((log) => {
                    const meta = getActorRoleStyle(log.actor_role);
                    return (
                      <div
                        key={log.id}
                        style={{
                          background: meta.bg,
                          border: `1px solid ${meta.border}`,
                          borderRadius: '8px',
                          padding: '0.65rem 0.8rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                background: meta.badgeBg,
                                color: meta.badgeText,
                                padding: '0.08rem 0.38rem',
                                borderRadius: '4px',
                                fontSize: '0.64rem',
                                fontWeight: 800
                              }}
                            >
                              {meta.label}
                            </span>
                            <strong style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#0f172a' }}>
                              {log.source === 'database' ? 'supabase_db' : `@${log.actor_username}`}
                            </strong>
                            <span style={{ fontSize: '0.75rem', color: '#475569' }}>
                              ({log.actor_name})
                            </span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                            {formatAuditTimestamp(log.created_at)}
                          </span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>
                          {log.summary}
                        </div>
                        {log.details && (
                          <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.12rem' }}>
                            {log.details}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------------------------- */}
      {/* MODAL 1: A4 PRINTABLE QUOTATION (STANDARD A4 PORTRAIT ONLY) */}
      {/* ----------------------------------------------------------------------------------- */}
      {isPrintQuoteOpen && (
        <div className="modal-overlay" onClick={() => setIsPrintQuoteOpen(false)}>
          <div
            className="modal-content print-page"
            style={{ maxWidth: '780px', width: '96%', background: '#ffffff' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Toolbar */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>📄 Official Quotation (Standard A4 PDF)</span>
                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                  A4 Fit
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={isDownloadingPdf}
                  onClick={async () => {
                    setIsDownloadingPdf(true);
                    await downloadElementAsPdf(
                      'quotation-printable-area',
                      `Quotation-${event.title.replace(/[^a-zA-Z0-9]/g, '_')}`,
                      { orientation: 'portrait' }
                    );
                    setIsDownloadingPdf(false);
                  }}
                  style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {isDownloadingPdf ? '⏳ Generating PDF...' : '📥 Download A4 PDF'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    window.print();
                  }}
                >
                  🖨️ Print A4
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setIsPrintQuoteOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            {/* Standard A4 Sheet Container */}
            <div style={{ overflowX: 'auto' }}>
              <div
                id="quotation-printable-area"
                style={{
                  width: '210mm',
                  minHeight: '280mm',
                  padding: '16mm 18mm',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                  color: '#111827',
                  background: '#ffffff',
                  margin: '0 auto',
                  boxSizing: 'border-box'
                }}
              >
                {/* Header with Logo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img
                      src="/logo.png"
                      alt="IPPAS Food Service & Events"
                      style={{ height: '56px', width: 'auto', objectFit: 'contain' }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0f172a' }}>
                        {state.settings.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {state.settings.address}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Phone: {state.settings.phone} &bull; {state.settings.email}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '2.4rem', margin: 0, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
                      Quotation
                    </h1>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                      Commercial Catering Proposal
                    </div>
                  </div>
                </div>

                {/* Metadata Box */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.85rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '2px' }}>
                      Client Details:
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{client?.name}</div>
                    {client?.company && <div>Company: {client.company}</div>}
                    {client?.phone && <div>Phone: {client.phone}</div>}
                    <div>Event: <strong>{event.title}</strong></div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div>Quote #: <strong>QTN-{event.id.replace(/[^0-9]/g, '').slice(-4) || '1001'}</strong></div>
                    <div>Quote Date: <strong>{new Date().toLocaleDateString('en-GB')}</strong></div>
                    <div>Event Date: <strong>{event.event_date}</strong></div>
                    <div>Venue: <strong>{event.venue || 'TBD'}</strong></div>
                    <div>Guest Count: <strong>{event.guest_count} Pax</strong></div>
                  </div>
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', marginBottom: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #0f172a', background: '#f1f5f9' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', color: '#0f172a' }}>Dish / Service Particulars</th>
                      <th style={{ textAlign: 'center', padding: '8px 10px', color: '#0f172a' }}>Type</th>
                      <th style={{ textAlign: 'center', padding: '8px 10px', color: '#0f172a' }}>Quantity</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#0f172a' }}>Rate</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', color: '#0f172a' }}>Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventItems.map((item) => {
                      const dish = state.menuItems.find((m) => m.id === item.menu_item_id);
                      const isKg = item.pricing_type === 'per_kg';
                      const rate = item.price_per_unit || item.price_per_guest || 0;
                      const qty = isKg
                        ? (item.quantity !== undefined ? item.quantity : 1)
                        : (item.quantity !== undefined ? item.quantity : event.guest_count);
                      const lineTotal = rate * qty;

                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontWeight: 600 }}>{dish?.name || 'Menu Dish'}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{dish?.category}</div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: '0.75rem' }}>
                            {isKg ? 'Per Kg' : 'Per Guest'}
                          </td>
                          <td style={{ textAlign: 'center', padding: '8px 10px', fontWeight: 600 }}>
                            {qty} {isKg ? 'kg' : 'pax'}
                          </td>
                          <td style={{ textAlign: 'right', padding: '8px 10px' }}>
                            ₹{rate.toLocaleString('en-IN')}{isKg ? '/kg' : '/pax'}
                          </td>
                          <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>
                            ₹{lineTotal.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}

                    {extras.map((ex) => (
                      <tr key={ex.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 10px' }} colSpan={2}>
                          <div style={{ fontWeight: 600 }}>{ex.description}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Logistics, Cutlery &amp; Service</div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 10px' }}>1 Lot</td>
                        <td style={{ textAlign: 'right', padding: '8px 10px' }}>₹{ex.amount.toLocaleString('en-IN')}</td>
                        <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>
                          ₹{ex.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Subtotal & Grand Total */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                  <div style={{ width: '280px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span>Food &amp; Beverage Total:</span>
                      <strong>₹{menuTotal.toLocaleString('en-IN')}</strong>
                    </div>
                    {extras.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                        <span>Logistics &amp; Extras:</span>
                        <strong>₹{extrasTotal.toLocaleString('en-IN')}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '6px', marginTop: '6px', fontSize: '1.1rem', fontWeight: 800 }}>
                      <span>Total Estimate:</span>
                      <span style={{ color: 'var(--primary)' }}>₹{displayTotal.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Payment & Bank Details */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem', fontSize: '0.8rem' }}>
                  <div>
                    <div style={{ fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', marginBottom: '4px' }}>
                      Official Bank Details &amp; Payment Terms
                    </div>
                    <div>Bank: <strong>{state.settings.bank_name || 'Federal Bank'}</strong></div>
                    <div>Account Name: <strong>{state.settings.account_name || state.settings.name}</strong></div>
                    <div>A/C No: <strong>{state.settings.account_number || '9876-5432-1000'}</strong> &bull; IFSC: <strong>{state.settings.ifsc_code || 'FDRL0001234'}</strong></div>
                    <div>UPI ID: <strong>{state.settings.upi_id || 'ippas@upi'}</strong></div>
                    <div style={{ marginTop: '4px', color: '#dc2626', fontWeight: 600 }}>
                      {state.settings.payment_terms || 'Payment strictly due within 3 days. 50% advance deposit upon confirmation.'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                    <div style={{ borderTop: '1px dashed #94a3b8', width: '160px', textAlign: 'center', paddingTop: '4px', fontSize: '0.75rem', color: '#64748b' }}>
                      Authorized Signatory
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------- */}
      {/* MODAL 2: A4 PRINTABLE STOCK ESTIMATION SHEET (AUTOMATIC ESTIMATION PRINT) */}
      {/* ----------------------------------------------------------------------------------- */}
      {isPrintStockOpen && (
        <div className="modal-overlay" onClick={() => setIsPrintStockOpen(false)}>
          <div
            className="modal-content print-page"
            style={{ maxWidth: '780px', width: '96%', background: '#ffffff' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Toolbar */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>📦 Event Stock Estimation (A4 Requisition Sheet)</span>
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
                    await downloadElementAsPdf(
                      'stock-estimation-printable-area',
                      `Stock-Estimation-${event.title.replace(/[^a-zA-Z0-9]/g, '_')}`,
                      { orientation: 'portrait' }
                    );
                    setIsDownloadingPdf(false);
                  }}
                  style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {isDownloadingPdf ? '⏳ Generating PDF...' : '📥 Download A4 PDF'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    window.print();
                  }}
                >
                  🖨️ Print A4
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setIsPrintStockOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            {/* Standard A4 Sheet Container */}
            <div style={{ overflowX: 'auto' }}>
              <div
                id="stock-estimation-printable-area"
                style={{
                  width: '210mm',
                  minHeight: '280mm',
                  padding: '16mm 18mm',
                  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                  color: '#111827',
                  background: '#ffffff',
                  margin: '0 auto',
                  boxSizing: 'border-box'
                }}
              >
                {/* Header with Logo */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <img
                      src="/logo.png"
                      alt="IPPAS Food Service & Events"
                      style={{ height: '56px', width: 'auto', objectFit: 'contain' }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0f172a' }}>
                        {state.settings.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Central Kitchen &amp; Warehouse Inventory Requisition
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '2rem', margin: 0, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
                      Stock Requisition
                    </h1>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                      Stock Estimation Sheet (A4)
                    </div>
                  </div>
                </div>

                {/* Event Particulars Banner */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.85rem' }}>
                  <div>
                    <div>Event Title: <strong>{event.title}</strong></div>
                    <div>Client: <strong>{client?.name}</strong> {client?.phone && `(${client.phone})`}</div>
                    <div>Venue: <strong>{event.venue || 'TBD'}</strong></div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div>Event Date: <strong>{event.event_date}</strong></div>
                    <div>Guest Count: <strong>{event.guest_count} Pax</strong></div>
                    <div>Dishes Selected: <strong>{eventItems.length} Items</strong></div>
                  </div>
                </div>

                {/* Stock Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #0f172a', background: '#f1f5f9' }}>
                      <th style={{ textAlign: 'left', padding: '7px 8px', color: '#0f172a' }}>Raw Ingredient</th>
                      <th style={{ textAlign: 'center', padding: '7px 8px', color: '#0f172a' }}>Unit</th>
                      <th style={{ textAlign: 'right', padding: '7px 8px', color: '#0f172a' }}>Total Needed</th>
                      <th style={{ textAlign: 'right', padding: '7px 8px', color: '#0f172a' }}>Current Stock</th>
                      <th style={{ textAlign: 'right', padding: '7px 8px', color: '#0f172a' }}>Shortage / To Buy</th>
                      <th style={{ textAlign: 'right', padding: '7px 8px', color: '#0f172a' }}>Unit Rate</th>
                      <th style={{ textAlign: 'right', padding: '7px 8px', color: '#0f172a' }}>Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockEst.items.map((item) => (
                      <tr key={item.ingredientId} style={{ borderBottom: '1px solid #e2e8f0', background: item.isShortage ? '#fff5f5' : 'transparent' }}>
                        <td style={{ padding: '7px 8px' }}>
                          <div style={{ fontWeight: 600 }}>{item.ingredientName}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                            {item.contributingDishes.join(', ')}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '7px 8px' }}>{item.unit}</td>
                        <td style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 600 }}>
                          {item.qtyNeeded}
                        </td>
                        <td style={{ textAlign: 'right', padding: '7px 8px' }}>
                          {item.currentStock}
                        </td>
                        <td style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 700, color: item.isShortage ? '#dc2626' : '#64748b' }}>
                          {item.shortageQty > 0 ? `${item.shortageQty} ${item.unit}` : '0'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '7px 8px' }}>₹{item.costPerUnit}</td>
                        <td style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 700 }}>
                          ₹{item.estimatedCost.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Estimation Cost Totals */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 14px', marginBottom: '24px' }}>
                  <div style={{ fontSize: '0.85rem' }}>
                    <div>Total Shortage Items: <strong>{stockEst.totalShortageCount} of {stockEst.items.length}</strong></div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Kitchen requisition required prior to event prep</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Total Estimated Procurement Cost</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#059669' }}>
                      ₹{stockEst.totalEstimatedCost.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Signatures Block */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem', marginTop: '30px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: '0.8rem', color: '#475569' }}>
                  <div>
                    <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '6px' }}>
                      Prepared By (Head Chef)
                    </div>
                  </div>
                  <div>
                    <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '6px' }}>
                      Verified By (Storekeeper)
                    </div>
                  </div>
                  <div>
                    <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '6px' }}>
                      Approved By (Owner / Manager)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------- */}
      {/* MODAL 3: A4 PRINTABLE INVOICE (STANDARD A4 PORTRAIT WITH PART-PAYMENTS & DISCOUNTS) */}
      {/* ----------------------------------------------------------------------------------- */}
      {selectedInvoiceForPrint && (
        <div className="modal-overlay" onClick={() => setSelectedInvoiceForPrint(null)}>
          <div
            className="modal-content print-page"
            style={{ maxWidth: '780px', width: '96%', background: '#ffffff' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Toolbar */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>🧾 Official Tax Invoice (Standard A4 PDF)</span>
                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                  A4 Fit
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={isDownloadingPdf}
                  onClick={async () => {
                    setIsDownloadingPdf(true);
                    await downloadElementAsPdf(
                      'event-invoice-printable-area',
                      `${selectedInvoiceForPrint.invoice_number}`,
                      { orientation: 'portrait' }
                    );
                    setIsDownloadingPdf(false);
                  }}
                  style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {isDownloadingPdf ? '⏳ Generating PDF...' : '📥 Download A4 PDF'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
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

            {/* Standard A4 Sheet Container */}
            <div style={{ overflowX: 'auto' }}>
              {(() => {
                const inv = selectedInvoiceForPrint;
                const paymentsForThis = state.payments.filter((p) => p.invoice_id === inv.id);
                const totalPaidThis = paymentsForThis.reduce((s, p) => s + p.amount, 0);
                const balanceDue = Math.max(0, inv.amount - totalPaidThis);

                return (
                  <div
                    id="event-invoice-printable-area"
                    style={{
                      width: '210mm',
                      minHeight: '280mm',
                      padding: '16mm 18mm',
                      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                      color: '#111827',
                      background: '#ffffff',
                      margin: '0 auto',
                      boxSizing: 'border-box'
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <img
                          src="/logo.png"
                          alt="IPPAS Food Service & Events"
                          style={{ height: '56px', width: 'auto', objectFit: 'contain' }}
                        />
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0f172a' }}>
                            {state.settings.name}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {state.settings.address}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            Phone: {state.settings.phone} &bull; {state.settings.email}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '2.4rem', margin: 0, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
                          Invoice
                        </h1>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                          Official Bill / Receipt
                        </div>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.85rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '2px' }}>
                          Billed To:
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{client?.name}</div>
                        {client?.company && <div>Company: {client.company}</div>}
                        {client?.phone && <div>Phone: {client.phone}</div>}
                        <div>Event: <strong>{event.title}</strong></div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div>Invoice No: <strong>{inv.invoice_number}</strong></div>
                        <div>Date Issued: <strong>{new Date(inv.created_at).toLocaleDateString('en-GB')}</strong></div>
                        <div>Due Date: <strong>{inv.due_date || 'Upon Receipt'}</strong></div>
                        <div>Type: <strong>{inv.kind === 'final' ? 'Final Settlement' : 'Advance Deposit'}</strong></div>
                      </div>
                    </div>

                    {/* Bill Particulars */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', marginBottom: '16px' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #0f172a', background: '#f1f5f9' }}>
                          <th style={{ textAlign: 'left', padding: '8px 10px', color: '#0f172a' }}>Description</th>
                          <th style={{ textAlign: 'center', padding: '8px 10px', color: '#0f172a' }}>Guests / Pax</th>
                          <th style={{ textAlign: 'right', padding: '8px 10px', color: '#0f172a' }}>Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px 10px' }}>
                            <div style={{ fontWeight: 700 }}>
                              {inv.kind === 'final' ? 'Final Catering Contract Settlement' : 'Advance Booking Deposit'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Event: {event.title} on {event.event_date} at {event.venue || 'Client Venue'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 10px' }}>{event.guest_count} pax</td>
                          <td style={{ textAlign: 'right', padding: '10px 10px', fontWeight: 600 }}>
                            ₹{(inv.subtotal || inv.amount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Subtotal, Discount & Net Payable */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                      <div style={{ width: '300px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                          <span>Subtotal:</span>
                          <strong>₹{(inv.subtotal || inv.amount).toLocaleString('en-IN')}</strong>
                        </div>

                        {inv.discount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#15803d' }}>
                            <span>Special Discount:</span>
                            <strong>- ₹{inv.discount.toLocaleString('en-IN')}</strong>
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '6px', marginTop: '6px', fontSize: '1.05rem', fontWeight: 800 }}>
                          <span>Net Invoiced Amount:</span>
                          <strong>₹{inv.amount.toLocaleString('en-IN')}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Part-Payments Table on Same Invoice */}
                    {paymentsForThis.length > 0 && (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px', marginBottom: '16px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: '#0f172a', marginBottom: '6px' }}>
                          Payment Installments Received:
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b' }}>
                              <th style={{ textAlign: 'left', padding: '4px' }}>Date</th>
                              <th style={{ textAlign: 'left', padding: '4px' }}>Method &amp; Channel</th>
                              <th style={{ textAlign: 'left', padding: '4px' }}>Account</th>
                              <th style={{ textAlign: 'left', padding: '4px' }}>Note</th>
                              <th style={{ textAlign: 'right', padding: '4px' }}>Amount Paid</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentsForThis.map((pmt) => {
                              const ch = store.inferPaymentChannel(pmt.method, pmt.payment_channel);
                              const acc = store.resolveDestinationAccount(pmt);
                              return (
                                <tr key={pmt.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '4px' }}>{pmt.paid_at.slice(0, 10)}</td>
                                  <td style={{ padding: '4px', textTransform: 'capitalize' }}>
                                    {pmt.method} ({ch === 'cash' ? 'Cash' : 'Bank'})
                                  </td>
                                  <td style={{ padding: '4px', fontWeight: 600, color: '#0f172a' }}>{acc}</td>
                                  <td style={{ padding: '4px', color: '#64748b' }}>{pmt.note || '—'}</td>
                                  <td style={{ padding: '4px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                                    ₹{pmt.amount.toLocaleString('en-IN')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '6px', marginTop: '6px', fontSize: '0.9rem', fontWeight: 700 }}>
                          <span>Total Paid So Far: ₹{totalPaidThis.toLocaleString('en-IN')}</span>
                          <span style={{ color: balanceDue > 0 ? '#dc2626' : 'var(--success)' }}>
                            Balance Due: ₹{balanceDue.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Bank Details & Terms */}
                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem', fontSize: '0.8rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', marginBottom: '4px' }}>
                          Official Bank Details &amp; Payment Instructions
                        </div>
                        <div>Bank: <strong>{state.settings.bank_name || 'Federal Bank'}</strong></div>
                        <div>Account Name: <strong>{state.settings.account_name || state.settings.name}</strong></div>
                        <div>A/C No: <strong>{state.settings.account_number || '9876-5432-1000'}</strong> &bull; IFSC: <strong>{state.settings.ifsc_code || 'FDRL0001234'}</strong></div>
                        <div>UPI ID: <strong>{state.settings.upi_id || 'ippas@upi'}</strong></div>
                        <div style={{ marginTop: '4px', color: '#dc2626', fontWeight: 600 }}>
                          {state.settings.payment_terms || 'Payment strictly due within 3 days.'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                        <div style={{ borderTop: '1px dashed #94a3b8', width: '160px', textAlign: 'center', paddingTop: '4px', fontSize: '0.75rem', color: '#64748b' }}>
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

      {/* ----------------------------------------------------------------------------------- */}
      {/* MODAL 4: EDIT INVOICE MODAL (SUBTOTAL / DISCOUNT ON SAME INVOICE) */}
      {/* ----------------------------------------------------------------------------------- */}
      {editingInvoice && (
        <div className="modal-overlay" onClick={() => setEditingInvoice(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                Edit Invoice {editingInvoice.invoice_number}
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingInvoice(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveInvoiceEdit}>
              <div className="form-group">
                <label className="form-label">Subtotal (₹) *</label>
                <input
                  type="number"
                  min="0"
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
                  min="0"
                  className="form-control"
                  value={editInvForm.discount}
                  onChange={(e) => setEditInvForm({ ...editInvForm, discount: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem' }}>Net Amount:</span>
                <strong style={{ color: 'var(--primary)' }}>
                  ₹{Math.max(0, editInvForm.subtotal - editInvForm.discount).toLocaleString('en-IN')}
                </strong>
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
                  <option value="sent">Sent to Client</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid in Full</option>
                  <option value="void">Void</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingInvoice(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 600 }}>
                  Save Invoice Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------- */}
      {/* MODAL 5: RECORD PART-PAYMENT MODAL (ON SAME INVOICE) */}
      {/* ----------------------------------------------------------------------------------- */}
      {partPayInvoice && (
        <div className="modal-overlay" onClick={() => setPartPayInvoice(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  Record Part-Payment
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Against Invoice <strong>{partPayInvoice.invoice_number}</strong> (Net: ₹{partPayInvoice.amount.toLocaleString('en-IN')})
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setPartPayInvoice(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePartPayment}>
              <div className="form-group">
                <label className="form-label">Payment Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  value={partPayAmount || ''}
                  onChange={(e) => setPartPayAmount(parseFloat(e.target.value) || 0)}
                  required
                  autoFocus
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Payment Mode *</label>
                  <select
                    className="form-control"
                    value={partPayMethod}
                    onChange={(e) => {
                      const nextMethod = e.target.value;
                      const nextChannel = store.inferPaymentChannel(nextMethod);
                      const nextAcc = store.getDefaultDestinationAccount(nextChannel, nextMethod);
                      setPartPayMethod(nextMethod);
                      setPartPayChannel(nextChannel);
                      setPartPayDestAccount(nextAcc);
                    }}
                  >
                    <option value="bank transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="upi">UPI / GPay / PhonePe</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="card">Card</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Received Into (Bank vs Cash) *</label>
                  <select
                    className="form-control"
                    value={partPayChannel}
                    onChange={(e) => {
                      const nextChannel = e.target.value as PaymentChannel;
                      const nextAcc = store.getDefaultDestinationAccount(nextChannel, partPayMethod);
                      setPartPayChannel(nextChannel);
                      setPartPayDestAccount(nextAcc);
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
                  value={partPayDestAccount}
                  onChange={(e) => setPartPayDestAccount(e.target.value)}
                >
                  {store.getPresetPaymentAccounts(partPayChannel).map((acc) => (
                    <option key={acc.label} value={acc.label}>
                      {acc.label}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter Custom Bank / Cash Account...</option>
                </select>
              </div>

              {partPayDestAccount === '__custom__' && (
                <div className="form-group">
                  <label className="form-label">Custom Account / Cash Location Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={
                      partPayChannel === 'cash'
                        ? 'e.g. Venue Cash Counter / Owner Safe'
                        : 'e.g. South Indian Bank (A/c 4455)'
                    }
                    value={partPayCustomAccount}
                    onChange={(e) => setPartPayCustomAccount(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Payment Note / Installment Details</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 1st Advance Installment, 2nd Part Payment"
                  value={partPayNote}
                  onChange={(e) => setPartPayNote(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setPartPayInvoice(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 600 }}>
                  Save Payment Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------- */}
      {/* MODAL 6: SHORTAGE STOCK PROCUREMENT (PLACE ORDER & AUTO-ADD TO WAREHOUSE INVENTORY) */}
      {/* ----------------------------------------------------------------------------------- */}
      {isShortageModalOpen && (
        <div className="modal-overlay" onClick={() => setIsShortageModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  📦 Place Stock Purchase Order
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Auto-populated missing raw materials needed for <strong>{event.title}</strong>. Purchasing will automatically add these items into warehouse inventory.
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsShortageModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handlePlaceShortagePurchase}>
              {/* Shortage Items Table */}
              <div style={{ marginBottom: '1rem', border: '1px solid #fee2e2', borderRadius: '8px', background: '#fff5f5', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#b91c1c', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Shortage Ingredients to Procure ({stockEst.items.filter((it) => it.isShortage).length} items):</span>
                  <span>Est. Cost: ₹{stockEst.totalEstimatedCost.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#ffffff', borderRadius: '6px', border: '1px solid #fecaca' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: '#fef2f2', borderBottom: '1px solid #fecaca', textAlign: 'left', color: '#991b1b' }}>
                        <th style={{ padding: '4px 8px' }}>Ingredient</th>
                        <th style={{ padding: '4px 8px', textAlign: 'right' }}>Shortage Qty</th>
                        <th style={{ padding: '4px 8px', textAlign: 'right' }}>Est. Rate</th>
                        <th style={{ padding: '4px 8px', textAlign: 'right' }}>Total Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockEst.items
                        .filter((it) => it.isShortage)
                        .map((item) => (
                          <tr key={item.ingredientId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '4px 8px', fontWeight: 600 }}>{item.ingredientName}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                              {item.shortageQty} {item.unit}
                            </td>
                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>₹{item.costPerUnit}</td>
                            <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700 }}>
                              ₹{item.estimatedCost.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Vendor / Wholesale Supplier Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Metro Wholesale / Market Supplier"
                    value={shortageVendorName}
                    onChange={(e) => setShortageVendorName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Vendor Phone (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. +91 98460 11223"
                    value={shortageVendorPhone}
                    onChange={(e) => setShortageVendorPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Purchase Bill / PO Reference #</label>
                  <input
                    type="text"
                    className="form-control"
                    value={shortageBillNo}
                    onChange={(e) => setShortageBillNo(e.target.value)}
                    placeholder="e.g. PO-784920"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount Paid Now (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={shortagePaidAmt || ''}
                    onChange={(e) => setShortagePaidAmt(parseFloat(e.target.value) || 0)}
                    placeholder="Amount paid"
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Payment Channel *</label>
                  <select
                    className="form-control"
                    value={shortageChannel}
                    onChange={(e) => {
                      const nextCh = e.target.value as PaymentChannel;
                      const nextAcc = store.getDefaultDestinationAccount(nextCh, shortageMethod);
                      setShortageChannel(nextCh);
                      setShortageDestAccount(nextAcc);
                    }}
                  >
                    <option value="bank">🏦 Bank Account</option>
                    <option value="cash">💵 Cash in Hand</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Paid From Account *</label>
                  <select
                    className="form-control"
                    value={shortageDestAccount}
                    onChange={(e) => setShortageDestAccount(e.target.value)}
                  >
                    {store.getPresetPaymentAccounts(shortageChannel).map((acc) => (
                      <option key={acc.label} value={acc.label}>
                        {acc.label}
                      </option>
                    ))}
                    <option value="__custom__">+ Enter Custom Account...</option>
                  </select>
                </div>
              </div>

              {shortageDestAccount === '__custom__' && (
                <div className="form-group">
                  <label className="form-label">Custom Account Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Main Kitchen Petty Cash"
                    value={shortageCustomAccount}
                    onChange={(e) => setShortageCustomAccount(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Procurement Note</label>
                <input
                  type="text"
                  className="form-control"
                  value={shortageNotes}
                  onChange={(e) => setShortageNotes(e.target.value)}
                  placeholder="Notes for procurement"
                />
              </div>

              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.65rem 0.85rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#166534' }}>
                ⚡ <strong>Automatic Warehouse Inventory Adding:</strong> Upon confirming this order, all {stockEst.items.filter((it) => it.isShortage).length} shortage items will be automatically credited to warehouse inventory, clearing the shortage immediately!
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsShortageModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 700, background: '#16a34a', borderColor: '#15803d' }}>
                  ✓ Confirm Order &amp; Auto-Add to Warehouse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Invoice PDF Share Modal */}
      <WhatsAppShareModal
        invoice={selectedInvoiceForWhatsApp}
        isOpen={Boolean(selectedInvoiceForWhatsApp)}
        onClose={() => setSelectedInvoiceForWhatsApp(null)}
      />
    </div>
  );
}
