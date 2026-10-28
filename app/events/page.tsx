'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { store } from '@/lib/store';
import { EventRecord, EventStatus } from '@/lib/types';
import OwnerAuditBadge from '@/components/OwnerAuditBadge';

export default function EventsPage() {
  const [state, setState] = useState(store.getState());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Event Form State
  const [formData, setFormData] = useState({
    client_id: '',
    title: '',
    event_date: new Date().toISOString().split('T')[0],
    start_time: '18:00',
    end_time: '22:00',
    venue: '',
    guest_count: 100,
    status: 'inquiry' as EventStatus,
    notes: ''
  });

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role = state.currentRole;
  const canEdit = role === 'owner' || role === 'manager';
  const isFinance = role === 'owner' || role === 'accountant';

  const filteredEvents = state.events.filter((evt) => {
    const matchesStatus = statusFilter === 'all' || evt.status === statusFilter;
    const client = state.clients.find((c) => c.id === evt.client_id);
    const matchesSearch =
      evt.title.toLowerCase().includes(search.toLowerCase()) ||
      (evt.venue && evt.venue.toLowerCase().includes(search.toLowerCase())) ||
      (client && client.name.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id || !formData.title) {
      setFormError('Please fill in an event title and select a client.');
      return;
    }
    setFormError(null);
    store.addEvent(formData);
    setIsModalOpen(false);
    // Reset form
    setFormData({
      client_id: state.clients[0]?.id || '',
      title: '',
      event_date: new Date().toISOString().split('T')[0],
      start_time: '18:00',
      end_time: '22:00',
      venue: '',
      guest_count: 100,
      status: 'inquiry',
      notes: ''
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Catering Events &amp; Bookings</h1>
          <p className="page-subtitle">
            Manage inquiry pipeline, confirmed banquet functions, and quote packages.
          </p>
        </div>
        <div>
          {canEdit && (
            <button
              onClick={() => {
                setFormData((prev) => ({
                  ...prev,
                  client_id: state.clients[0]?.id || ''
                }));
                setIsModalOpen(true);
              }}
              className="btn btn-primary"
            >
              + Create New Event
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <input
              type="text"
              placeholder="Search by event title, venue, client name..."
              className="form-control"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status:</span>
            <select
              className="form-control"
              style={{ width: 'auto' }}
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
      </div>

      {/* Events Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Event Title</th>
              <th>Client</th>
              <th>Date &amp; Schedule</th>
              <th>Venue</th>
              <th>Guests</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Total Quote</th>
              {role === 'owner' && <th>Last Updated By (Login ID)</th>}
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={role === 'owner' ? 9 : 8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No catering events matching criteria.
                </td>
              </tr>
            ) : (
              filteredEvents.map((evt) => {
                const client = state.clients.find((c) => c.id === evt.client_id);
                const { grandTotal, menuTotal } = store.getEventTotal(evt.id);
                const displayTotal = isFinance ? grandTotal : menuTotal;
                const auditSummary = role === 'owner' ? store.getEventAuditSummary(evt.id) : null;

                return (
                  <tr key={evt.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{evt.title}</div>
                      {evt.notes && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {evt.notes}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{client ? client.name : 'Unknown Client'}</div>
                      {client?.phone && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{client.phone}</div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{evt.event_date}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {evt.start_time || '--:--'} - {evt.end_time || '--:--'}
                      </div>
                    </td>
                    <td>{evt.venue || 'TBD'}</td>
                    <td style={{ fontWeight: 600 }}>{evt.guest_count} pax</td>
                    <td>
                      <span className={`badge badge-${evt.status}`}>{evt.status}</span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      ₹{displayTotal.toLocaleString('en-IN')}
                    </td>
                    {role === 'owner' && (
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem' }}>
                          {auditSummary?.eventAudit && (
                            <OwnerAuditBadge
                              role={role}
                              entry={auditSummary.eventAudit}
                              prefixLabel="Event"
                            />
                          )}
                          {auditSummary?.quoteAudit && (
                            <OwnerAuditBadge
                              role={role}
                              entry={auditSummary.quoteAudit}
                              prefixLabel="Quote"
                            />
                          )}
                          {!auditSummary?.eventAudit && !auditSummary?.quoteAudit && (
                            auditSummary?.latestAudit ? (
                              <OwnerAuditBadge
                                role={role}
                                entry={auditSummary.latestAudit}
                                prefixLabel="Updated"
                              />
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Initial record
                              </span>
                            )
                          )}
                        </div>
                      </td>
                    )}
                    <td style={{ textAlign: 'center' }}>
                      <Link href={`/events/${evt.id}`} className="btn btn-secondary btn-sm">
                        View Details &amp; Quote &rarr;
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>New Catering Event Inquiry</h2>
              <button
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
              <div className="form-group">
                <label className="form-label">Client *</label>
                <select
                  className="form-control"
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  required
                >
                  <option value="">Select a client...</option>
                  {state.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ''}
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  Need a new client? Add them in the <Link href="/clients" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Clients</Link> tab.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Event Title *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Annual Doctor Dinner, Wedding Reception"
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
                    onChange={(e) => setFormData({ ...formData, guest_count: parseInt(e.target.value) || 1 })}
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
                <label className="form-label">Pipeline Status</label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as EventStatus })}
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
                  rows={3}
                  className="form-control"
                  placeholder="Special instructions, kitchen access, live counters..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
