'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { store, StockEstimationItem } from '@/lib/store';
import { EventRecord, EventStatus, MenuItem, Invoice, Payment, PricingType } from '@/lib/types';
import { downloadElementAsPdf } from '@/lib/downloadPdf';

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

  // New Invoice form with Discount
  const [invKind, setInvKind] = useState<'deposit' | 'final'>('deposit');
  const [invSubtotal, setInvSubtotal] = useState<number>(50000);
  const [invDiscount, setInvDiscount] = useState<number>(0);
  const [invDueDate, setInvDueDate] = useState('');
  const [invNotes, setInvNotes] = useState('');

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

  // Record Part-Payment modal state (against the same invoice)
  const [partPayInvoice, setPartPayInvoice] = useState<Invoice | null>(null);
  const [partPayAmount, setPartPayAmount] = useState<number>(0);
  const [partPayMethod, setPartPayMethod] = useState('bank transfer');
  const [partPayNote, setPartPayNote] = useState('');

  // Per-kg item quantity staging when adding dishes
  const [kgQuantities, setKgQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

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
  const canEditOps = role === 'owner' || role === 'manager';
  const isFinance = role === 'owner' || role === 'accountant';

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

  // Estimated staff cost
  let estimatedStaffCost = 0;
  shifts.forEach((sh) => {
    const staffMember = state.staff.find((st) => st.id === sh.staff_member_id);
    if (staffMember) {
      const startH = parseInt(sh.starts_at.slice(11, 13) || '17');
      const endH = parseInt(sh.ends_at.slice(11, 13) || '23');
      const hours = Math.max(1, endH >= startH ? endH - startH : 24 - startH + endH);
      estimatedStaffCost += hours * staffMember.hourly_rate;
    }
  });

  const handleUpdateDetails = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateEvent(event.id, editForm);
    alert('Event details updated successfully.');
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

  // Create Invoice with Subtotal and Discount
  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const net = Math.max(0, invSubtotal - invDiscount);
    store.addInvoice({
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
    alert('Invoice generated successfully.');
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

    setPartPayInvoice(inv);
    setPartPayAmount(balance);
    setPartPayMethod('bank transfer');
    setPartPayNote(`Part payment against ${inv.invoice_number}`);
  };

  const handleSavePartPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partPayInvoice || partPayAmount <= 0) return;

    store.addPayment({
      invoice_id: partPayInvoice.id,
      amount: partPayAmount,
      method: partPayMethod,
      note: partPayNote
    });

    setPartPayInvoice(null);
    alert('Part payment recorded on the invoice successfully.');
  };

  return (
    <div>
      {/* Navigation Breadcrumb */}
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/events" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          &larr; Back to Events list
        </Link>
      </div>

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

        {/* Header Actions: A4 PDF Quotation & Total */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setIsPrintQuoteOpen(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
            >
              📄 Print / Download A4 Quotation PDF
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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem', overflowX: 'auto' }}>
        <button
          className={`btn ${activeTab === 'quote' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('quote')}
        >
          🍽️ Menu &amp; Quote ({eventItems.length})
        </button>
        <button
          className={`btn ${activeTab === 'stock' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('stock')}
        >
          📦 Stock Estimation A4 ({stockEst.items.length})
        </button>
        <button
          className={`btn ${activeTab === 'shifts' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('shifts')}
        >
          👥 Staff Shifts ({shifts.length})
        </button>
        <button
          className={`btn ${activeTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('invoices')}
        >
          🧾 Invoices &amp; Part-Payments ({invoices.length})
        </button>
        <button
          className={`btn ${activeTab === 'details' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('details')}
        >
          ⚙️ Edit Details
        </button>
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
                        {canEditOps && <th style={{ textAlign: 'center' }}>Remove</th>}
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
                            {canEditOps && (
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
                          {canEditOps && <th style={{ textAlign: 'center' }}>Remove</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {extras.map((ex) => (
                          <tr key={ex.id}>
                            <td>{ex.description}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>
                              ₹{ex.amount.toLocaleString('en-IN')}
                            </td>
                            {canEditOps && (
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
                {canEditOps && (
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
                            canEditOps && (
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

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                  onClick={() => setIsPrintStockOpen(true)}
                >
                  🖨️ Print / Download A4 Stock Estimation Sheet
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
          {/* Shifts table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="card-title" style={{ margin: 0 }}>Scheduled Staff Shifts</h2>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>
                Est. Staff Cost: ₹{estimatedStaffCost.toLocaleString('en-IN')}
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
                      <th>Role</th>
                      <th>Times</th>
                      <th>Rate</th>
                      {canEditOps && <th style={{ textAlign: 'center' }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((sh) => {
                      const staffMember = state.staff.find((st) => st.id === sh.staff_member_id);
                      return (
                        <tr key={sh.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{staffMember?.name || 'Unknown'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {staffMember?.phone}
                            </div>
                          </td>
                          <td>
                            <span className="badge" style={{ background: '#f1f5f9' }}>
                              {sh.role_label || staffMember?.role_title}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem' }}>
                            {sh.starts_at.slice(11, 16)} - {sh.ends_at.slice(11, 16)}
                          </td>
                          <td style={{ fontWeight: 600 }}>₹{staffMember?.hourly_rate}/hr</td>
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

          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            {/* Invoices list with Part-Payments on Same Invoice */}
            <div className="card">
              <h2 className="card-title">Event Invoices</h2>
              {invoices.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No invoices generated for this event yet. Create one using the form on the right.
                </p>
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

                                {isFinance && (
                                  <>
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      title="Record Part-Payment on this invoice"
                                      onClick={() => handleOpenPartPayment(inv)}
                                      style={{ fontWeight: 600 }}
                                    >
                                      + Part Pay
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
                      <th>Method</th>
                      <th>Notes / Reference</th>
                      <th style={{ textAlign: 'right' }}>Amount Paid</th>
                      {isFinance && <th style={{ textAlign: 'center' }}>Remove</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {state.payments
                      .filter((p) => invoices.some((i) => i.id === p.invoice_id))
                      .map((pmt) => {
                        const inv = invoices.find((i) => i.id === pmt.invoice_id);
                        return (
                          <tr key={pmt.id}>
                            <td>{pmt.paid_at.slice(0, 10)}</td>
                            <td>
                              <span style={{ fontWeight: 700 }}>{inv?.invoice_number}</span>
                            </td>
                            <td style={{ textTransform: 'capitalize' }}>{pmt.method}</td>
                            <td style={{ fontSize: '0.85rem' }}>{pmt.note || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
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
        <div className="card" style={{ maxWidth: '750px' }}>
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
                              <th style={{ textAlign: 'left', padding: '4px' }}>Method</th>
                              <th style={{ textAlign: 'left', padding: '4px' }}>Note / Reference</th>
                              <th style={{ textAlign: 'right', padding: '4px' }}>Amount Paid</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentsForThis.map((pmt) => (
                              <tr key={pmt.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '4px' }}>{pmt.paid_at.slice(0, 10)}</td>
                                <td style={{ padding: '4px', textTransform: 'capitalize' }}>{pmt.method}</td>
                                <td style={{ padding: '4px', color: '#64748b' }}>{pmt.note || '—'}</td>
                                <td style={{ padding: '4px', textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                                  ₹{pmt.amount.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            ))}
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

              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select
                  className="form-control"
                  value={partPayMethod}
                  onChange={(e) => setPartPayMethod(e.target.value)}
                >
                  <option value="bank transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="upi">UPI / GPay / PhonePe</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Card</option>
                </select>
              </div>

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
    </div>
  );
}
