'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { store } from '@/lib/store';
import { Client } from '@/lib/types';
import OwnerAuditBadge from '@/components/OwnerAuditBadge';

type ClientSortTab = 'all' | 'top_paid' | 'most_events';

interface ClientMetrics {
  client: Client;
  totalEventsCount: number;
  activeOrCompletedEventsCount: number;
  completedEventsCount: number;
  upcomingEventsCount: number;
  totalBilled: number;
  totalPaid: number;
  pendingDue: number;
  lastEventDate: string | null;
}

export default function ClientsPage() {
  const [state, setState] = useState(store.getState());
  const [search, setSearch] = useState('');
  const [sortTab, setSortTab] = useState<ClientSortTab>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    notes: ''
  });

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role = state.currentRole;
  const canEdit = role === 'owner' || role === 'manager' || role === 'super_admin';
  const canSeeFinancials =
    role === 'owner' || role === 'accountant' || role === 'manager' || role === 'super_admin';

  const todayIso = new Date().toISOString().split('T')[0];

  const clientMetricsList: ClientMetrics[] = useMemo(() => {
    return state.clients.map((client) => {
      const allClientEvents = state.events.filter((e) => e.client_id === client.id);
      const nonCancelledEvents = allClientEvents.filter((e) => e.status !== 'cancelled');
      const completedEventsCount = nonCancelledEvents.filter((e) => e.status === 'completed').length;
      const upcomingEventsCount = nonCancelledEvents.filter(
        (e) => e.event_date >= todayIso && e.status !== 'completed'
      ).length;

      const eventIdSet = new Set(allClientEvents.map((e) => e.id));
      const clientInvoices = state.invoices.filter(
        (inv) => eventIdSet.has(inv.event_id) && inv.status !== 'void'
      );
      const invoiceIdSet = new Set(clientInvoices.map((inv) => inv.id));

      const totalBilled = clientInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
      const totalPaid = state.payments
        .filter((p) => invoiceIdSet.has(p.invoice_id))
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const pendingDue = Math.max(0, totalBilled - totalPaid);

      const sortedDates = nonCancelledEvents
        .map((e) => e.event_date)
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a));

      return {
        client,
        totalEventsCount: allClientEvents.length,
        activeOrCompletedEventsCount: nonCancelledEvents.length,
        completedEventsCount,
        upcomingEventsCount,
        totalBilled,
        totalPaid,
        pendingDue,
        lastEventDate: sortedDates[0] || null
      };
    });
  }, [state.clients, state.events, state.invoices, state.payments, todayIso]);

  const topPayingClients = useMemo(() => {
    return [...clientMetricsList]
      .filter((m) => m.totalPaid > 0 || m.totalBilled > 0)
      .sort((a, b) => {
        if (b.totalPaid !== a.totalPaid) return b.totalPaid - a.totalPaid;
        if (b.totalBilled !== a.totalBilled) return b.totalBilled - a.totalBilled;
        return b.activeOrCompletedEventsCount - a.activeOrCompletedEventsCount;
      })
      .slice(0, 5);
  }, [clientMetricsList]);

  const mostEventsClients = useMemo(() => {
    return [...clientMetricsList]
      .filter((m) => m.activeOrCompletedEventsCount > 0)
      .sort((a, b) => {
        if (b.activeOrCompletedEventsCount !== a.activeOrCompletedEventsCount) {
          return b.activeOrCompletedEventsCount - a.activeOrCompletedEventsCount;
        }
        if (b.completedEventsCount !== a.completedEventsCount) {
          return b.completedEventsCount - a.completedEventsCount;
        }
        return b.totalPaid - a.totalPaid;
      })
      .slice(0, 5);
  }, [clientMetricsList]);

  const filteredMetrics = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = clientMetricsList.filter(
      ({ client }) =>
        !q ||
        client.name.toLowerCase().includes(q) ||
        (client.company && client.company.toLowerCase().includes(q)) ||
        (client.phone && client.phone.includes(search.trim()))
    );

    if (sortTab === 'top_paid') {
      return [...base].sort((a, b) => b.totalPaid - a.totalPaid || b.totalBilled - a.totalBilled);
    }
    if (sortTab === 'most_events') {
      return [...base].sort(
        (a, b) =>
          b.activeOrCompletedEventsCount - a.activeOrCompletedEventsCount ||
          b.totalPaid - a.totalPaid
      );
    }
    return base;
  }, [clientMetricsList, search, sortTab]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingClient) {
      store.updateClient(editingClient.id, formData);
    } else {
      store.addClient(formData);
    }
    setIsModalOpen(false);
    setEditingClient(null);
    setFormData({ name: '', email: '', phone: '', company: '', notes: '' });
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      company: client.company || '',
      notes: client.notes || ''
    });
    setIsModalOpen(true);
  };

  const totalPaymentsAllClients = clientMetricsList.reduce((s, m) => s + m.totalPaid, 0);
  const totalEventsAllClients = clientMetricsList.reduce(
    (s, m) => s + m.activeOrCompletedEventsCount,
    0
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Client Directory &amp; Top Clients</h1>
          <p className="page-subtitle">
            Manage corporate, institutional, and private catering clients with payment &amp; booking rankings.
          </p>
        </div>
        <div>
          {canEdit && (
            <button
              onClick={() => {
                setEditingClient(null);
                setFormData({ name: '', email: '', phone: '', company: '', notes: '' });
                setIsModalOpen(true);
              }}
              className="btn btn-primary"
              style={{ whiteSpace: 'nowrap' }}
            >
              + Add Client
            </button>
          )}
        </div>
      </div>

      {noticeError && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            padding: '0.7rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem',
            fontWeight: 600
          }}
        >
          <span>{noticeError}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setNoticeError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* TOP CLIENTS LEADERBOARD SECTION */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '0.75rem'
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              🏆 Top Clients Leaderboard
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0' }}>
              Automatically ranked by highest verified payments collected and total catering events conducted.
            </p>
          </div>
          <div
            style={{
              fontSize: '0.78rem',
              color: '#475569',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            <span>{state.clients.length} Total Clients</span>
            <span aria-hidden="true"> &middot; </span>
            <span>{totalEventsAllClients} Active/Completed Events</span>
            {canSeeFinancials && (
              <>
                <span aria-hidden="true"> &middot; </span>
                <strong style={{ color: '#047857' }}>
                  ₹{totalPaymentsAllClients.toLocaleString('en-IN')} Collected
                </strong>
              </>
            )}
          </div>
        </div>

        <div className="grid-2" style={{ alignItems: 'stretch' }}>
          {/* Panel 1: Highest Paying Clients */}
          <div
            className="card"
            style={{
              padding: '1.15rem 1.25rem',
              border: '1px solid #a7f3d0',
              borderTop: '3px solid #059669',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.85rem'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#065f46' }}>
                    Highest Paying Clients
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    Ranked by total invoice payments received
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSortTab(sortTab === 'top_paid' ? 'all' : 'top_paid')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem', whiteSpace: 'nowrap' }}
                >
                  {sortTab === 'top_paid' ? 'Showing All Ranked' : 'Sort Table by Paid'}
                </button>
              </div>

              {topPayingClients.length === 0 ? (
                <div
                  style={{
                    padding: '1.25rem 0.75rem',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '0.84rem'
                  }}
                >
                  No client payments recorded yet. Record invoice receipts to populate top paying clients.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {topPayingClients.map((item, idx) => (
                    <div
                      key={item.client.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: idx === 0 ? '0.65rem 0.75rem' : '0.45rem 0.6rem',
                        borderRadius: '8px',
                        background: idx === 0 ? '#f0fdf4' : '#f8fafc',
                        border: idx === 0 ? '1px solid #bbf7d0' : '1px solid #f1f5f9'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            background: idx === 0 ? '#059669' : '#e2e8f0',
                            color: idx === 0 ? '#ffffff' : '#334155',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          #{idx + 1}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: '0.86rem',
                              color: '#0f172a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {item.client.name}
                          </div>
                          <div style={{ fontSize: '0.73rem', color: '#64748b' }}>
                            <span>{item.client.company || 'Private Client'}</span>
                            <span aria-hidden="true"> &middot; </span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {item.activeOrCompletedEventsCount} Event
                              {item.activeOrCompletedEventsCount === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          textAlign: 'right',
                          flexShrink: 0,
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#047857' }}>
                          ₹{item.totalPaid.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          Billed ₹{item.totalBilled.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Panel 2: Most Events Conducted */}
          <div
            className="card"
            style={{
              padding: '1.15rem 1.25rem',
              border: '1px solid #bfdbfe',
              borderTop: '3px solid #2563eb',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.85rem'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#1e40af' }}>
                    Most Events Conducted
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    Ranked by total confirmed &amp; completed catering bookings
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSortTab(sortTab === 'most_events' ? 'all' : 'most_events')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.74rem', whiteSpace: 'nowrap' }}
                >
                  {sortTab === 'most_events' ? 'Showing All Ranked' : 'Sort Table by Events'}
                </button>
              </div>

              {mostEventsClients.length === 0 ? (
                <div
                  style={{
                    padding: '1.25rem 0.75rem',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '0.84rem'
                  }}
                >
                  No events booked yet. Create an event in Catering Bookings to track repeat clients.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {mostEventsClients.map((item, idx) => (
                    <div
                      key={item.client.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: idx === 0 ? '0.65rem 0.75rem' : '0.45rem 0.6rem',
                        borderRadius: '8px',
                        background: idx === 0 ? '#eff6ff' : '#f8fafc',
                        border: idx === 0 ? '1px solid #bfdbfe' : '1px solid #f1f5f9'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            background: idx === 0 ? '#2563eb' : '#e2e8f0',
                            color: idx === 0 ? '#ffffff' : '#334155',
                            fontWeight: 800,
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          #{idx + 1}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: '0.86rem',
                              color: '#0f172a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {item.client.name}
                          </div>
                          <div style={{ fontSize: '0.73rem', color: '#64748b' }}>
                            <span>{item.client.company || 'Private Client'}</span>
                            {item.lastEventDate && (
                              <>
                                <span aria-hidden="true"> &middot; </span>
                                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                                  Latest: {item.lastEventDate}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          textAlign: 'right',
                          flexShrink: 0,
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1d4ed8' }}>
                          {item.activeOrCompletedEventsCount} Event
                          {item.activeOrCompletedEventsCount === 1 ? '' : 's'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                          {item.completedEventsCount} Completed &middot; ₹
                          {item.totalPaid.toLocaleString('en-IN')} Paid
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH + SORT FILTER BAR */}
      <div
        className="card"
        style={{
          marginBottom: '1.25rem',
          padding: '0.9rem 1rem',
          display: 'flex',
          gap: '0.85rem',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap'
        }}
      >
        <input
          type="text"
          placeholder="Search by client name, organization, or phone..."
          className="form-control"
          style={{ flex: '1 1 260px' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div
          style={{
            display: 'inline-flex',
            gap: '0.25rem',
            padding: '0.25rem',
            background: '#f1f5f9',
            borderRadius: '8px',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            onClick={() => setSortTab('all')}
            style={{
              padding: '0.38rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: sortTab === 'all' ? '#ffffff' : 'transparent',
              color: sortTab === 'all' ? '#0f172a' : '#475569',
              boxShadow: sortTab === 'all' ? '0 1px 2px rgba(15,23,42,0.08)' : 'none'
            }}
          >
            All Clients ({state.clients.length})
          </button>
          <button
            type="button"
            onClick={() => setSortTab('top_paid')}
            style={{
              padding: '0.38rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: sortTab === 'top_paid' ? '#ffffff' : 'transparent',
              color: sortTab === 'top_paid' ? '#047857' : '#475569',
              boxShadow: sortTab === 'top_paid' ? '0 1px 2px rgba(15,23,42,0.08)' : 'none'
            }}
          >
            Highest Paying
          </button>
          <button
            type="button"
            onClick={() => setSortTab('most_events')}
            style={{
              padding: '0.38rem 0.75rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: sortTab === 'most_events' ? '#ffffff' : 'transparent',
              color: sortTab === 'most_events' ? '#1d4ed8' : '#475569',
              boxShadow: sortTab === 'most_events' ? '0 1px 2px rgba(15,23,42,0.08)' : 'none'
            }}
          >
            Most Events
          </button>
        </div>
      </div>

      {/* CLIENTS DIRECTORY TABLE */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Client Name</th>
              <th>Company / Organization</th>
              <th>Contact Details</th>
              <th style={{ textAlign: 'right' }}>Events Conducted</th>
              {canSeeFinancials && <th style={{ textAlign: 'right' }}>Total Paid</th>}
              {canSeeFinancials && <th style={{ textAlign: 'right' }}>Pending Due</th>}
              <th>Notes / Preferences</th>
              {canEdit && <th style={{ textAlign: 'center' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredMetrics.length === 0 ? (
              <tr>
                <td
                  colSpan={canEdit ? 8 : 7}
                  style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}
                >
                  No clients match your search criteria.
                </td>
              </tr>
            ) : (
              filteredMetrics.map((m) => {
                const { client } = m;
                const isConfirmingDelete = pendingDeleteId === client.id;
                return (
                  <tr key={client.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{client.name}</div>
                      <div
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-muted)',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        ID: {client.id}
                      </div>
                      {(role === 'owner' || role === 'super_admin') && (
                        <OwnerAuditBadge
                          role={role}
                          entry={store.getEntityAudit(client.id, ['client'])}
                          prefixLabel="Updated by"
                        />
                      )}
                    </td>
                    <td>{client.company || '—'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                      <div>{client.phone || 'No phone'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {client.email || 'No email'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        {m.activeOrCompletedEventsCount} Event
                        {m.activeOrCompletedEventsCount === 1 ? '' : 's'}
                      </div>
                      <div style={{ fontSize: '0.73rem', color: '#64748b' }}>
                        {m.completedEventsCount} done &middot; {m.upcomingEventsCount} upcoming
                      </div>
                    </td>
                    {canSeeFinancials && (
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <div style={{ fontWeight: 700, color: '#047857' }}>
                          ₹{m.totalPaid.toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Billed ₹{m.totalBilled.toLocaleString('en-IN')}
                        </div>
                      </td>
                    )}
                    {canSeeFinancials && (
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color: m.pendingDue > 0 ? '#b45309' : '#64748b'
                          }}
                        >
                          ₹{m.pendingDue.toLocaleString('en-IN')}
                        </span>
                      </td>
                    )}
                    <td style={{ maxWidth: '220px' }}>
                      <span style={{ fontSize: '0.84rem', color: '#475569' }}>
                        {client.notes || '—'}
                      </span>
                    </td>
                    {canEdit && (
                      <td style={{ textAlign: 'center' }}>
                        {isConfirmingDelete ? (
                          <div style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              style={{ whiteSpace: 'nowrap', fontSize: '0.74rem' }}
                              onClick={() => {
                                setNoticeError(null);
                                setPendingDeleteId(null);
                                store.deleteClient(client.id);
                              }}
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ whiteSpace: 'nowrap', fontSize: '0.74rem' }}
                              onClick={() => setPendingDeleteId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ whiteSpace: 'nowrap' }}
                              onClick={() => handleEdit(client)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => {
                                if (m.totalEventsCount > 0) {
                                  setNoticeError(
                                    `Cannot delete "${client.name}" while they have ${m.totalEventsCount} associated event(s).`
                                  );
                                  return;
                                }
                                setPendingDeleteId(client.id);
                              }}
                              title="Delete Client"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Client Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingClient ? 'Edit Client Profile' : 'New Client Profile'}
              </h2>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Client Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Dr. Zameer Khan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Organization / Company</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Aster MIMS Calicut, Cyberpark"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="+91 94470 12345"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="client@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Preferences &amp; Notes</label>
                <textarea
                  rows={3}
                  className="form-control"
                  placeholder="Dietary requirements, preferred menu items, venue notes..."
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
                <button type="submit" className="btn btn-primary">
                  {editingClient ? 'Update Client' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
