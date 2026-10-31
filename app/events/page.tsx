'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { store } from '@/lib/store';
import { EventRecord, EventStatus } from '@/lib/types';
import QuotationWhatsAppModal from '@/components/QuotationWhatsAppModal';

type EventsTimelineView = 'split' | 'upcoming' | 'previous';

function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatReadableDate(isoDate: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return isoDate;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return dt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function getRelativeDayLabel(isoDate: string, todayIso: string): string {
  if (!isoDate || !todayIso) return '';
  const [y1, m1, d1] = isoDate.split('-').map(Number);
  const [y2, m2, d2] = todayIso.split('-').map(Number);
  if ([y1, m1, d1, y2, m2, d2].some(isNaN)) return '';
  const target = new Date(y1, m1 - 1, d1).getTime();
  const today = new Date(y2, m2 - 1, d2).getTime();
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays <= 30) return `In ${diffDays} days`;
  if (diffDays === -1) return 'Yesterday';
  if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
  return '';
}

export default function EventsPage() {
  const [state, setState] = useState(store.getState());
  const [timelineView, setTimelineView] = useState<EventsTimelineView>('split');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEventForQuoteWA, setSelectedEventForQuoteWA] = useState<EventRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [todayIso, setTodayIso] = useState<string>(() => getLocalTodayIso());

  // New Event Form State
  const [formData, setFormData] = useState({
    client_id: '',
    title: '',
    event_date: getLocalTodayIso(),
    start_time: '18:00',
    end_time: '22:00',
    venue: '',
    guest_count: 100,
    status: 'inquiry' as EventStatus,
    payment_terms: '50% Advance on Booking, Balance on Event Day',
    notes: ''
  });

  // Client Selection / Inline Creation State
  const [isNewClientMode, setIsNewClientMode] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: '',
    phone: '',
    email: '',
    company: '',
    notes: ''
  });

  const paymentTermsPresets = [
    '50% Advance on Booking, Balance on Event Day',
    '30% Advance, 50% Pre-Event, 20% on Event Completion',
    '100% Full Payment on Confirmation',
    'Payment strictly due within 3 days after function'
  ];

  useEffect(() => {
    setTodayIso(getLocalTodayIso());
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role = state.currentRole;
  const canEdit = role === 'owner' || role === 'manager' || role === 'super_admin';
  const isFinance = role === 'owner' || role === 'accountant' || role === 'super_admin';
  const isOwnerView = role === 'owner' || role === 'super_admin';

  // Filter events by search & status first, then cleanly split into Upcoming vs Previous
  const { upcomingEvents, previousEvents, allUpcomingCount, allConfirmedUpcomingCount, allPreviousCount, totalUpcomingGuests } =
    useMemo(() => {
      const q = search.trim().toLowerCase();

      const isUpcomingRecord = (evt: EventRecord) =>
        evt.status !== 'completed' &&
        evt.status !== 'cancelled' &&
        evt.event_date >= todayIso;

      const rawUpcoming = state.events.filter(isUpcomingRecord);
      const rawPrevious = state.events.filter((e) => !isUpcomingRecord(e));

      const matchesFilters = (evt: EventRecord) => {
        const matchesStatus = statusFilter === 'all' || evt.status === statusFilter;
        if (!matchesStatus) return false;
        if (!q) return true;
        const client = state.clients.find((c) => c.id === evt.client_id);
        const quoteNo = store.getQuotationNumber(evt);
        return (
          evt.title.toLowerCase().includes(q) ||
          quoteNo.toLowerCase().includes(q) ||
          Boolean(evt.venue && evt.venue.toLowerCase().includes(q)) ||
          Boolean(client && client.name.toLowerCase().includes(q))
        );
      };

      const upcoming = rawUpcoming
        .filter(matchesFilters)
        .sort((a, b) => a.event_date.localeCompare(b.event_date));

      const previous = rawPrevious
        .filter(matchesFilters)
        .sort((a, b) => b.event_date.localeCompare(a.event_date));

      return {
        upcomingEvents: upcoming,
        previousEvents: previous,
        allUpcomingCount: rawUpcoming.length,
        allConfirmedUpcomingCount: rawUpcoming.filter((e) => e.status === 'confirmed').length,
        allPreviousCount: rawPrevious.length,
        totalUpcomingGuests: rawUpcoming.reduce((sum, e) => sum + (e.guest_count || 0), 0)
      };
    }, [state.events, state.clients, search, statusFilter, todayIso]);

  const nextUpcomingEvent = upcomingEvents[0] || null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setFormError('Please enter an event title.');
      return;
    }

    let targetClientId = formData.client_id;

    if (isNewClientMode) {
      if (!newClientData.name.trim()) {
        setFormError('Please enter the client full name.');
        return;
      }
      const createdClient = store.addClient({
        name: newClientData.name.trim(),
        phone: newClientData.phone.trim() || undefined,
        email: newClientData.email.trim() || undefined,
        company: newClientData.company.trim() || undefined,
        notes: newClientData.notes.trim() || undefined
      });
      targetClientId = createdClient.id;
    } else {
      if (!targetClientId) {
        setFormError('Please select a client from the list or switch to "+ Register New Client".');
        return;
      }
    }

    setFormError(null);
    store.addEvent({
      ...formData,
      client_id: targetClientId
    });

    setIsModalOpen(false);
    setIsNewClientMode(false);
    setNewClientData({ name: '', phone: '', email: '', company: '', notes: '' });
    setFormData({
      client_id: state.clients[0]?.id || '',
      title: '',
      event_date: getLocalTodayIso(),
      start_time: '18:00',
      end_time: '22:00',
      venue: '',
      guest_count: 100,
      status: 'inquiry',
      payment_terms: '50% Advance on Booking, Balance on Event Day',
      notes: ''
    });
  };

  const renderEventsTable = (eventsList: EventRecord[], sectionKind: 'upcoming' | 'previous') => {
    if (eventsList.length === 0) {
      return (
        <div
          style={{
            padding: '2.2rem 1.25rem',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '0.88rem'
          }}
        >
          {sectionKind === 'upcoming'
            ? 'No upcoming catering bookings match your current filter.'
            : 'No previous or completed events match your current filter.'}
        </div>
      );
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>Event &amp; Venue</th>
              <th>Client &amp; Guests</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>
                {sectionKind === 'upcoming' ? 'Quote / Amount' : 'Bill & Expenditure'}
              </th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {eventsList.map((evt) => {
              const client = state.clients.find((c) => c.id === evt.client_id);
              const { grandTotal, menuTotal } = store.getEventTotal(evt.id);
              const displayTotal = isFinance ? grandTotal : menuTotal;
              const finSummary =
                role !== 'staff' ? store.getEventFinancialSummary(evt.id) : null;
              const quoteNo = store.getQuotationNumber(evt);
              const eventInvoice = state.invoices.find(
                (i) => i.event_id === evt.id && i.status !== 'void'
              );
              const relDay = getRelativeDayLabel(evt.event_date, todayIso);

              return (
                <tr key={evt.id}>
                  {/* 1. Date & Schedule */}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div
                      className="tabular-nums"
                      style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.88rem' }}
                    >
                      {formatReadableDate(evt.event_date)}
                    </div>
                    <div
                      className="tabular-nums"
                      style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.12rem' }}
                    >
                      {evt.start_time || '--:--'} – {evt.end_time || '--:--'}
                      {relDay && (
                        <span
                          style={{
                            marginLeft: '0.4rem',
                            color:
                              sectionKind === 'upcoming'
                                ? relDay === 'Today' || relDay === 'Tomorrow'
                                  ? '#be123c'
                                  : '#4f46e5'
                                : '#64748b',
                            fontWeight: 700
                          }}
                        >
                          &middot; {relDay}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 2. Event Title, Venue & Clean Reference Metadata */}
                  <td>
                    <Link
                      href={`/events/${evt.id}`}
                      style={{
                        fontWeight: 700,
                        color: '#0f172a',
                        fontSize: '0.92rem',
                        textDecoration: 'none'
                      }}
                    >
                      {evt.title}
                    </Link>
                    <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '0.15rem' }}>
                      {evt.venue || 'Venue TBD'}
                    </div>
                    <div
                      className="tabular-nums"
                      style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.15rem' }}
                    >
                      <span>Quote #{quoteNo}</span>
                      {eventInvoice && (
                        <>
                          <span aria-hidden="true"> &middot; </span>
                          <span style={{ color: '#047857', fontWeight: 600 }}>
                            Inv #{eventInvoice.invoice_number}
                          </span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* 3. Client & Guest Count */}
                  <td>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.87rem' }}>
                      {client ? client.name : 'Unknown Client'}
                    </div>
                    <div
                      className="tabular-nums"
                      style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.12rem' }}
                    >
                      <strong style={{ color: '#334155' }}>{evt.guest_count} Guests</strong>
                      {client?.phone ? ` · ${client.phone}` : ''}
                    </div>
                  </td>

                  {/* 4. Status */}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className={`badge badge-${evt.status}`}>{evt.status}</span>
                  </td>

                  {/* 5. Financials */}
                  <td className="tabular-nums" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>
                      ₹{displayTotal.toLocaleString('en-IN')}
                    </div>
                    {role !== 'staff' &&
                      finSummary &&
                      (sectionKind === 'previous' || finSummary.totalExpenditure > 0) && (
                        <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.12rem' }}>
                          Spent: ₹{finSummary.totalExpenditure.toLocaleString('en-IN')}
                          {isOwnerView && evt.status === 'completed' && (
                            <span
                              style={{
                                marginLeft: '0.35rem',
                                fontWeight: 700,
                                color: finSummary.netProfit >= 0 ? '#059669' : '#dc2626'
                              }}
                            >
                              &middot; {finSummary.netProfit >= 0 ? '+' : '-'}₹
                              {Math.abs(finSummary.netProfit).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      )}
                  </td>

                  {/* 6. Clean Single-Line Actions */}
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        gap: '0.4rem',
                        alignItems: 'center',
                        justifyContent: 'flex-end'
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{
                          background: '#ecfdf5',
                          borderColor: '#a7f3d0',
                          color: '#047857',
                          fontWeight: 700,
                          whiteSpace: 'nowrap'
                        }}
                        title="Send Quotation PDF + Text on WhatsApp"
                        onClick={() => setSelectedEventForQuoteWA(evt)}
                      >
                        💬 Quote
                      </button>
                      <Link
                        href={`/events/${evt.id}`}
                        className="btn btn-secondary btn-sm"
                        style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                      >
                        Open &rarr;
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: '2rem' }}>
      {/* Clean Page Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Catering Events &amp; Bookings</h1>
          <p className="page-subtitle">
            Manage upcoming banquet schedules and completed catering records in clearly separated views.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setFormData((prev) => ({
                ...prev,
                client_id: state.clients[0]?.id || '',
                event_date: getLocalTodayIso()
              }));
              setIsModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ whiteSpace: 'nowrap', fontWeight: 700 }}
          >
            + New Booking
          </button>
        )}
      </div>

      {/* Simplified 3-Card Colourful Summary Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem'
        }}
      >
        <div
          className="stats-card"
          style={{
            borderTop: '3px solid #4f46e5',
            background: 'linear-gradient(180deg, #eef2ff 0%, #ffffff 72%)'
          }}
        >
          <span className="stats-label" style={{ color: '#4338ca' }}>
            Upcoming Bookings
          </span>
          <span className="stats-value" style={{ color: '#312e81' }}>
            {allUpcomingCount}
          </span>
          <span className="stats-sub">
            Total {totalUpcomingGuests.toLocaleString('en-IN')} guests scheduled
          </span>
        </div>

        <div
          className="stats-card"
          style={{
            borderTop: '3px solid #10b981',
            background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 72%)'
          }}
        >
          <span className="stats-label" style={{ color: '#047857' }}>
            Confirmed Functions
          </span>
          <span className="stats-value" style={{ color: '#065f46' }}>
            {allConfirmedUpcomingCount}
          </span>
          <span className="stats-sub">
            {nextUpcomingEvent
              ? `Next: ${formatReadableDate(nextUpcomingEvent.event_date)} (${nextUpcomingEvent.guest_count} pax)`
              : 'No upcoming dates scheduled'}
          </span>
        </div>

        <div
          className="stats-card"
          style={{
            borderTop: '3px solid #d97706',
            background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 72%)'
          }}
        >
          <span className="stats-label" style={{ color: '#b45309' }}>
            Previous Events
          </span>
          <span className="stats-value" style={{ color: '#92400e' }}>
            {allPreviousCount}
          </span>
          <span className="stats-sub">
            Completed &amp; past catering functions
          </span>
        </div>
      </div>

      {/* Unified Segmented View Switcher + Search & Status Filter */}
      <div
        className="card"
        style={{
          marginBottom: '1.35rem',
          padding: '0.85rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.85rem',
          flexWrap: 'wrap'
        }}
      >
        {/* Interactive Timeline Segmented Controls */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.25rem',
            background: '#f1f5f9',
            borderRadius: '10px',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            onClick={() => setTimelineView('split')}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.81rem',
              fontWeight: timelineView === 'split' ? 700 : 600,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: timelineView === 'split' ? '#ffffff' : 'transparent',
              color: timelineView === 'split' ? '#0f172a' : '#475569',
              boxShadow:
                timelineView === 'split' ? '0 1px 3px rgba(15, 23, 42, 0.1)' : 'none'
            }}
          >
            Split View (Both)
          </button>
          <button
            type="button"
            onClick={() => setTimelineView('upcoming')}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.81rem',
              fontWeight: timelineView === 'upcoming' ? 700 : 600,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: timelineView === 'upcoming' ? '#4f46e5' : 'transparent',
              color: timelineView === 'upcoming' ? '#ffffff' : '#475569'
            }}
          >
            Upcoming ({upcomingEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setTimelineView('previous')}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.81rem',
              fontWeight: timelineView === 'previous' ? 700 : 600,
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: timelineView === 'previous' ? '#d97706' : 'transparent',
              color: timelineView === 'previous' ? '#ffffff' : '#475569'
            }}
          >
            Previous ({previousEvents.length})
          </button>
        </div>

        {/* Search + Status Filter */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            flexWrap: 'wrap',
            flex: '1 1 320px',
            justifyContent: 'flex-end'
          }}
        >
          <input
            type="search"
            placeholder="Search event, client, venue, quote #..."
            className="form-control"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: '300px', padding: '0.46rem 0.75rem', fontSize: '0.85rem' }}
          />
          <select
            className="form-control"
            style={{ width: 'auto', padding: '0.46rem 0.75rem', fontSize: '0.85rem' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="inquiry">Inquiry</option>
            <option value="quoted">Quoted</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* SECTION 1: UPCOMING CATERING EVENTS & BOOKINGS */}
      {(timelineView === 'split' || timelineView === 'upcoming') && (
        <section
          className="data-table-container"
          style={{
            borderTop: '4px solid #4f46e5',
            marginBottom: timelineView === 'split' ? '1.75rem' : 0
          }}
        >
          <div
            style={{
              padding: '0.95rem 1.15rem',
              background: 'linear-gradient(90deg, #eef2ff 0%, #f8fafc 100%)',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '1.02rem',
                  fontWeight: 800,
                  color: '#1e1b4b',
                  margin: 0
                }}
              >
                📅 Upcoming Events &amp; Bookings
              </h2>
              <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.15rem 0 0 0' }}>
                Active inquiries, quotations, and confirmed upcoming functions sorted by nearest date.
              </p>
            </div>
            <span
              className="tabular-nums"
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#4338ca'
              }}
            >
              {upcomingEvents.length} Upcoming
            </span>
          </div>

          {renderEventsTable(upcomingEvents, 'upcoming')}
        </section>
      )}

      {/* SECTION 2: PREVIOUS & COMPLETED EVENTS */}
      {(timelineView === 'split' || timelineView === 'previous') && (
        <section
          className="data-table-container"
          style={{
            borderTop: '4px solid #d97706'
          }}
        >
          <div
            style={{
              padding: '0.95rem 1.15rem',
              background: 'linear-gradient(90deg, #fffbeb 0%, #f8fafc 100%)',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '1.02rem',
                  fontWeight: 800,
                  color: '#78350f',
                  margin: 0
                }}
              >
                🕘 Previous &amp; Completed Events
              </h2>
              <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.15rem 0 0 0' }}>
                Past functions, completed settlements, and archived event records sorted most recent first.
              </p>
            </div>
            <span
              className="tabular-nums"
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#b45309'
              }}
            >
              {previousEvents.length} Previous
            </span>
          </div>

          {renderEventsTable(previousEvents, 'previous')}
        </section>
      )}

      {/* Create New Booking Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>New Catering Booking / Inquiry</h2>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate}>
              {formError && (
                <div
                  style={{
                    background: '#fee2e2',
                    border: '1px solid #fca5a5',
                    color: '#991b1b',
                    padding: '0.6rem 0.85rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    marginBottom: '0.85rem'
                  }}
                >
                  {formError}
                </div>
              )}

              {/* Client Selection: Existing List vs Inline New Client */}
              <div style={{ marginBottom: '1.15rem' }}>
                <div
                  style={{
                    display: 'flex',
                    gap: '0.4rem',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '0.5rem',
                    marginBottom: '0.75rem'
                  }}
                >
                  <button
                    type="button"
                    className={`btn btn-sm ${!isNewClientMode ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      setIsNewClientMode(false);
                      setFormError(null);
                    }}
                  >
                    👥 Existing Client ({state.clients.length})
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${isNewClientMode ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      setIsNewClientMode(true);
                      setFormError(null);
                    }}
                  >
                    ➕ Register New Client
                  </button>
                </div>

                {!isNewClientMode ? (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Client Name *</label>
                    <select
                      className="form-control"
                      value={formData.client_id}
                      onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                      required={!isNewClientMode}
                    >
                      <option value="">Select an existing client...</option>
                      {state.clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.company ? `(${c.company})` : ''} {c.phone ? `• ${c.phone}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '0.85rem'
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: '#0f172a',
                        marginBottom: '0.6rem'
                      }}
                    >
                      New Client Details
                    </div>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>
                          Client Full Name *
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Dr. Mathew Philip"
                          value={newClientData.name}
                          onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                          required={isNewClientMode}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>
                          Phone Number (WhatsApp)
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. +91 98470 12345"
                          value={newClientData.phone}
                          onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>
                          Company / Organization (Optional)
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Apollo Hospital / Malabar Builders"
                          value={newClientData.company}
                          onChange={(e) => setNewClientData({ ...newClientData, company: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.78rem' }}>
                          Email Address (Optional)
                        </label>
                        <input
                          type="email"
                          className="form-control"
                          placeholder="e.g. client@example.com"
                          value={newClientData.email}
                          onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Event Title *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Wedding Reception, Corporate Gala Dinner"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Event Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Guest Count (Pax) *</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={formData.guest_count}
                    onChange={(e) =>
                      setFormData({ ...formData, guest_count: parseInt(e.target.value, 10) || 1 })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Venue Location</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Raviz Kadavu Banquet Hall, Private Villa"
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Payment Terms</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 50% Advance on Booking, Balance on Event Day"
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                />
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                  {paymentTermsPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                      onClick={() => setFormData({ ...formData, payment_terms: preset })}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Booking Status</label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as EventStatus })
                  }
                >
                  <option value="inquiry">Inquiry</option>
                  <option value="quoted">Quoted</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notes &amp; Dietary Requirements</label>
                <textarea
                  rows={2}
                  className="form-control"
                  placeholder="Special instructions, kitchen access, live counters..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '0.75rem',
                  marginTop: '1.25rem'
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 700 }}>
                  Save Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <QuotationWhatsAppModal
        event={selectedEventForQuoteWA}
        isOpen={Boolean(selectedEventForQuoteWA)}
        onClose={() => setSelectedEventForQuoteWA(null)}
      />
    </div>
  );
}
