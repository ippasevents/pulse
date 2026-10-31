'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { store, StockEstimationItem, EVENT_EXPENSE_CATEGORY_LABELS } from '@/lib/store';
import {
  EventRecord,
  EventStatus,
  MenuItem,
  Invoice,
  Payment,
  PaymentChannel,
  PricingType,
  ShiftAttendanceStatus,
  EventExpense,
  EventExpenseCategory,
  Shift
} from '@/lib/types';
import { downloadElementAsPdf } from '@/lib/downloadPdf';
import { printElementById } from '@/lib/printDocument';
import { parseAuditDetails } from '@/lib/auditDiff';
import OwnerAuditBadge, { formatAuditTimestamp, getActorRoleStyle } from '@/components/OwnerAuditBadge';
import InvoiceCollectionsCard from '@/components/InvoiceCollectionsCard';
import WhatsAppShareModal from '@/components/WhatsAppShareModal';
import QuotationWhatsAppModal from '@/components/QuotationWhatsAppModal';
import StaffWhatsAppModal from '@/components/StaffWhatsAppModal';
import { formatDisplayWhatsAppPhone } from '@/lib/staffWhatsApp';
import { exportEventStockShortageCsv } from '@/lib/inventoryCsvExport';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params?.id as string;

  const [state, setState] = useState(store.getState());
  const [activeTab, setActiveTab] = useState<'quote' | 'stock' | 'shifts' | 'expenses' | 'invoices' | 'details'>('quote');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [autoPrintTarget, setAutoPrintTarget] = useState<'quote' | 'stock' | 'invoice' | null>(null);

  // Print & WhatsApp Modals - Standard A4 Portrait Only
  const [isPrintQuoteOpen, setIsPrintQuoteOpen] = useState(false);
  const [isQuoteWhatsAppOpen, setIsQuoteWhatsAppOpen] = useState(false);
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

  // Shift assignment form + WhatsApp notification controls
  const [shiftStaffId, setShiftStaffId] = useState('');
  const [shiftRoleLabel, setShiftRoleLabel] = useState('Server');
  const [shiftStart, setShiftStart] = useState('16:00');
  const [shiftEnd, setShiftEnd] = useState('23:00');
  const [shiftDutyNote, setShiftDutyNote] = useState('');
  const [autoNotifyWhatsApp, setAutoNotifyWhatsApp] = useState(true);
  const [isStaffWhatsAppOpen, setIsStaffWhatsAppOpen] = useState(false);
  const [selectedShiftForWhatsApp, setSelectedShiftForWhatsApp] = useState<Shift | null>(null);
  const [shiftModalInitialNote, setShiftModalInitialNote] = useState('');

  // Unified Invoice Conversion / Modification Form state
  const [invSubtotal, setInvSubtotal] = useState<number>(0);
  const [invDiscount, setInvDiscount] = useState<number>(0);
  const [invDiscountNote, setInvDiscountNote] = useState<string>('');
  const [invDueDate, setInvDueDate] = useState('');
  const [invNotes, setInvNotes] = useState('');
  const [invShowBankDetails, setInvShowBankDetails] = useState<boolean>(true);
  const [invShowPaymentDetails, setInvShowPaymentDetails] = useState<boolean>(true);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'info';
    message: string;
  } | null>(null);

  // Edit Invoice modal state (allows editing discount, discount_note & visibility on same invoice)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editInvForm, setEditInvForm] = useState({
    subtotal: 0,
    discount: 0,
    discount_note: '',
    kind: 'deposit' as 'deposit' | 'final',
    due_date: '',
    status: 'draft' as Invoice['status'],
    show_bank_details: true,
    show_payment_details: true,
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

  // Event Extra Expenses state (Owner, Accountant & Manager)
  const [expCategory, setExpCategory] = useState<EventExpenseCategory>('stock_pricing');
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expDate, setExpDate] = useState('');
  const [expNotes, setExpNotes] = useState('');
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Event-linked Staff Allowance quick entry state
  const [allowanceStaffId, setAllowanceStaffId] = useState('');
  const [allowanceAmount, setAllowanceAmount] = useState<number>(0);
  const [allowanceMethod, setAllowanceMethod] = useState('Duty Allowance');
  const [allowanceNote, setAllowanceNote] = useState('');

  useEffect(() => {
    setState(store.getState());
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  // Trigger isolated document-only print when direct Print icon is clicked
  useEffect(() => {
    if (!autoPrintTarget) return;
    const timer = setTimeout(() => {
      if (autoPrintTarget === 'quote') {
        printElementById('quotation-printable-area', {
          title: 'Catering-Quotation',
          orientation: 'portrait'
        });
      } else if (autoPrintTarget === 'stock') {
        printElementById('stock-estimation-printable-area', {
          title: 'Stock-Requisition-Sheet',
          orientation: 'portrait'
        });
      } else if (autoPrintTarget === 'invoice') {
        printElementById('event-invoice-printable-area', {
          title: 'Event-Invoice',
          orientation: 'portrait'
        });
      }
      setAutoPrintTarget(null);
    }, 180);
    return () => clearTimeout(timer);
  }, [autoPrintTarget]);

  const event = state.events.find((e) => e.id === eventId);
  const client = state.clients.find((c) => c.id === event?.client_id);
  const activeMasterInv = state.invoices.find(
    (i) => i.event_id === eventId && i.status !== 'void'
  );

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
      if (activeMasterInv) {
        setInvSubtotal(
          activeMasterInv.subtotal !== undefined
            ? activeMasterInv.subtotal
            : activeMasterInv.amount
        );
        setInvDiscount(activeMasterInv.discount || 0);
        setInvDiscountNote(activeMasterInv.discount_note || '');
        setInvDueDate(activeMasterInv.due_date || event.event_date || '');
        setInvNotes(activeMasterInv.notes || '');
        setInvShowBankDetails(activeMasterInv.show_bank_details !== false);
        setInvShowPaymentDetails(activeMasterInv.show_payment_details !== false);
      } else {
        setInvSubtotal(totals.grandTotal);
        setInvDueDate(event.event_date || '');
        setInvShowBankDetails(event.show_bank_details !== false);
        setInvShowPaymentDetails(event.show_payment_details !== false);
      }
    }
  }, [
    event?.id,
    event?.title,
    event?.event_date,
    event?.start_time,
    event?.end_time,
    event?.venue,
    event?.guest_count,
    event?.status,
    event?.notes,
    event?.payment_terms,
    event?.show_bank_details,
    event?.show_payment_details,
    activeMasterInv?.id,
    activeMasterInv?.subtotal,
    activeMasterInv?.amount,
    activeMasterInv?.discount,
    activeMasterInv?.discount_note,
    activeMasterInv?.due_date,
    activeMasterInv?.notes,
    activeMasterInv?.show_bank_details,
    activeMasterInv?.show_payment_details
  ]);

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
  const isOwnerOnly = role === 'owner' || role === 'super_admin';
  const canEditOps = role === 'owner' || role === 'manager' || role === 'super_admin';
  const isFinance = role === 'owner' || role === 'accountant' || role === 'super_admin';
  const canManageEventExpenses =
    role === 'owner' || role === 'accountant' || role === 'manager' || role === 'super_admin';
  const canEditQuote = canEditOps || isFinance;
  const auditSummary = isOwnerOnly ? store.getEventAuditSummary(event.id) : null;

  const { menuTotal, extrasTotal, grandTotal } = store.getEventTotal(event.id);
  const displayTotal = isFinance ? grandTotal : menuTotal;
  const finSummary = store.getEventFinancialSummary(event.id);

  // Selected items
  const eventItems = state.eventItems.filter((ei) => ei.event_id === event.id);
  const selectedMenuItemIds = new Set(eventItems.map((ei) => ei.menu_item_id));

  // Event extras
  const extras = state.eventExtras.filter((x) => x.event_id === event.id);

  // Shifts for this event
  const shifts = state.shifts.filter((s) => s.event_id === event.id);

  // Invoices & Distinct Quotation Number for this event
  const quoteNumber = store.getQuotationNumber(event);
  const invoices = state.invoices.filter((i) => i.event_id === event.id);
  const masterInvoice = invoices.find((i) => i.status !== 'void') || invoices[0] || null;

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

  // Confirm Quotation ("Client OK"): sets status to confirmed, converts same quotation into unified master invoice, checks inventory shortages
  const handleConfirmQuotation = () => {
    store.updateEvent(event.id, {
      status: 'confirmed',
      payment_terms: paymentTerms || event.payment_terms
    });
    const masterInv = store.ensureEventInvoice(event.id, invDiscount, invDiscountNote);
    const updatedStockEst = store.getEventStockEstimation(event.id);

    if (updatedStockEst.totalShortageCount > 0) {
      setStatusBanner({
        type: 'info',
        message: `✓ Quotation #${quoteNumber} approved & converted to Invoice #${masterInv.invoice_number}! ⚠️ ${updatedStockEst.totalShortageCount} raw materials required for this menu are low in warehouse stock.`
      });
    } else {
      setStatusBanner({
        type: 'success',
        message: `✓ Quotation #${quoteNumber} approved & converted to Invoice #${masterInv.invoice_number}! All required ingredients are available in warehouse.`
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

  const handleSaveEventExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDesc.trim() || expAmount <= 0) return;

    if (editingExpenseId) {
      store.updateEventExpense(editingExpenseId, {
        category: expCategory,
        description: expDesc.trim(),
        amount: expAmount,
        expense_date: expDate || event.event_date,
        notes: expNotes.trim()
      });
      setEditingExpenseId(null);
      setStatusBanner({
        type: 'success',
        message: '✓ Event expense entry updated.'
      });
    } else {
      store.addEventExpense({
        event_id: event.id,
        category: expCategory,
        description: expDesc.trim(),
        amount: expAmount,
        expense_date: expDate || event.event_date,
        notes: expNotes.trim()
      });
      setStatusBanner({
        type: 'success',
        message: `✓ Added ${EVENT_EXPENSE_CATEGORY_LABELS[expCategory].short} (₹${expAmount.toLocaleString('en-IN')}) to event expenses.`
      });
    }

    setExpDesc('');
    setExpAmount(0);
    setExpNotes('');
  };

  const handleStartEditExpense = (exp: EventExpense) => {
    setEditingExpenseId(exp.id);
    setExpCategory(exp.category);
    setExpDesc(exp.description);
    setExpAmount(exp.amount);
    setExpDate(exp.expense_date || event.event_date);
    setExpNotes(exp.notes || '');
  };

  const handleCancelEditExpense = () => {
    setEditingExpenseId(null);
    setExpDesc('');
    setExpAmount(0);
    setExpNotes('');
  };

  const handleAddEventAllowance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allowanceStaffId || allowanceAmount <= 0) return;
    const staffMember = state.staff.find((s) => s.id === allowanceStaffId);
    store.addStaffSalaryRecord({
      staff_member_id: allowanceStaffId,
      event_id: event.id,
      record_type: 'earning',
      amount: allowanceAmount,
      method: allowanceMethod || 'Duty Allowance',
      note: allowanceNote.trim() || `${event.title} allowance`
    });
    setAllowanceAmount(0);
    setAllowanceNote('');
    setStatusBanner({
      type: 'success',
      message: `✓ Added ₹${allowanceAmount.toLocaleString('en-IN')} ${allowanceMethod} for ${staffMember?.name || 'Staff'} (included in Event Total Expenditure & Staff Salary).`
    });
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
    const trimmedNote = shiftDutyNote.trim();

    const createdShift = store.addShift({
      event_id: event.id,
      staff_member_id: shiftStaffId,
      role_label: shiftRoleLabel,
      starts_at: isoStart,
      ends_at: isoEnd,
      duty_note: trimmedNote || undefined
    });

    setShiftDutyNote('');

    if (autoNotifyWhatsApp) {
      setSelectedShiftForWhatsApp(createdShift);
      setShiftModalInitialNote(trimmedNote);
      setIsStaffWhatsAppOpen(true);
    }
  };

  // Convert Quotation to Single Unified Invoice OR Update Existing Unified Invoice (Discount, Discount Note & Visibility)
  const handleConvertOrUpdateMasterInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterInvoice) {
      store.updateEvent(event.id, {
        status: event.status === 'inquiry' || event.status === 'quoted' ? 'confirmed' : event.status,
        show_bank_details: invShowBankDetails,
        show_payment_details: invShowPaymentDetails
      });
      const createdInv = store.ensureEventInvoice(event.id, invDiscount, invDiscountNote);
      store.updateInvoice(createdInv.id, {
        subtotal: invSubtotal > 0 ? invSubtotal : grandTotal,
        discount: invDiscount,
        discount_note: invDiscountNote.trim(),
        due_date: invDueDate || event.event_date,
        show_bank_details: invShowBankDetails,
        show_payment_details: invShowPaymentDetails,
        notes: invNotes || event.payment_terms || state.settings.payment_terms
      });
      setStatusBanner({
        type: 'success',
        message: `✓ Quotation #${quoteNumber} converted into Invoice #${createdInv.invoice_number}!`
      });
    } else {
      store.updateInvoice(masterInvoice.id, {
        subtotal: invSubtotal,
        discount: invDiscount,
        discount_note: invDiscountNote.trim(),
        due_date: invDueDate,
        show_bank_details: invShowBankDetails,
        show_payment_details: invShowPaymentDetails,
        notes: invNotes
      });
      setStatusBanner({
        type: 'success',
        message: `✓ Invoice #${masterInvoice.invoice_number} updated (Discount: ₹${invDiscount.toLocaleString('en-IN')}${invDiscountNote.trim() ? ` — ${invDiscountNote.trim()}` : ''}).`
      });
    }
  };

  // Open Edit Invoice Modal (Same Invoice editing)
  const handleOpenEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditInvForm({
      subtotal: inv.subtotal !== undefined ? inv.subtotal : inv.amount,
      discount: inv.discount || 0,
      discount_note: inv.discount_note || '',
      kind: inv.kind,
      due_date: inv.due_date || '',
      status: inv.status,
      show_bank_details: inv.show_bank_details !== false,
      show_payment_details: inv.show_payment_details !== false,
      notes: inv.notes || ''
    });
  };

  const handleSaveInvoiceEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    store.updateInvoice(editingInvoice.id, {
      subtotal: editInvForm.subtotal,
      discount: editInvForm.discount,
      discount_note: editInvForm.discount_note.trim(),
      kind: editInvForm.kind,
      due_date: editInvForm.due_date,
      status: editInvForm.status,
      show_bank_details: editInvForm.show_bank_details,
      show_payment_details: editInvForm.show_payment_details,
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

    const targetInvId = partPayInvoice.id;
    const targetInvNum = partPayInvoice.invoice_number;

    store.addPayment({
      invoice_id: targetInvId,
      amount: partPayAmount,
      method: partPayMethod,
      payment_channel: partPayChannel,
      destination_account: finalAccount,
      note: partPayNote
    });

    const refreshedInv = store.getState().invoices.find((i) => i.id === targetInvId);
    const settledNow = refreshedInv?.status === 'paid' && refreshedInv?.kind === 'final';

    setPartPayInvoice(null);
    setStatusBanner({
      type: 'success',
      message: settledNow
        ? `🎉 Full payment received! Invoice #${targetInvNum} has automatically transitioned to a Final Settlement Invoice (Payment Terms hidden).`
        : `Part-payment recorded on Invoice #${targetInvNum} to "${finalAccount}" (${partPayChannel === 'cash' ? 'Cash' : 'Bank'}).`
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

      {/* Simplified Colourful Booking Overview Card (Separates Upcoming vs Previous Context) */}
      {(() => {
        const now = new Date();
        const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const isUpcomingBooking =
          event.status !== 'completed' &&
          event.status !== 'cancelled' &&
          event.event_date >= todayIso;
        const accentHex = isUpcomingBooking ? '#4f46e5' : '#d97706';

        return (
          <div
            className="card no-print"
            style={{
              borderTop: `4px solid ${accentHex}`,
              padding: '1.15rem 1.35rem',
              marginBottom: '1.15rem',
              background: isUpcomingBooking
                ? 'linear-gradient(180deg, #eef2ff 0%, #ffffff 55%)'
                : 'linear-gradient(180deg, #fffbeb 0%, #ffffff 55%)'
            }}
          >
            {/* Row 1: Booking Timeline Tag, Title & Clean Action Cluster */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem',
                flexWrap: 'wrap',
                paddingBottom: '0.95rem',
                borderBottom: '1px solid #e2e8f0'
              }}
            >
              <div>
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    color: isUpcomingBooking ? '#4338ca' : '#b45309',
                    marginBottom: '0.3rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <span>
                    {isUpcomingBooking
                      ? '📅 UPCOMING BOOKING (വരാനിരിക്കുന്ന ഇവന്റ്)'
                      : '🕘 PREVIOUS / COMPLETED EVENT (കഴിഞ്ഞുപോയ ഇവന്റ്)'}
                  </span>
                  <span aria-hidden="true">&middot;</span>
                  <span style={{ color: '#475569' }}>Quote #{quoteNumber}</span>
                  {masterInvoice && (
                    <>
                      <span aria-hidden="true">&middot;</span>
                      <span style={{ color: '#047857' }}>
                        {masterInvoice.status === 'paid'
                          ? `Final Settlement #${masterInvoice.invoice_number}`
                          : `Invoice #${masterInvoice.invoice_number}`}
                      </span>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <h1 className="page-title" style={{ margin: 0, fontSize: '1.45rem' }}>
                    {event.title}
                  </h1>
                  <span className={`badge badge-${event.status}`}>{event.status}</span>
                </div>
              </div>

              {/* Clean Single-Line Action Bar */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.45rem',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'flex-end'
                }}
              >
                {(event.status === 'inquiry' || event.status === 'quoted' || !masterInvoice) &&
                  canEditOps && (
                    <button
                      type="button"
                      onClick={handleConfirmQuotation}
                      className="btn btn-sm"
                      style={{
                        background: '#16a34a',
                        color: '#ffffff',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      ✓ Approve &amp; Create Invoice
                    </button>
                  )}

                {event.status === 'confirmed' && canEditOps && (
                  <button
                    type="button"
                    onClick={handleCompleteEvent}
                    className="btn btn-sm"
                    style={{
                      background: '#2563eb',
                      color: '#ffffff',
                      fontWeight: 700,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🏁 Mark Completed
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsQuoteWhatsAppOpen(true)}
                  className="btn btn-sm"
                  style={{
                    background: '#ecfdf5',
                    border: '1px solid #6ee7b7',
                    color: '#047857',
                    fontWeight: 700,
                    whiteSpace: 'nowrap'
                  }}
                >
                  💬 Send Quote (PDF + Text)
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrintQuoteOpen(true)}
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                >
                  📄 Quote PDF
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPrintQuoteOpen(true);
                    setAutoPrintTarget('quote');
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                  title="Print ONLY Quotation Document"
                >
                  🖨️ Print
                </button>
              </div>
            </div>

            {/* Row 2: Clean 4-Column Booking Key Details Strip */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: '1rem',
                paddingTop: '0.9rem'
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Client
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', marginTop: '0.15rem' }}>
                  {client?.name || 'Unknown Client'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                  {client?.phone || client?.company || 'No phone on file'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Date &amp; Venue
                </div>
                <div className="tabular-nums" style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a', marginTop: '0.15rem' }}>
                  {event.event_date} ({event.start_time || '--:--'} – {event.end_time || '--:--'})
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                  {event.venue || 'Venue TBD'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  Guests &amp; Quote Total
                </div>
                <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.12rem', color: '#be123c', marginTop: '0.12rem' }}>
                  ₹{displayTotal.toLocaleString('en-IN')}
                </div>
                <div className="tabular-nums" style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
                  {event.guest_count} Guests (Pax)
                </div>
              </div>

              {canManageEventExpenses && (
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    {isOwnerOnly ? 'Total Spent & Owner P&L' : 'Total Event Expenditure'}
                  </div>
                  <div className="tabular-nums" style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', marginTop: '0.12rem' }}>
                    ₹{finSummary.totalExpenditure.toLocaleString('en-IN')}
                  </div>
                  <div className="tabular-nums" style={{ fontSize: '0.77rem', marginTop: '0.1rem' }}>
                    {isOwnerOnly ? (
                      <span
                        style={{
                          fontWeight: 700,
                          color: finSummary.netProfit >= 0 ? '#059669' : '#dc2626'
                        }}
                      >
                        {finSummary.netProfit >= 0 ? 'Profit +' : 'Loss -'}₹
                        {Math.abs(finSummary.netProfit).toLocaleString('en-IN')} ({finSummary.marginPercent}%)
                      </span>
                    ) : (
                      <span style={{ color: '#64748b' }}>Includes shifts, allowances &amp; extras</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Stock Shortage Warning / Reassurance Banner */}
      {stockEst.totalShortageCount > 0 && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '0.8rem 1rem',
            marginBottom: '1.15rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: '#b91c1c', fontSize: '0.88rem' }}>
              ⚠️ Raw Material Shortage: {stockEst.totalShortageCount} items low (Est. ₹{stockEst.totalEstimatedCost.toLocaleString('en-IN')})
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: '#dc2626', color: '#ffffff', fontWeight: 700, whiteSpace: 'nowrap' }}
              onClick={handleOpenShortageOrderModal}
            >
              📦 Order Stock
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ background: '#ffffff', borderColor: '#fca5a5', color: '#b91c1c', fontWeight: 700, whiteSpace: 'nowrap' }}
              onClick={() => {
                const res = exportEventStockShortageCsv(event.id);
                if (res) {
                  setStatusBanner({
                    type: 'success',
                    message: `📥 Exported "${res.filename}" (${res.shortageCount} shortage items for vendor ordering).`
                  });
                }
              }}
            >
              📥 Shortage CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontWeight: 600, whiteSpace: 'nowrap' }}
              onClick={() => setActiveTab('stock')}
            >
              View Stock &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Sleek Segmented Workspace Tabs */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.3rem',
          background: '#f1f5f9',
          borderRadius: '12px',
          marginBottom: '1.25rem',
          overflowX: 'auto'
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('quote')}
          style={{
            padding: '0.52rem 0.95rem',
            borderRadius: '9px',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontWeight: activeTab === 'quote' ? 700 : 600,
            fontSize: '0.84rem',
            background: activeTab === 'quote' ? '#ffffff' : 'transparent',
            color: activeTab === 'quote' ? '#0f172a' : '#475569',
            boxShadow: activeTab === 'quote' ? '0 1px 3px rgba(15,23,42,0.1)' : 'none'
          }}
        >
          🍽️ Menu &amp; Quote ({eventItems.length})
        </button>

        {canEditOps && (
          <button
            type="button"
            onClick={() => setActiveTab('stock')}
            style={{
              padding: '0.52rem 0.95rem',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: activeTab === 'stock' ? 700 : 600,
              fontSize: '0.84rem',
              background: activeTab === 'stock' ? '#ffffff' : 'transparent',
              color: activeTab === 'stock' ? '#0f172a' : '#475569',
              boxShadow: activeTab === 'stock' ? '0 1px 3px rgba(15,23,42,0.1)' : 'none'
            }}
          >
            📦 Stock ({stockEst.items.length})
          </button>
        )}

        {canEditOps && (
          <button
            type="button"
            onClick={() => setActiveTab('shifts')}
            style={{
              padding: '0.52rem 0.95rem',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: activeTab === 'shifts' ? 700 : 600,
              fontSize: '0.84rem',
              background: activeTab === 'shifts' ? '#ffffff' : 'transparent',
              color: activeTab === 'shifts' ? '#0f172a' : '#475569',
              boxShadow: activeTab === 'shifts' ? '0 1px 3px rgba(15,23,42,0.1)' : 'none'
            }}
          >
            👥 Staff Shifts ({shifts.length})
          </button>
        )}

        {canManageEventExpenses && (
          <button
            type="button"
            onClick={() => setActiveTab('expenses')}
            style={{
              padding: '0.52rem 0.95rem',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: activeTab === 'expenses' ? 700 : 600,
              fontSize: '0.84rem',
              background: activeTab === 'expenses' ? '#ffffff' : 'transparent',
              color: activeTab === 'expenses' ? '#0f172a' : '#475569',
              boxShadow: activeTab === 'expenses' ? '0 1px 3px rgba(15,23,42,0.1)' : 'none'
            }}
          >
            💸 Expenses (₹{finSummary.totalExpenditure.toLocaleString('en-IN')})
          </button>
        )}

        {isFinance && (
          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            style={{
              padding: '0.52rem 0.95rem',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: activeTab === 'invoices' ? 700 : 600,
              fontSize: '0.84rem',
              background: activeTab === 'invoices' ? '#ffffff' : 'transparent',
              color: activeTab === 'invoices' ? '#0f172a' : '#475569',
              boxShadow: activeTab === 'invoices' ? '0 1px 3px rgba(15,23,42,0.1)' : 'none'
            }}
          >
            🧾 Invoice &amp; Payments ({invoices.length})
          </button>
        )}

        {canEditOps && (
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            style={{
              padding: '0.52rem 0.95rem',
              borderRadius: '9px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontWeight: activeTab === 'details' ? 700 : 600,
              fontSize: '0.84rem',
              background: activeTab === 'details' ? '#ffffff' : 'transparent',
              color: activeTab === 'details' ? '#0f172a' : '#475569',
              boxShadow: activeTab === 'details' ? '0 1px 3px rgba(15,23,42,0.1)' : 'none'
            }}
          >
            ⚙️ Edit Booking
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    Quotation Menu ({event.guest_count} Guests) &bull; <span style={{ color: '#1d4ed8' }}>#{quoteNumber}</span>
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setIsQuoteWhatsAppOpen(true)}
                    className="btn btn-secondary btn-sm"
                    style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#15803d', fontWeight: 700 }}
                    title="Send Quotation directly to Client's WhatsApp"
                  >
                    💬 WhatsApp Quote
                  </button>
                  <button
                    onClick={() => setIsPrintQuoteOpen(true)}
                    className="btn btn-secondary btn-sm"
                    title="Preview Quotation A4 PDF with Logo"
                  >
                    📄 A4 PDF Preview
                  </button>
                </div>
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

              {/* Logistics, Transport & Extra Charges */}
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                    🚚 Logistics, Transport &amp; Extra Charges
                  </h3>
                  {extras.length > 0 && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                      Extras Subtotal: ₹{extrasTotal.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                {extras.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    No logistics, transport, or extra charges added yet. Use quick presets or type below:
                  </p>
                ) : (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Logistics / Transport / Extra Description</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          {canEditQuote && <th style={{ textAlign: 'center' }}>Remove</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {extras.map((ex) => (
                          <tr key={ex.id}>
                            <td>
                              <div style={{ fontWeight: 500 }}>{ex.description}</div>
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

                {/* Quick Presets + Add Extra Charge Form */}
                {canEditQuote && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      {[
                        { label: '🚚 Transport & Delivery', desc: 'Vehicle Transport & Site Delivery Charges' },
                        { label: '🍽️ Service Boys & Logistics', desc: 'Uniformed Service Staff & Site Logistics' },
                        { label: '🏺 Chafing Dishes & Crockery', desc: 'VIP Chafing Dishes, Cutlery & Crockery Setup' },
                        { label: '⛺ Buffet Counter & Linen', desc: 'Buffet Counter Setup, Frills & Linen' },
                        { label: '⚡ Live Counter / Extra Expense', desc: 'Live Kitchen Counter & Extra Event Expense' },
                        { label: '💧 Mineral Water & Welcome Setup', desc: 'Packaged Drinking Water & Welcome Counter' }
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                          onClick={() => setExtraDesc(preset.desc)}
                        >
                          + {preset.label}
                        </button>
                      ))}
                    </div>
                    <form onSubmit={handleAddExtra} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Transport Charges, Service Logistics, Extra Expenses..."
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
                        + Add Charge
                      </button>
                    </form>
                  </div>
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

          {/* Quotation Payment Terms, Bank/Payment Visibility Toggles & Client Approval Card */}
          <div className="card" style={{ marginTop: '1.25rem', borderTop: '2px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                  📜 Quotation Payment Terms &amp; Document Display Options (#{quoteNumber})
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  Enable or disable Bank Details &amp; Payment Details on this quotation, or send directly to Client&apos;s WhatsApp.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setIsQuoteWhatsAppOpen(true)}
                  className="btn btn-sm"
                  style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontWeight: 700, padding: '0.45rem 0.85rem' }}
                >
                  💬 Send Quotation to WhatsApp
                </button>
                {(event.status === 'inquiry' || event.status === 'quoted' || !masterInvoice) && canEditOps && (
                  <button
                    type="button"
                    onClick={handleConfirmQuotation}
                    className="btn btn-sm"
                    style={{ background: '#16a34a', color: '#ffffff', fontWeight: 700, padding: '0.45rem 0.9rem' }}
                  >
                    ✓ Client OK — Convert to Invoice
                  </button>
                )}
              </div>
            </div>

            {/* Enable / Disable Bank Details & Payment Details on Quotation */}
            <div
              style={{
                display: 'flex',
                gap: '1.25rem',
                flexWrap: 'wrap',
                padding: '0.65rem 0.85rem',
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                marginBottom: '0.85rem'
              }}
            >
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 600, cursor: canEditQuote ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  checked={event.show_bank_details !== false}
                  disabled={!canEditQuote}
                  onChange={(e) => store.updateEvent(event.id, { show_bank_details: e.target.checked })}
                />
                🏦 Show Bank Details on Quotation
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', fontWeight: 600, cursor: canEditQuote ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  checked={event.show_payment_details !== false}
                  disabled={!canEditQuote}
                  onChange={(e) => store.updateEvent(event.id, { show_payment_details: e.target.checked })}
                />
                💳 Show Payment Details / Terms on Quotation
              </label>
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
                {stockEst.items.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontWeight: 700,
                      background: '#f0fdf4',
                      borderColor: '#86efac',
                      color: '#15803d'
                    }}
                    onClick={() => {
                      const res = exportEventStockShortageCsv(event.id);
                      if (res) {
                        setStatusBanner({
                          type: 'success',
                          message: `📥 Exported "${res.filename}" (${res.totalItems} items, ${res.shortageCount} shortage items).`
                        });
                      }
                    }}
                    title="Export Event Stock & Vendor Shortage List as CSV"
                  >
                    📥 Export Inventory &amp; Shortage CSV
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                  onClick={() => setIsPrintStockOpen(true)}
                >
                  📄 A4 Sheet Preview
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
                  onClick={() => {
                    setIsPrintStockOpen(true);
                    setAutoPrintTarget('stock');
                  }}
                  title="Print ONLY Stock Estimation Sheet (excludes webpage)"
                >
                  🖨️ Print Stock Sheet
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
                  <>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        fontWeight: 700,
                        background: '#16a34a',
                        color: '#ffffff',
                        border: '1px solid #15803d',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                      onClick={() => {
                        setSelectedShiftForWhatsApp(null);
                        setShiftModalInitialNote('');
                        setIsStaffWhatsAppOpen(true);
                      }}
                    >
                      💬 Notify All Crew ({shifts.filter((s) => Boolean(s.whatsapp_notified_at)).length}/{shifts.length})
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontWeight: 700 }}
                      onClick={() => store.markEventShiftsAttendance(event.id, 'present')}
                    >
                      ✓ Mark All Present
                    </button>
                  </>
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
                      <th style={{ textAlign: 'center' }}>WhatsApp Duty Alert</th>
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
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                background: sh.whatsapp_notified_at ? '#f0fdf4' : '#dcfce7',
                                color: '#15803d',
                                border: '1px solid #86efac',
                                fontWeight: 700,
                                fontSize: '0.73rem',
                                padding: '0.25rem 0.55rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                              title="Send role & event duty details on WhatsApp"
                              onClick={() => {
                                setSelectedShiftForWhatsApp(sh);
                                setShiftModalInitialNote(sh.duty_note || '');
                                setIsStaffWhatsAppOpen(true);
                              }}
                            >
                              <span>💬</span>
                              <span>{sh.whatsapp_notified_at ? '✓ Sent (Resend)' : 'Notify'}</span>
                            </button>
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
                    onChange={(e) => {
                      const pickedId = e.target.value;
                      setShiftStaffId(pickedId);
                      const pickedStaff = state.staff.find((st) => st.id === pickedId);
                      if (pickedStaff?.role_title) {
                        setShiftRoleLabel(pickedStaff.role_title);
                      }
                    }}
                    required
                  >
                    <option value="">Choose staff...</option>
                    {state.staff.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.role_title} - ₹{st.hourly_rate}/hr)
                      </option>
                    ))}
                  </select>
                  {shiftStaffId && (() => {
                    const picked = state.staff.find((st) => st.id === shiftStaffId);
                    const formattedPhone = formatDisplayWhatsAppPhone(picked?.phone);
                    return (
                      <div
                        style={{
                          marginTop: '0.35rem',
                          fontSize: '0.76rem',
                          color: formattedPhone ? '#15803d' : '#b45309',
                          fontWeight: 600
                        }}
                      >
                        {formattedPhone
                          ? `📱 WhatsApp Mobile: ${formattedPhone}`
                          : '⚠️ No mobile number saved for this staff member (can be entered when sending)'}
                      </div>
                    );
                  })()}
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

                <div className="form-group">
                  <label className="form-label">Duty Instructions / Note (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Report 30 mins early in black uniform"
                    value={shiftDutyNote}
                    onChange={(e) => setShiftDutyNote(e.target.value)}
                  />
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#166534',
                    marginTop: '0.35rem'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoNotifyWhatsApp}
                    onChange={(e) => setAutoNotifyWhatsApp(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#16a34a' }}
                  />
                  <span>💬 Send WhatsApp duty notification on assign</span>
                </label>

                <div style={{ marginTop: '1rem' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      background: autoNotifyWhatsApp ? '#16a34a' : undefined,
                      borderColor: autoNotifyWhatsApp ? '#15803d' : undefined,
                      fontWeight: 700
                    }}
                  >
                    {autoNotifyWhatsApp
                      ? '💬 Assign Role & Notify on WhatsApp'
                      : '+ Schedule Shift'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------------------------- */}
      {/* TAB 3B: EVENT EXTRA EXPENSES & TOTAL EXPENDITURE (Owner, Accountant, Manager) */}
      {/* ----------------------------------------------------------------------------------- */}
      {activeTab === 'expenses' && canManageEventExpenses && (
        <div>
          {/* Printable Event Expense Sheet Area */}
          <div id="event-expenses-printable-area">
            {/* Top 4 Category + Total Expenditure Summary */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))',
                gap: '0.9rem',
                marginBottom: '1.25rem'
              }}
            >
              <div className="stats-card" style={{ borderLeft: '4px solid #2563eb' }}>
                <span className="stats-label">1. Stock Pricing (സ്റ്റോക്കിന്റെ പ്രൈസിങ്)</span>
                <span className="stats-value" style={{ color: '#0f172a' }}>
                  ₹{finSummary.stockPricingCost.toLocaleString('en-IN')}
                </span>
                <span className="stats-sub">
                  Recipe Est: ₹{finSummary.recipeStockEstimate.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="stats-card" style={{ borderLeft: '4px solid #d97706' }}>
                <span className="stats-label">2. Extras Cost (എക്സ്ട്രാസ് ചെലവുകൾ)</span>
                <span className="stats-value" style={{ color: '#0f172a' }}>
                  ₹{finSummary.extrasTakenCost.toLocaleString('en-IN')}
                </span>
                <span className="stats-sub">Extras taken, rentals &amp; transport</span>
              </div>

              <div className="stats-card" style={{ borderLeft: '4px solid #7c3aed' }}>
                <span className="stats-label">3. Staff + Allowances (സ്റ്റാഫിന്റെ ചെലവുകൾ)</span>
                <span className="stats-value" style={{ color: '#0f172a' }}>
                  ₹{finSummary.totalStaffCost.toLocaleString('en-IN')}
                </span>
                <span className="stats-sub">
                  Shifts: ₹{finSummary.staffShiftWages.toLocaleString('en-IN')} &bull; Allow: ₹
                  {finSummary.staffAllowances.toLocaleString('en-IN')} &bull; Extra: ₹
                  {finSummary.staffExpenseCost.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="stats-card" style={{ borderLeft: '4px solid #475569' }}>
                <span className="stats-label">4. Other Expenses (മറ്റ് ചെലവുകൾ)</span>
                <span className="stats-value" style={{ color: '#0f172a' }}>
                  ₹{finSummary.otherExpenseCost.toLocaleString('en-IN')}
                </span>
                <span className="stats-sub">Fuel, ice, cleaning &amp; misc</span>
              </div>

              <div
                className="stats-card"
                style={{ borderLeft: '4px solid #e11d48', background: '#fff1f2' }}
              >
                <span className="stats-label" style={{ color: '#9f1239', fontWeight: 700 }}>
                  Total Event Expenditure (incl. Allowances)
                </span>
                <span className="stats-value" style={{ color: '#be123c' }}>
                  ₹{finSummary.totalExpenditure.toLocaleString('en-IN')}
                </span>
                <span className="stats-sub" style={{ color: '#881337' }}>
                  All 4 heads + shifts + all allowances
                </span>
              </div>
            </div>

            {/* Strictly Owner-Only Profit & Loss Card (NEVER visible to Accountant, Manager, or Staff) */}
            {isOwnerOnly && (
              <div
                className="card no-print"
                style={{
                  marginBottom: '1.25rem',
                  borderLeft: `4px solid ${finSummary.netProfit >= 0 ? '#16a34a' : '#dc2626'}`,
                  background: finSummary.netProfit >= 0 ? '#f0fdf4' : '#fef2f2'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                        📈 Event Profit &amp; Loss Analysis
                      </h3>
                      <span
                        className="badge"
                        style={{ background: '#ffe4e6', color: '#be123c', fontWeight: 800, fontSize: '0.68rem' }}
                      >
                        🔒 OWNER ONLY
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#334155', marginTop: '0.3rem' }}>
                      Contract / Invoiced Revenue: <strong>₹{finSummary.contractRevenue.toLocaleString('en-IN')}</strong>{' '}
                      &minus; Total Expenditure (incl. Allowances):{' '}
                      <strong>₹{finSummary.totalExpenditure.toLocaleString('en-IN')}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                        {finSummary.netProfit >= 0 ? 'Net Profit (ലാഭം)' : 'Net Loss (നഷ്ടം)'}
                      </div>
                      <div
                        style={{
                          fontSize: '1.45rem',
                          fontWeight: 800,
                          color: finSummary.netProfit >= 0 ? '#15803d' : '#dc2626'
                        }}
                      >
                        {finSummary.netProfit >= 0 ? '+' : '-'}₹
                        {Math.abs(finSummary.netProfit).toLocaleString('en-IN')}{' '}
                        <span style={{ fontSize: '0.82rem' }}>({finSummary.marginPercent}%)</span>
                      </div>
                    </div>
                    <Link href="/pnl" className="btn btn-secondary btn-sm" style={{ fontWeight: 700 }}>
                      Full P&amp;L Module &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <div className="grid-2" style={{ marginBottom: '1.25rem', alignItems: 'start' }}>
              {/* Left: Extra Expense Entry Form (Owner, Accountant, Manager) */}
              <div className="card no-print">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <div>
                    <h2 className="card-title" style={{ margin: 0 }}>
                      {editingExpenseId ? '✏️ Edit Event Extra Expense' : '➕ Add Event Extra Expense'}
                    </h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                      Available to Owner, Accountant &amp; Manager — log Stock Pricing, Extras Taken, Staff Expenses, or Other Expenses.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveEventExpense}>
                  <div className="form-group">
                    <label className="form-label">Expense Category *</label>
                    <select
                      className="form-control"
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value as EventExpenseCategory)}
                    >
                      <option value="stock_pricing">
                        📦 Stock Pricing — സ്റ്റോക്കിന്റെ പ്രൈസിങ്
                      </option>
                      <option value="extras_cost">
                        🚚 Extras Taken Cost — എക്സ്ട്രാസ് കൊണ്ടുപോയതിന്റെ ചെലവുകൾ
                      </option>
                      <option value="staff_expense">
                        👥 Staff Extra Expenses — സ്റ്റാഫിന്റെ ചെലവുകൾ
                      </option>
                      <option value="other_expense">
                        🧾 Other Expenses — മറ്റ് ചെലവുകൾ
                      </option>
                    </select>
                  </div>

                  {expCategory === 'stock_pricing' && finSummary.recipeStockEstimate > 0 && (
                    <div
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        padding: '0.5rem 0.7rem',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        fontSize: '0.78rem'
                      }}
                    >
                      <span style={{ color: '#1e3a8a' }}>
                        Recipe Raw Material Estimate: <strong>₹{finSummary.recipeStockEstimate.toLocaleString('en-IN')}</strong>
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', fontWeight: 700 }}
                        onClick={() => {
                          setExpDesc(`Kitchen Stock & Raw Materials (${event.guest_count} Pax)`);
                          setExpAmount(finSummary.recipeStockEstimate);
                        }}
                      >
                        ⚡ Auto-Fill ₹{finSummary.recipeStockEstimate.toLocaleString('en-IN')}
                      </button>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Particulars / Description *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder={
                        expCategory === 'stock_pricing'
                          ? 'e.g. Basmati rice, meat, spices & vegetables used'
                          : expCategory === 'extras_cost'
                          ? 'e.g. Chafing dishes, extra tables, vehicle transport'
                          : expCategory === 'staff_expense'
                          ? 'e.g. Crew food, tea/snacks, night cab return'
                          : 'e.g. Generator fuel, ice blocks, banana leaves'
                      }
                      value={expDesc}
                      onChange={(e) => setExpDesc(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Amount (₹) *</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="form-control"
                        placeholder="0"
                        value={expAmount || ''}
                        onChange={(e) => setExpAmount(parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Expense Date</label>
                      <input
                        type="date"
                        className="form-control"
                        value={expDate || event.event_date}
                        onChange={(e) => setExpDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Notes / Vendor / Bill Ref (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Paid via Cash / Vendor receipt #104"
                      value={expNotes}
                      onChange={(e) => setExpNotes(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1, fontWeight: 700 }}>
                      {editingExpenseId ? '✓ Save Expense Update' : '+ Add Event Expense'}
                    </button>
                    {editingExpenseId && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleCancelEditExpense}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Right: Logged Event Extra Expenses Table */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <div>
                    <h2 className="card-title" style={{ margin: 0 }}>
                      Logged Extra Expenses ({finSummary.expenses.length})
                    </h2>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                      Direct cost entries recorded for <strong>{event.title}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm no-print"
                    style={{ fontWeight: 700 }}
                    onClick={() =>
                      printElementById('event-expenses-printable-area', {
                        title: `Event-Expenses-${event.title.replace(/[^a-zA-Z0-9]/g, '_')}`,
                        orientation: 'portrait'
                      })
                    }
                    title="Print ONLY this Event Expense Sheet"
                  >
                    🖨️ Print Expense Sheet
                  </button>
                </div>

                {finSummary.expenses.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                    No extra expenses added yet. Use the form to record Stock Pricing, Extras Taken, Staff Expenses, or Other Expenses.
                  </p>
                ) : (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Particulars</th>
                          <th style={{ textAlign: 'right' }}>Amount</th>
                          <th className="no-print" style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finSummary.expenses.map((exp) => {
                          const cat = EVENT_EXPENSE_CATEGORY_LABELS[exp.category];
                          return (
                            <tr key={exp.id}>
                              <td>
                                <span
                                  className="badge"
                                  style={{
                                    background: '#f1f5f9',
                                    color: '#0f172a',
                                    fontWeight: 700,
                                    fontSize: '0.72rem'
                                  }}
                                >
                                  {cat.short}
                                </span>
                                <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                                  {cat.ml}
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{exp.description}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  {exp.expense_date}
                                  {exp.notes ? ` • ${exp.notes}` : ''}
                                  {exp.created_by_name ? ` • By ${exp.created_by_name}` : ''}
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#be123c' }}>
                                ₹{exp.amount.toLocaleString('en-IN')}
                              </td>
                              <td className="no-print" style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleStartEditExpense(exp)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    onClick={() => {
                                      if (confirm(`Delete expense "${exp.description}"?`)) {
                                        store.deleteEventExpense(exp.id);
                                      }
                                    }}
                                  >
                                    ✕
                                  </button>
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

            {/* Staff Shift Wages + Event Allowances Section (Included in Total Event Expenditure) */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    👥 Event Staff Shift Wages &amp; Allowances (Included in Event Total)
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                    Attended Shifts ({finSummary.attendedShiftCount}): <strong>₹{finSummary.staffShiftWages.toLocaleString('en-IN')}</strong> &bull; Event Allowances: <strong>₹{finSummary.staffAllowances.toLocaleString('en-IN')}</strong> &bull; Staff Extra Expenses: <strong>₹{finSummary.staffExpenseCost.toLocaleString('en-IN')}</strong>
                  </p>
                </div>
                <span className="badge" style={{ background: '#ede9fe', color: '#5b21b6', fontWeight: 800 }}>
                  Total Staff Cost: ₹{finSummary.totalStaffCost.toLocaleString('en-IN')}
                </span>
              </div>

              {/* Quick Add Event Staff Allowance Form */}
              <form
                onSubmit={handleAddEventAllowance}
                className="no-print"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                  gap: '0.65rem',
                  alignItems: 'end',
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.75rem 0.9rem',
                  marginBottom: '0.9rem'
                }}
              >
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Staff Member *</label>
                  <select
                    className="form-control"
                    value={allowanceStaffId}
                    onChange={(e) => setAllowanceStaffId(e.target.value)}
                    required
                  >
                    <option value="">Select staff...</option>
                    {state.staff.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.role_title || 'Crew'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Allowance Type</label>
                  <select
                    className="form-control"
                    value={allowanceMethod}
                    onChange={(e) => setAllowanceMethod(e.target.value)}
                  >
                    <option value="Duty Allowance">Duty Allowance</option>
                    <option value="Travel / Bata">Travel / Bata</option>
                    <option value="Overtime Bonus">Overtime Bonus</option>
                    <option value="Captain / Chef Allowance">Captain / Chef Allowance</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Allowance Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    placeholder="0"
                    value={allowanceAmount || ''}
                    onChange={(e) => setAllowanceAmount(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>Note (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Outstation night allowance"
                    value={allowanceNote}
                    onChange={(e) => setAllowanceNote(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-sm" style={{ height: '38px', fontWeight: 700 }}>
                  + Add Allowance
                </button>
              </form>

              {finSummary.allowanceRecords.length > 0 && (
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Staff Member</th>
                        <th>Allowance Type</th>
                        <th>Notes</th>
                        <th style={{ textAlign: 'right' }}>Allowance Amount</th>
                        <th className="no-print" style={{ textAlign: 'center' }}>Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finSummary.allowanceRecords.map((sr) => {
                        const st = state.staff.find((s) => s.id === sr.staff_member_id);
                        return (
                          <tr key={sr.id}>
                            <td style={{ fontWeight: 600 }}>{st?.name || 'Staff Member'}</td>
                            <td>{sr.method}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {sr.note || '—'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#5b21b6' }}>
                              ₹{sr.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="no-print" style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => {
                                  if (confirm('Remove this allowance entry?')) {
                                    store.deleteStaffSalaryRecord(sr.id);
                                  }
                                }}
                              >
                                ✕
                              </button>
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
            {/* Unified Invoice converted from Quotation + Part-Payments & Final Settlement */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    Unified Event Invoice &amp; Final Settlement
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                    Quotation <strong>#{quoteNumber}</strong> converts to a single Invoice with its own Invoice #, discounts, part-payments, and automatic upgrade to <strong>Final Settlement</strong> upon full payment.
                  </p>
                </div>
                {isFinance && masterInvoice && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                    onClick={handleSyncInvoice}
                    title="Synchronize invoice subtotal with latest quotation menu & logistics total"
                  >
                    🔄 Sync Quote Total (₹{grandTotal.toLocaleString('en-IN')})
                  </button>
                )}
              </div>
              {invoices.length === 0 ? (
                <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 0.75rem 0' }}>
                    Quotation <strong>#{quoteNumber}</strong> has not been converted to an invoice yet. Approve the quotation when the client confirms:
                  </p>
                  {isFinance && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ fontWeight: 700 }}
                      onClick={() => {
                        store.updateEvent(event.id, { status: 'confirmed' });
                        const inv = store.ensureEventInvoice(event.id, invDiscount, invDiscountNote);
                        setStatusBanner({
                          type: 'success',
                          message: `✓ Quotation #${quoteNumber} converted to Invoice #${inv.invoice_number} (₹${inv.amount.toLocaleString('en-IN')}).`
                        });
                      }}
                    >
                      ✓ Convert Quotation #{quoteNumber} to Invoice (₹{grandTotal.toLocaleString('en-IN')})
                    </button>
                  )}
                </div>
              ) : (
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice # / Quote Ref</th>
                        <th>Stage</th>
                        <th style={{ textAlign: 'right' }}>Net Amount</th>
                        <th style={{ textAlign: 'right' }}>Paid / Due</th>
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
                        const isSettled = inv.status === 'paid' || (inv.amount > 0 && balance <= 0);
                        const qRef = inv.quotation_number || quoteNumber;

                        return (
                          <tr key={inv.id}>
                            <td>
                              <div style={{ fontWeight: 700 }}>{inv.invoice_number}</div>
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                Quote Ref: <strong>#{qRef}</strong>
                              </div>
                              {inv.discount > 0 && (
                                <div style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 600 }}>
                                  Discount: -₹{inv.discount.toLocaleString('en-IN')}
                                  {inv.discount_note ? ` (${inv.discount_note})` : ''}
                                </div>
                              )}
                              <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                                Bank: {inv.show_bank_details !== false ? 'Shown' : 'Hidden'} &bull; Payment Info: {inv.show_payment_details !== false ? 'Shown' : 'Hidden'}
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
                              <span
                                className="badge"
                                style={{
                                  background: isSettled ? '#dcfce7' : '#eff6ff',
                                  color: isSettled ? '#15803d' : '#1d4ed8',
                                  fontWeight: 700
                                }}
                              >
                                {isSettled ? '✓ Final Settlement' : 'Advance / Booking'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              ₹{inv.amount.toLocaleString('en-IN')}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                              ₹{paymentsForThis.toLocaleString('en-IN')}
                              {balance > 0 ? (
                                <div style={{ fontSize: '0.7rem', color: '#dc2626' }}>
                                  Due: ₹{balance.toLocaleString('en-IN')}
                                </div>
                              ) : (
                                inv.amount > 0 && (
                                  <div style={{ fontSize: '0.7rem', color: '#15803d' }}>
                                    Settled in Full
                                  </div>
                                )
                              )}
                            </td>
                            <td>
                              <span className={`badge badge-${inv.status}`}>{inv.status}</span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <button
                                  className="btn btn-primary btn-sm"
                                  title="Preview or Download Standard A4 PDF"
                                  onClick={() => setSelectedInvoiceForPrint(inv)}
                                >
                                  📄 A4 PDF
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontWeight: 700 }}
                                  title="Print ONLY this Invoice Document (excludes webpage)"
                                  onClick={() => {
                                    setSelectedInvoiceForPrint(inv);
                                    setAutoPrintTarget('invoice');
                                  }}
                                >
                                  🖨️ Print
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
                                    {!isSettled && (
                                      <button
                                        className="btn btn-secondary btn-sm"
                                        title="Record Advance Deposit or Part-Payment on this invoice"
                                        onClick={() => handleOpenPartPayment(inv)}
                                        style={{ fontWeight: 600, background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}
                                      >
                                        + Part Pay / Settle
                                      </button>
                                    )}

                                    <button
                                      className="btn btn-secondary btn-sm"
                                      title="Edit Invoice Discount, Details & Visibility"
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

            {/* Same-Invoice Discount, Modifications & Display Toggles Form */}
            {isFinance ? (
              <div className="card">
                <h2 className="card-title">
                  {masterInvoice
                    ? `🏷️ Modify Invoice #${masterInvoice.invoice_number} (Discounts & Visibility)`
                    : `⚡ Convert Quotation #${quoteNumber} to Invoice`}
                </h2>
                <form onSubmit={handleConvertOrUpdateMasterInvoice}>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Quotation Gross Subtotal (₹) *</label>
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
                      <label className="form-label">Discount Amount (₹)</label>
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

                  <div className="form-group">
                    <label className="form-label">Discount Details / Reason (Optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Special wedding package discount / Loyal client concession"
                      value={invDiscountNote}
                      onChange={(e) => setInvDiscountNote(e.target.value)}
                    />
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Net Invoice Payable:</span>
                    <strong style={{ fontSize: '1.15rem', color: 'var(--primary)' }}>
                      ₹{Math.max(0, invSubtotal - invDiscount).toLocaleString('en-IN')}
                    </strong>
                  </div>

                  <div className="grid-2">
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
                        placeholder="e.g. Balance payable on event day"
                        value={invNotes}
                        onChange={(e) => setInvNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Enable / Disable Bank Details & Payment Details on Invoice */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      padding: '0.65rem 0.85rem',
                      background: '#f8fafc',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      marginBottom: '1rem'
                    }}
                  >
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={invShowBankDetails}
                        onChange={(e) => setInvShowBankDetails(e.target.checked)}
                      />
                      🏦 Show Bank Details on Invoice
                    </label>

                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={invShowPaymentDetails}
                        onChange={(e) => setInvShowPaymentDetails(e.target.checked)}
                      />
                      💳 Show Payment Details on Invoice (Payment Terms auto-hide once Fully Paid)
                    </label>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', fontWeight: 700 }}>
                    {masterInvoice
                      ? `✓ Save Changes to Invoice #${masterInvoice.invoice_number}`
                      : `✓ Convert Quotation #${quoteNumber} to Invoice`}
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

          {isOwnerOnly && (
            <div className="card" style={{ borderLeft: '4px solid #64748b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    🔔 Event Edit History (Previous &rarr; New)
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    Quiet edit log showing exact Previous Data &rarr; New Data changes on this event.
                  </p>
                </div>
                <span className="badge" style={{ background: '#f1f5f9', color: '#334155', fontWeight: 700, fontSize: '0.68rem' }}>
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
                    const parsed = parseAuditDetails(log.details);
                    return (
                      <div
                        key={log.id}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
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
                            <strong style={{ fontSize: '0.8rem', color: '#0f172a' }}>
                              {log.actor_name}
                            </strong>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                            {formatAuditTimestamp(log.created_at)}
                          </span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.83rem', color: '#0f172a' }}>
                          {log.summary}
                        </div>

                        {parsed.changes.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.35rem' }}>
                            {parsed.changes.map((chg, idx) => (
                              <div
                                key={`${log.id}-chg-${idx}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  flexWrap: 'wrap',
                                  fontSize: '0.75rem'
                                }}
                              >
                                <span style={{ fontWeight: 700, color: '#334155' }}>{chg.field}:</span>
                                <span
                                  style={{
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    padding: '0.05rem 0.38rem',
                                    borderRadius: '4px',
                                    textDecoration: 'line-through'
                                  }}
                                >
                                  {chg.before}
                                </span>
                                <span style={{ color: '#64748b', fontWeight: 700 }}>&rarr;</span>
                                <span
                                  style={{
                                    background: '#dcfce7',
                                    color: '#166534',
                                    padding: '0.05rem 0.38rem',
                                    borderRadius: '4px',
                                    fontWeight: 700
                                  }}
                                >
                                  {chg.after}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {parsed.changes.length === 0 && parsed.cleanNote && (
                          <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.15rem' }}>
                            {parsed.cleanNote}
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
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>📄 Quotation #{quoteNumber} (A4 PDF)</span>
                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                  A4 Fit
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 600, marginRight: '0.35rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={event.show_bank_details !== false}
                    onChange={(e) => store.updateEvent(event.id, { show_bank_details: e.target.checked })}
                  />
                  🏦 Bank Details
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 600, marginRight: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={event.show_payment_details !== false}
                    onChange={(e) => store.updateEvent(event.id, { show_payment_details: e.target.checked })}
                  />
                  💳 Payment Details
                </label>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#15803d', fontWeight: 700 }}
                  onClick={() => {
                    setIsPrintQuoteOpen(false);
                    setIsQuoteWhatsAppOpen(true);
                  }}
                >
                  💬 Send WhatsApp
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={isDownloadingPdf}
                  onClick={async () => {
                    setIsDownloadingPdf(true);
                    await downloadElementAsPdf(
                      'quotation-printable-area',
                      `${quoteNumber}-${event.title.replace(/[^a-zA-Z0-9]/g, '_')}`,
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
                    printElementById('quotation-printable-area', {
                      title: `${quoteNumber}-${event.title}`,
                      orientation: 'portrait'
                    });
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
                      Catering Proposal
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
                    <div>Quote #: <strong>{quoteNumber}</strong></div>
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
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Logistics, Transport &amp; Extra Charges</div>
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
                        <span>Logistics, Transport &amp; Extras:</span>
                        <strong>₹{extrasTotal.toLocaleString('en-IN')}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '6px', marginTop: '6px', fontSize: '1.1rem', fontWeight: 800 }}>
                      <span>Total Estimate:</span>
                      <span style={{ color: 'var(--primary)' }}>₹{displayTotal.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Payment & Bank Details (Respects Enable/Disable Toggles) */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem', fontSize: '0.8rem' }}>
                  <div>
                    {event.show_bank_details !== false && (
                      <div style={{ marginBottom: event.show_payment_details !== false ? '6px' : 0 }}>
                        <div style={{ fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', marginBottom: '4px' }}>
                          Official Bank Details
                        </div>
                        <div>Bank: <strong>{state.settings.bank_name || 'Federal Bank'}</strong></div>
                        <div>Account Name: <strong>{state.settings.account_name || state.settings.name}</strong></div>
                        <div>A/C No: <strong>{state.settings.account_number || '9876-5432-1000'}</strong> &bull; IFSC: <strong>{state.settings.ifsc_code || 'FDRL0001234'}</strong></div>
                        <div>UPI ID: <strong>{state.settings.upi_id || 'ippas@upi'}</strong></div>
                      </div>
                    )}
                    {event.show_payment_details !== false && (
                      <div>
                        <div style={{ fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', marginBottom: '2px' }}>
                          Payment Terms
                        </div>
                        <div style={{ color: '#dc2626', fontWeight: 600 }}>
                          {event.payment_terms || state.settings.payment_terms || 'Payment strictly due within 3 days. 50% advance deposit upon confirmation.'}
                        </div>
                      </div>
                    )}
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
                    printElementById('stock-estimation-printable-area', {
                      title: `Stock-Estimation-${event.title}`,
                      orientation: 'portrait'
                    });
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
      {selectedInvoiceForPrint && (() => {
        const liveInv =
          state.invoices.find((i) => i.id === selectedInvoiceForPrint.id) || selectedInvoiceForPrint;
        const paymentsForThis = state.payments.filter((p) => p.invoice_id === liveInv.id);
        const totalPaidThis = paymentsForThis.reduce((s, p) => s + p.amount, 0);
        const balanceDue = Math.max(0, liveInv.amount - totalPaidThis);
        const isFullyPaid = liveInv.status === 'paid' || (liveInv.amount > 0 && balanceDue <= 0);
        const isFinalSettlement = isFullyPaid || liveInv.kind === 'final';
        const showBankDetails = liveInv.show_bank_details !== false;
        const showPaymentDetails = liveInv.show_payment_details !== false;
        const quoteRef = liveInv.quotation_number || quoteNumber;

        return (
          <div className="modal-overlay" onClick={() => setSelectedInvoiceForPrint(null)}>
            <div
              className="modal-content print-page"
              style={{ maxWidth: '780px', width: '96%', background: '#ffffff' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Toolbar */}
              <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                    🧾 {isFinalSettlement ? 'Final Settlement Invoice' : 'Official Invoice'} ({liveInv.invoice_number})
                  </span>
                  <span className="badge" style={{ background: isFullyPaid ? '#dcfce7' : '#eff6ff', color: isFullyPaid ? '#15803d' : '#1d4ed8', fontWeight: 700 }}>
                    {isFullyPaid ? '✓ Paid in Full' : 'A4 Fit'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 600, marginRight: '0.35rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showBankDetails}
                      onChange={(e) => store.updateInvoice(liveInv.id, { show_bank_details: e.target.checked })}
                    />
                    🏦 Bank Details
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontWeight: 600, marginRight: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={showPaymentDetails}
                      onChange={(e) => store.updateInvoice(liveInv.id, { show_payment_details: e.target.checked })}
                    />
                    💳 Payment Details
                  </label>

                  <button
                    className="btn btn-primary btn-sm"
                    disabled={isDownloadingPdf}
                    onClick={async () => {
                      setIsDownloadingPdf(true);
                      await downloadElementAsPdf(
                        'event-invoice-printable-area',
                        `${liveInv.invoice_number}`,
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
                      printElementById('event-invoice-printable-area', {
                        title: `${liveInv.invoice_number}`,
                        orientation: 'portrait'
                      });
                    }}
                  >
                    🖨️ Print A4
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d', fontWeight: 600 }}
                    onClick={() => setSelectedInvoiceForWhatsApp(liveInv)}
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
                      <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: isFinalSettlement ? '2rem' : '2.4rem', margin: 0, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
                        {isFinalSettlement ? 'Final Settlement' : 'Invoice'}
                      </h1>
                      <div style={{ fontSize: '0.8rem', color: isFullyPaid ? '#15803d' : '#64748b', fontWeight: isFullyPaid ? 700 : 500, marginTop: '4px' }}>
                        {isFinalSettlement ? 'Final Settlement Invoice' : 'Advance / Booking Invoice'}
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
                      <div>Event: <strong>{event.title}</strong> ({event.event_date})</div>
                      <div>Venue: <strong>{event.venue || 'Client Venue'}</strong> &bull; <strong>{event.guest_count} Pax</strong></div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div>Invoice No: <strong>{liveInv.invoice_number}</strong></div>
                      <div>Quote Ref: <strong>#{quoteRef}</strong></div>
                      <div>Date Issued: <strong>{new Date(liveInv.created_at).toLocaleDateString('en-GB')}</strong></div>
                      {!isFullyPaid && <div>Due Date: <strong>{liveInv.due_date || 'Upon Receipt'}</strong></div>}
                      <div>Stage: <strong style={{ color: isFullyPaid ? '#15803d' : '#0f172a' }}>{isFinalSettlement ? 'Final Settlement' : 'Advance / Booking'}</strong></div>
                    </div>
                  </div>

                  {/* Full Itemized Menu + Logistics, Transport & Extras from Converted Quotation */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', marginBottom: '16px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #0f172a', background: '#f1f5f9' }}>
                        <th style={{ textAlign: 'left', padding: '8px 10px', color: '#0f172a' }}>Dish / Service Particulars</th>
                        <th style={{ textAlign: 'center', padding: '8px 10px', color: '#0f172a' }}>Qty / Pax</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', color: '#0f172a' }}>Rate</th>
                        <th style={{ textAlign: 'right', padding: '8px 10px', color: '#0f172a' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventItems.length === 0 && extras.length === 0 ? (
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px 10px' }}>
                            <div style={{ fontWeight: 700 }}>
                              {isFinalSettlement ? 'Final Catering Contract Settlement' : 'Catering Package & Services'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Event: {event.title} on {event.event_date}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', padding: '10px 10px' }}>{event.guest_count} pax</td>
                          <td style={{ textAlign: 'right', padding: '10px 10px' }}>—</td>
                          <td style={{ textAlign: 'right', padding: '10px 10px', fontWeight: 600 }}>
                            ₹{(liveInv.subtotal || liveInv.amount).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ) : (
                        <>
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
                                <td style={{ textAlign: 'center', padding: '8px 10px' }}>
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
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ fontWeight: 600 }}>{ex.description}</div>
                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Logistics, Transport &amp; Extra Charges</div>
                              </td>
                              <td style={{ textAlign: 'center', padding: '8px 10px' }}>1 Lot</td>
                              <td style={{ textAlign: 'right', padding: '8px 10px' }}>₹{ex.amount.toLocaleString('en-IN')}</td>
                              <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 700 }}>
                                ₹{ex.amount.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  </table>

                  {/* Subtotal, Discount + Discount Note & Net Payable */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                    <div style={{ width: '320px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                        <span>Gross Subtotal:</span>
                        <strong>₹{(liveInv.subtotal || liveInv.amount).toLocaleString('en-IN')}</strong>
                      </div>

                      {liveInv.discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#15803d', gap: '0.5rem' }}>
                          <span>
                            Discount{liveInv.discount_note ? ` (${liveInv.discount_note})` : ''}:
                          </span>
                          <strong>- ₹{liveInv.discount.toLocaleString('en-IN')}</strong>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '6px', marginTop: '6px', fontSize: '1.05rem', fontWeight: 800 }}>
                        <span>Net Invoice Total:</span>
                        <strong>₹{liveInv.amount.toLocaleString('en-IN')}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Part-Payments Table on Same Invoice (Controlled by showPaymentDetails) */}
                  {showPaymentDetails && paymentsForThis.length > 0 && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px', marginBottom: '16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: '#0f172a', marginBottom: '6px' }}>
                        Part-Payment &amp; Settlement Receipts:
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
                        <span>Total Paid: ₹{totalPaidThis.toLocaleString('en-IN')}</span>
                        <span style={{ color: balanceDue > 0 ? '#dc2626' : '#15803d' }}>
                          {isFullyPaid ? '✓ Settled in Full (Balance ₹0)' : `Balance Due: ₹${balanceDue.toLocaleString('en-IN')}`}
                        </span>
                      </div>
                    </div>
                  )}

                  {isFullyPaid && (
                    <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534', borderRadius: '6px', padding: '8px 12px', marginBottom: '14px', fontSize: '0.82rem', fontWeight: 700, textAlign: 'center' }}>
                      ✓ PAID IN FULL — FINAL SETTLEMENT COMPLETED
                    </div>
                  )}

                  {/* Bank Details & Payment Terms (Payment Terms STRICTLY HIDDEN once Fully Paid!) */}
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem', fontSize: '0.8rem' }}>
                    <div>
                      {showBankDetails && (
                        <div style={{ marginBottom: !isFullyPaid && showPaymentDetails ? '6px' : 0 }}>
                          <div style={{ fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', marginBottom: '4px' }}>
                            Official Bank Details
                          </div>
                          <div>Bank: <strong>{state.settings.bank_name || 'Federal Bank'}</strong></div>
                          <div>Account Name: <strong>{state.settings.account_name || state.settings.name}</strong></div>
                          <div>A/C No: <strong>{state.settings.account_number || '9876-5432-1000'}</strong> &bull; IFSC: <strong>{state.settings.ifsc_code || 'FDRL0001234'}</strong></div>
                          <div>UPI ID: <strong>{state.settings.upi_id || 'ippas@upi'}</strong></div>
                        </div>
                      )}

                      {!isFullyPaid && showPaymentDetails && (
                        <div>
                          <div style={{ fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', marginBottom: '2px' }}>
                            Payment Terms
                          </div>
                          <div style={{ color: '#dc2626', fontWeight: 600 }}>
                            {event.payment_terms || state.settings.payment_terms || 'Payment strictly due within 3 days.'}
                          </div>
                        </div>
                      )}
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
        );
      })()}

      {/* ----------------------------------------------------------------------------------- */}
      {/* MODAL 4: EDIT INVOICE MODAL (SUBTOTAL / DISCOUNT / VISIBILITY ON SAME INVOICE) */}
      {/* ----------------------------------------------------------------------------------- */}
      {editingInvoice && (
        <div className="modal-overlay" onClick={() => setEditingInvoice(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                Edit Invoice {editingInvoice.invoice_number}
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingInvoice(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveInvoiceEdit}>
              <div className="grid-2">
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
              </div>

              <div className="form-group">
                <label className="form-label">Discount Details / Reason</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Special wedding concession / Client loyalty discount"
                  value={editInvForm.discount_note}
                  onChange={(e) => setEditInvForm({ ...editInvForm, discount_note: e.target.value })}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem' }}>Net Amount:</span>
                <strong style={{ color: 'var(--primary)' }}>
                  ₹{Math.max(0, editInvForm.subtotal - editInvForm.discount).toLocaleString('en-IN')}
                </strong>
              </div>

              <div className="grid-2">
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
                    <option value="paid">Paid in Full (Final Settlement)</option>
                    <option value="void">Void</option>
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                  padding: '0.65rem 0.85rem',
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  marginBottom: '1rem'
                }}
              >
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editInvForm.show_bank_details}
                    onChange={(e) => setEditInvForm({ ...editInvForm, show_bank_details: e.target.checked })}
                  />
                  🏦 Show Bank Details on Invoice
                </label>

                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editInvForm.show_payment_details}
                    onChange={(e) => setEditInvForm({ ...editInvForm, show_payment_details: e.target.checked })}
                  />
                  💳 Show Payment Details on Invoice
                </label>
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

      {/* WhatsApp Quotation PDF & Message Share Modal */}
      <QuotationWhatsAppModal
        event={event}
        isOpen={isQuoteWhatsAppOpen}
        onClose={() => setIsQuoteWhatsAppOpen(false)}
      />

      {/* WhatsApp Invoice PDF Share Modal */}
      <WhatsAppShareModal
        invoice={selectedInvoiceForWhatsApp}
        isOpen={Boolean(selectedInvoiceForWhatsApp)}
        onClose={() => setSelectedInvoiceForWhatsApp(null)}
      />

      {/* Staff Duty Assignment WhatsApp Notification Module */}
      <StaffWhatsAppModal
        isOpen={isStaffWhatsAppOpen}
        onClose={() => {
          setIsStaffWhatsAppOpen(false);
          setSelectedShiftForWhatsApp(null);
          setShiftModalInitialNote('');
        }}
        event={event}
        targetShift={selectedShiftForWhatsApp}
        initialNote={shiftModalInitialNote}
      />
    </div>
  );
}
