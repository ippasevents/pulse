'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { store } from '@/lib/store';
import { EventRecord, EventStatus, MenuItem, Invoice } from '@/lib/types';
import { downloadElementAsPdf } from '@/lib/downloadPdf';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params?.id as string;

  const [state, setState] = useState(store.getState());
  const [activeTab, setActiveTab] = useState<'quote' | 'stock' | 'shifts' | 'invoices' | 'details'>('quote');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Unlock option for Quotation (defaults to locked to protect confirmed/quoted data)
  const [isQuoteLocked, setIsQuoteLocked] = useState(true);

  // Print Modals
  const [isPrintQuoteOpen, setIsPrintQuoteOpen] = useState(false);
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<Invoice | null>(null);
  const [printOrientation, setPrintOrientation] = useState<'landscape' | 'portrait'>('landscape');

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

  // New Invoice form
  const [invKind, setInvKind] = useState<'deposit' | 'final'>('deposit');
  const [invAmount, setInvAmount] = useState<number>(50000);
  const [invDueDate, setInvDueDate] = useState('');

  // Unlock / Edit Invoice modal state
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [editInvForm, setEditInvForm] = useState({
    amount: 0,
    kind: 'deposit' as 'deposit' | 'final',
    due_date: '',
    status: 'draft' as Invoice['status']
  });

  // Record Payment form
  const [payInvId, setPayInvId] = useState('');
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('bank transfer');

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
      if (event.status === 'inquiry') {
        setIsQuoteLocked(false);
      }
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

  // Ingredient needs calculation
  const ingredientNeedsMap: Record<string, { needed: number; ingredient: any }> = {};
  eventItems.forEach((item) => {
    const recipesForDish = state.recipes.filter((r) => r.menu_item_id === item.menu_item_id);
    recipesForDish.forEach((r) => {
      const ing = state.ingredients.find((i) => i.id === r.ingredient_id);
      if (ing) {
        if (!ingredientNeedsMap[ing.id]) {
          ingredientNeedsMap[ing.id] = { needed: 0, ingredient: ing };
        }
        ingredientNeedsMap[ing.id].needed += r.qty_per_guest * event.guest_count;
      }
    });
  });
  const ingredientNeeds = Object.values(ingredientNeedsMap);

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

  const handleAddDish = (dish: MenuItem) => {
    if (isQuoteLocked) {
      alert('Quotation is currently locked. Click "Unlock Quote" to make edits.');
      return;
    }
    store.setEventItem(event.id, dish.id, dish.price_per_guest);
  };

  const handleRemoveDish = (dishId: string) => {
    if (isQuoteLocked) {
      alert('Quotation is currently locked. Click "Unlock Quote" to remove items.');
      return;
    }
    store.removeEventItem(event.id, dishId);
  };

  const handleAddExtra = (e: React.FormEvent) => {
    e.preventDefault();
    if (isQuoteLocked) {
      alert('Quotation is currently locked. Click "Unlock Quote" to add charges.');
      return;
    }
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

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    store.addInvoice({
      event_id: event.id,
      kind: invKind,
      amount: invAmount,
      due_date: invDueDate || event.event_date,
      status: 'draft'
    });
  };

  const handleOpenEditInvoice = (inv: Invoice) => {
    setEditingInvoice(inv);
    setEditInvForm({
      amount: inv.amount,
      kind: inv.kind,
      due_date: inv.due_date || '',
      status: inv.status
    });
  };

  const handleSaveInvoiceEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoice) return;
    store.updateInvoice(editingInvoice.id, editInvForm);
    setEditingInvoice(null);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payInvId || payAmount <= 0) return;
    store.addPayment({
      invoice_id: payInvId,
      amount: payAmount,
      method: payMethod
    });
    setPayAmount(0);
  };

  return (
    <div>
      {/* Back button */}
      <div style={{ marginBottom: '0.75rem' }}>
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

        {/* Header Actions: Print Quotation PDF & Unlock Quote */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setIsPrintQuoteOpen(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
            >
              📄 Print / Save Quote as PDF
            </button>

            {canEditOps && (
              <button
                onClick={() => setIsQuoteLocked(!isQuoteLocked)}
                className={`btn btn-sm ${isQuoteLocked ? 'btn-secondary' : 'btn-secondary'}`}
                style={{
                  border: isQuoteLocked ? '1px solid #cbd5e1' : '1px solid var(--success)',
                  color: isQuoteLocked ? 'var(--text-main)' : 'var(--success)',
                  fontWeight: 600
                }}
              >
                {isQuoteLocked ? '🔓 Unlock Quote' : '🔒 Lock Quote'}
              </button>
            )}
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
          📦 Stock vs. Needed ({ingredientNeeds.length})
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
          🧾 Invoices &amp; Payments ({invoices.length})
        </button>
        <button
          className={`btn ${activeTab === 'details' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderRadius: '6px 6px 0 0', borderBottom: 'none' }}
          onClick={() => setActiveTab('details')}
        >
          ⚙️ Edit Details
        </button>
      </div>

      {/* TAB 1: MENU & QUOTE */}
      {activeTab === 'quote' && (
        <div>
          {/* Unlock Option Notification Banner */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1.25rem',
              background: isQuoteLocked ? '#f8fafc' : '#f0fdf4',
              border: isQuoteLocked ? '1px solid #e2e8f0' : '1px solid #86efac',
              color: isQuoteLocked ? '#334155' : '#166534'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              <span style={{ fontSize: '1.1rem' }}>{isQuoteLocked ? '🔒' : '🔓'}</span>
              <span>
                {isQuoteLocked ? (
                  <>
                    <strong>Quotation is Locked:</strong> Rates and menu dish selections are protected from unintended alterations.
                  </>
                ) : (
                  <>
                    <strong>Quotation is Unlocked for Editing:</strong> You can add or remove dishes, adjust catalog items, and edit extra lines.
                  </>
                )}
              </span>
            </div>

            {canEditOps && (
              <button
                type="button"
                className={`btn btn-sm ${isQuoteLocked ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIsQuoteLocked(!isQuoteLocked)}
              >
                {isQuoteLocked ? '🔓 Unlock Quote for Editing' : '🔒 Lock Quote'}
              </button>
            )}
          </div>

          <div className="grid-2">
            {/* Chosen dishes quote */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 className="card-title" style={{ margin: 0 }}>
                  Event Menu Quote ({event.guest_count} Guests)
                </h2>
                <button
                  onClick={() => setIsPrintQuoteOpen(true)}
                  className="btn btn-secondary btn-sm"
                  title="Preview Quotation PDF with Logo"
                >
                  📄 PDF Preview
                </button>
              </div>

              {eventItems.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No dishes added to this event yet.{' '}
                  {isQuoteLocked ? 'Unlock the quote above to select dishes.' : 'Select dishes from the culinary catalog on the right.'}
                </p>
              ) : (
                <div className="data-table-container" style={{ marginBottom: '1.25rem' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Dish</th>
                        <th style={{ textAlign: 'right' }}>Per Guest</th>
                        <th style={{ textAlign: 'right' }}>Line Total</th>
                        {canEditOps && <th style={{ textAlign: 'center' }}>Remove</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {eventItems.map((item) => {
                        const dish = state.menuItems.find((m) => m.id === item.menu_item_id);
                        const lineTotal = item.price_per_guest * event.guest_count;
                        return (
                          <tr key={item.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{dish ? dish.name : 'Unknown Dish'}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {dish?.category}
                              </div>
                            </td>
                            <td style={{ textAlign: 'right' }}>₹{item.price_per_guest}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{lineTotal.toLocaleString('en-IN')}</td>
                            {canEditOps && (
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleRemoveDish(item.menu_item_id)}
                                  disabled={isQuoteLocked}
                                  title={isQuoteLocked ? 'Quotation is locked. Unlock above to edit.' : 'Remove dish'}
                                  style={{ opacity: isQuoteLocked ? 0.4 : 1, cursor: isQuoteLocked ? 'not-allowed' : 'pointer' }}
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

              {/* Extras Section */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '1rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Additional Quote Items (Equipment, Logistics, Fees)
                </h3>
                {!isFinance ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Additional quote charges and fees are restricted to Owner / Accountant roles.
                  </p>
                ) : (
                  <div>
                    {extras.map((ex) => (
                      <div
                        key={ex.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.5rem 0',
                          borderBottom: '1px dashed var(--border)',
                          fontSize: '0.875rem'
                        }}
                      >
                        <span>{ex.description}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontWeight: 600 }}>₹{ex.amount.toLocaleString('en-IN')}</span>
                          {canEditOps && !isQuoteLocked && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => store.removeEventExtra(ex.id)}
                              style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {canEditOps && !isQuoteLocked && (
                      <form onSubmit={handleAddExtra} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        <input
                          type="text"
                          placeholder="Description (e.g. Copper chaffing dishes, delivery)"
                          className="form-control"
                          value={extraDesc}
                          onChange={(e) => setExtraDesc(e.target.value)}
                          required
                        />
                        <input
                          type="number"
                          placeholder="Amount (₹)"
                          className="form-control"
                          style={{ width: '130px' }}
                          value={extraAmount || ''}
                          onChange={(e) => setExtraAmount(parseFloat(e.target.value) || 0)}
                          required
                        />
                        <button type="submit" className="btn btn-secondary btn-sm">
                          + Add
                        </button>
                      </form>
                    )}

                    {isQuoteLocked && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        🔒 Quote is locked. Unlock above to add or remove extra lines.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Quote Summary Box */}
              <div
                style={{
                  marginTop: '1.5rem',
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '1rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
                  <span>Food &amp; Beverage ({event.guest_count} pax):</span>
                  <span>₹{menuTotal.toLocaleString('en-IN')}</span>
                </div>
                {isFinance && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.35rem' }}>
                    <span>Logistics &amp; Extras:</span>
                    <span>₹{extrasTotal.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    borderTop: '1px solid var(--border)',
                    paddingTop: '0.5rem',
                    marginTop: '0.5rem',
                    color: 'var(--primary)'
                  }}
                >
                  <span>Grand Total:</span>
                  <span>₹{displayTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Dish Catalog to Add */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 className="card-title" style={{ margin: 0 }}>Culinary Catalog</h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isQuoteLocked ? '🔒 Unlock quote to add' : 'Click to add'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '550px', overflowY: 'auto' }}>
                {state.menuItems
                  .filter((m) => m.active)
                  .map((dish) => {
                    const isSelected = selectedMenuItemIds.has(dish.id);
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
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1, paddingRight: '0.5rem' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{dish.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {dish.category} &bull; ₹{dish.price_per_guest}/guest
                          </div>
                          {dish.description && (
                            <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.2rem' }}>
                              {dish.description}
                            </div>
                          )}
                        </div>
                        <div>
                          {isSelected ? (
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)' }}>
                              ✓ Added
                            </span>
                          ) : (
                            canEditOps && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleAddDish(dish)}
                                disabled={isQuoteLocked}
                                style={{ opacity: isQuoteLocked ? 0.5 : 1 }}
                              >
                                {isQuoteLocked ? '🔒 Locked' : '+ Add'}
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

      {/* TAB 2: STOCK VS. NEEDED */}
      {activeTab === 'stock' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>Ingredient Requirements vs. Inventory Stock</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Aggregates exact quantities needed for {event.guest_count} guests based on dish recipes.
              </p>
            </div>
            <Link href="/stock" className="btn btn-secondary btn-sm">
              Manage Warehouse Stock &rarr;
            </Link>
          </div>

          {ingredientNeeds.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No recipe ingredient data available for the dishes selected. Add recipes in the <strong>Menu &amp; Recipes</strong> tab.
            </p>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Unit</th>
                    <th style={{ textAlign: 'right' }}>Needed for {event.guest_count} Guests</th>
                    <th style={{ textAlign: 'right' }}>Current Warehouse Stock</th>
                    <th style={{ textAlign: 'center' }}>Stock Status</th>
                    <th style={{ textAlign: 'right' }}>Est. Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredientNeeds.map(({ needed, ingredient }) => {
                    const isDeficit = ingredient.stock_qty < needed;
                    const deficitQty = Math.max(0, needed - ingredient.stock_qty);
                    const cost = needed * ingredient.cost_per_unit;

                    return (
                      <tr key={ingredient.id} style={{ background: isDeficit ? '#fff5f5' : 'transparent' }}>
                        <td style={{ fontWeight: 600 }}>{ingredient.name}</td>
                        <td>{ingredient.unit}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {needed.toFixed(2)} {ingredient.unit}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {ingredient.stock_qty.toFixed(2)} {ingredient.unit}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isDeficit ? (
                            <span
                              className="badge"
                              style={{ background: '#fee2e2', color: '#b91c1c' }}
                            >
                              ⚠️ Deficit: Short by {deficitQty.toFixed(1)} {ingredient.unit}
                            </span>
                          ) : (
                            <span
                              className="badge"
                              style={{ background: '#dcfce7', color: '#15803d' }}
                            >
                              ✓ Sufficient Stock
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ₹{Math.round(cost).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SHIFTS & STAFF */}
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
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  System will automatically alert you if this staff member has overlapping events on {event.event_date}.
                </p>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: INVOICES & PAYMENTS */}
      {activeTab === 'invoices' && (
        <div>
          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            {/* Invoices list */}
            <div className="card">
              <h2 className="card-title">Event Invoices</h2>
              {invoices.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No invoices generated for this event yet.
                </p>
              ) : (
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Type</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => {
                        const waText = encodeURIComponent(
                          `Hello ${client?.name}, here is the invoice ${inv.invoice_number} from ${state.settings.name} for ${event.title}. Amount: ₹${inv.amount.toLocaleString('en-IN')}. Due date: ${inv.due_date || 'immediate'}. Thank you!`
                        );
                        const waUrl = `https://wa.me/${client?.phone?.replace(/[^0-9]/g, '') || ''}?text=${waText}`;

                        return (
                          <tr key={inv.id}>
                            <td style={{ fontWeight: 600 }}>{inv.invoice_number}</td>
                            <td>
                              <span className="badge" style={{ background: '#f1f5f9' }}>
                                {inv.kind}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              ₹{inv.amount.toLocaleString('en-IN')}
                            </td>
                            <td>
                              <span className={`badge badge-${inv.status}`}>{inv.status}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  title="Print on A4 with Logo"
                                  onClick={() => setSelectedInvoiceForPrint(inv)}
                                >
                                  🖨️ PDF
                                </button>

                                {isFinance && (
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    title="Unlock / Edit Invoice"
                                    onClick={() => handleOpenEditInvoice(inv)}
                                  >
                                    🔓 Unlock
                                  </button>
                                )}

                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-secondary btn-sm"
                                  title="Send WhatsApp invoice"
                                >
                                  💬 WA
                                </a>
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

            {/* Create Invoice form */}
            {isFinance ? (
              <div className="card">
                <h2 className="card-title">Generate New Invoice</h2>
                <form onSubmit={handleCreateInvoice}>
                  <div className="form-group">
                    <label className="form-label">Invoice Kind</label>
                    <select
                      className="form-control"
                      value={invKind}
                      onChange={(e) => setInvKind(e.target.value as any)}
                    >
                      <option value="deposit">Deposit / Advance</option>
                      <option value="final">Final Balance Settlement</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Amount (INR ₹) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={invAmount}
                      onChange={(e) => setInvAmount(parseFloat(e.target.value) || 0)}
                      required
                    />
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

                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    Generate Invoice
                  </button>
                </form>
              </div>
            ) : (
              <div className="card" style={{ background: '#f8fafc' }}>
                <h2 className="card-title">Invoicing Permissions</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  As <em>{role}</em>, you have read-only visibility into invoices. Creating new invoices and logging payments requires Owner or Accountant role.
                </p>
              </div>
            )}
          </div>

          {/* Payments Section */}
          {isFinance && (
            <div className="grid-2">
              <div className="card">
                <h2 className="card-title">Recorded Payments for Event</h2>
                {state.payments.filter((p) => invoices.some((i) => i.id === p.invoice_id)).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No payments recorded yet.
                  </p>
                ) : (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Invoice</th>
                          <th>Method</th>
                          <th style={{ textAlign: 'right' }}>Amount Paid</th>
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
                                <td>{inv?.invoice_number}</td>
                                <td style={{ textTransform: 'capitalize' }}>{pmt.method}</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>
                                  ₹{pmt.amount.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {invoices.length > 0 && (
                <div className="card">
                  <h2 className="card-title">Record Payment Receipt</h2>
                  <form onSubmit={handleRecordPayment}>
                    <div className="form-group">
                      <label className="form-label">Against Invoice *</label>
                      <select
                        className="form-control"
                        value={payInvId}
                        onChange={(e) => setPayInvId(e.target.value)}
                        required
                      >
                        <option value="">Select invoice...</option>
                        {invoices.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.invoice_number} ({i.kind} - ₹{i.amount.toLocaleString('en-IN')})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Amount (₹) *</label>
                      <input
                        type="number"
                        className="form-control"
                        value={payAmount || ''}
                        onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Payment Method</label>
                      <select
                        className="form-control"
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value)}
                      >
                        <option value="bank transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                        <option value="upi">UPI / GPay / PhonePe</option>
                        <option value="card">Credit / Debit Card</option>
                        <option value="cash">Cash</option>
                      </select>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                      Save Payment
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: EDIT DETAILS */}
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

      {/* A4 PRINTABLE QUOTATION MODAL (WITH WIDE A4 & LOGO INCLUDED) */}
      {isPrintQuoteOpen && (
        <div className="modal-overlay" onClick={() => setIsPrintQuoteOpen(false)}>
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
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>📄 Official Quotation (A4 PDF)</span>
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
                    await downloadElementAsPdf(
                      'quotation-printable-area',
                      `Quotation-${event.title.replace(/[^a-zA-Z0-9]/g, '_')}`,
                      { orientation: printOrientation }
                    );
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
                <button className="btn btn-secondary btn-sm" onClick={() => setIsPrintQuoteOpen(false)}>
                  Close
                </button>
              </div>
            </div>

            {/* Scrollable Container for mobile preview */}
            <div className="wide-scroll-container">
              {(() => {
                const isWide = printOrientation === 'landscape';

                return (
                  <div
                    id="quotation-printable-area"
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
                    {/* Header with Official Logo and Serif Title */}
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
                          Quotation
                        </h1>
                        <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.35rem', fontWeight: 500 }}>
                          Commercial Catering Proposal
                        </div>
                      </div>
                    </div>

                    {/* Metadata Section */}
                    {isWide ? (
                      /* 3-Column Wide Metadata Layout */
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: '2rem', marginBottom: '2.25rem', background: '#f8fafc', padding: '1.25rem 1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '0.4rem' }}>
                            Prepared For (Client):
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
                            <div style={{ fontWeight: 600, color: '#111827' }}>{event.title}</div>
                            <div style={{ color: '#334155' }}>
                              📅 Date: <strong>{new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                            </div>
                            {event.venue && <div style={{ color: '#334155' }}>📍 Venue: {event.venue}</div>}
                            <div style={{ color: '#334155' }}>
                              👥 Pax Count: <strong>{event.guest_count} Guests</strong>
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: '0.4rem' }}>
                            Quotation Details:
                          </div>
                          <div style={{ fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.5 }}>
                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>
                              QTN-{event.id.replace(/[^0-9]/g, '').slice(-4) || '1001'}
                            </div>
                            <div>
                              Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                            <div style={{ color: '#475569' }}>
                              Validity: 14 Days from issuance
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
                                  background: event.status === 'confirmed' ? '#dcfce7' : '#fef3c7',
                                  color: event.status === 'confirmed' ? '#15803d' : '#b45309'
                                }}
                              >
                                {event.status === 'confirmed' ? 'Confirmed' : 'Estimate / Proposal'}
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
                            <div>{event.venue || client?.company || '123 Anywhere St., Any City'}</div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', fontSize: '0.9rem', color: '#1f2937', lineHeight: 1.5 }}>
                          <div style={{ fontWeight: 600, color: '#111827' }}>
                            Quotation No. QTN-{event.id.replace(/[^0-9]/g, '').slice(-4) || '1001'}
                          </div>
                          <div>
                            {new Date().toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#4b5563', marginTop: '0.2rem' }}>
                            Event Date: <strong>{new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                            Guests: {event.guest_count} Pax &bull; {event.title}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Wide Table with Full-Width Columns */}
                    <div style={{ marginBottom: '1.75rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '2.5px solid #111827', background: isWide ? '#f8fafc' : 'transparent' }}>
                            <th style={{ textAlign: 'left', padding: '0.75rem 0.6rem', fontWeight: 700, color: '#111827' }}>Item &amp; Description</th>
                            <th style={{ textAlign: 'center', padding: '0.75rem 0.6rem', fontWeight: 700, color: '#111827', width: isWide ? '15%' : '20%' }}>Quantity / Pax</th>
                            <th style={{ textAlign: 'right', padding: '0.75rem 0.6rem', fontWeight: 700, color: '#111827', width: isWide ? '18%' : '20%' }}>Rate per Pax</th>
                            <th style={{ textAlign: 'right', padding: '0.75rem 0.6rem', fontWeight: 700, color: '#111827', width: isWide ? '20%' : '22%' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eventItems.map((item) => {
                            const dish = state.menuItems.find((m) => m.id === item.menu_item_id);
                            const lineTotal = item.price_per_guest * event.guest_count;
                            return (
                              <tr key={item.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                <td style={{ padding: '0.85rem 0.6rem', color: '#1f2937' }}>
                                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{dish?.name || 'Menu Dish'}</div>
                                  {dish?.category && (
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{dish.category}</div>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center', padding: '0.85rem 0.6rem', color: '#1f2937' }}>
                                  {event.guest_count} Pax
                                </td>
                                <td style={{ textAlign: 'right', padding: '0.85rem 0.6rem', color: '#1f2937' }}>
                                  ₹{item.price_per_guest.toLocaleString('en-IN')}
                                </td>
                                <td style={{ textAlign: 'right', padding: '0.85rem 0.6rem', color: '#1f2937', fontWeight: 600 }}>
                                  ₹{lineTotal.toLocaleString('en-IN')}
                                </td>
                              </tr>
                            );
                          })}

                          {extras.map((ex) => (
                            <tr key={ex.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '0.85rem 0.6rem', color: '#1f2937' }}>
                                <div style={{ fontWeight: 600 }}>{ex.description}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Logistics / Equipment / Service</div>
                              </td>
                              <td style={{ textAlign: 'center', padding: '0.85rem 0.6rem', color: '#1f2937' }}>
                                1 Lot
                              </td>
                              <td style={{ textAlign: 'right', padding: '0.85rem 0.6rem', color: '#1f2937' }}>
                                ₹{ex.amount.toLocaleString('en-IN')}
                              </td>
                              <td style={{ textAlign: 'right', padding: '0.85rem 0.6rem', color: '#1f2937', fontWeight: 600 }}>
                                ₹{ex.amount.toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Subtotal & Total Row */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                      <div style={{ width: isWide ? '340px' : '290px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.5rem', fontSize: '0.95rem', fontWeight: 600, color: '#111827' }}>
                          <span>Food &amp; Catering Subtotal</span>
                          <span>₹{menuTotal.toLocaleString('en-IN')}</span>
                        </div>

                        {extras.length > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.5rem', fontSize: '0.9rem', color: '#4b5563' }}>
                            <span>Logistics &amp; Extras</span>
                            <span>₹{extrasTotal.toLocaleString('en-IN')}</span>
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
                            Total Estimate
                          </span>
                          <span style={{ fontSize: '1.35rem', fontWeight: 800 }}>
                            ₹{displayTotal.toLocaleString('en-IN')}
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
                            Payment Terms &amp; Bank Details
                          </div>
                          <div>Bank: <strong>Federal Bank / State Bank of India</strong></div>
                          <div>Account Name: <strong>IPPAS Food Service &amp; Events</strong></div>
                          <div>Account No: <strong>9876-5432-1000</strong> &bull; IFSC: <strong>FDRL0001234</strong></div>
                          <div>Terms: <strong>50% advance deposit upon quotation confirmation</strong></div>
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

      {/* A4 PRINTABLE INVOICE MODAL (WITH WIDE A4 & LOGO INCLUDED) */}
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
                    await downloadElementAsPdf('event-invoice-printable-area', `${selectedInvoiceForPrint.invoice_number}`, {
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
                const paymentsForInv = state.payments
                  .filter((p) => p.invoice_id === inv.id)
                  .reduce((s, p) => s + p.amount, 0);
                const isWide = printOrientation === 'landscape';

                return (
                  <div
                    id="event-invoice-printable-area"
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

                    {/* Metadata Section */}
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
                            <div style={{ fontWeight: 600, color: '#111827' }}>{event.title}</div>
                            <div style={{ color: '#334155' }}>
                              📅 Date: <strong>{new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
                            </div>
                            {event.venue && <div style={{ color: '#334155' }}>📍 Venue: {event.venue}</div>}
                            <div style={{ color: '#334155' }}>
                              👥 Guests: <strong>{event.guest_count} Pax</strong>
                            </div>
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
                            <div>{event.venue || client?.company || '123 Anywhere St., Any City'}</div>
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
                            <th style={{ textAlign: 'left', padding: '0.75rem 0.6rem', fontWeight: 700, color: '#111827' }}>Item &amp; Description</th>
                            <th style={{ textAlign: 'center', padding: '0.75rem 0.6rem', fontWeight: 700, color: '#111827', width: isWide ? '15%' : '20%' }}>Quantity / Pax</th>
                            <th style={{ textAlign: 'right', padding: '0.75rem 0.6rem', fontWeight: 700, color: '#111827', width: isWide ? '18%' : '20%' }}>Unit Price</th>
                            <th style={{ textAlign: 'right', padding: '0.75rem 0.6rem', fontWeight: 700, color: '#111827', width: isWide ? '20%' : '22%' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eventItems.length > 0 ? (
                            eventItems.map((ei) => {
                              const mItem = state.menuItems.find((m) => m.id === ei.menu_item_id);
                              const qty = event.guest_count;
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
                                <div style={{ fontWeight: 600 }}>{event.title}</div>
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

                        {paymentsForInv > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.5rem', fontSize: '0.9rem', color: '#059669', fontWeight: 600 }}>
                            <span>Paid</span>
                            <span>- ₹{paymentsForInv.toLocaleString('en-IN')}</span>
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
            <form onSubmit={handleSaveInvoiceEdit}>
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
