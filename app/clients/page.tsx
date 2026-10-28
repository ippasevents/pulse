'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { store } from '@/lib/store';
import { Client } from '@/lib/types';
import OwnerAuditBadge from '@/components/OwnerAuditBadge';

export default function ClientsPage() {
  const [state, setState] = useState(store.getState());
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
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
  const canEdit = role === 'owner' || role === 'manager';

  const filteredClients = state.clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company && c.company.toLowerCase().includes(search.toLowerCase())) ||
      (c.phone && c.phone.includes(search))
  );

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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Client Directory</h1>
          <p className="page-subtitle">
            Manage institutional, corporate, and private catering clients.
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
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNoticeError(null)}>
            ✕
          </button>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
        <input
          type="text"
          placeholder="Search by client name, company, or phone..."
          className="form-control"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Client Name</th>
              <th>Company</th>
              <th>Contact Details</th>
              <th>Notes / Preferences</th>
              <th style={{ textAlign: 'center' }}>Events</th>
              {canEdit && <th style={{ textAlign: 'center' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No clients found.
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => {
                const clientEvents = state.events.filter((e) => e.client_id === client.id);
                return (
                  <tr key={client.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{client.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ID: {client.id}
                      </div>
                      {role === 'owner' && (
                        <OwnerAuditBadge
                          role={role}
                          entry={store.getEntityAudit(client.id, ['client'])}
                          prefixLabel="Updated by"
                        />
                      )}
                    </td>
                    <td>{client.company || '—'}</td>
                    <td>
                      <div>{client.phone || 'No phone'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {client.email || 'No email'}
                      </div>
                    </td>
                    <td style={{ maxWidth: '250px' }}>
                      <span style={{ fontSize: '0.85rem' }}>{client.notes || '—'}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge" style={{ background: '#f1f5f9' }}>
                        {clientEvents.length} Event{clientEvents.length === 1 ? '' : 's'}
                      </span>
                    </td>
                    {canEdit && (
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEdit(client)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              if (clientEvents.length > 0) {
                                setNoticeError(`Cannot delete "${client.name}" while they have associated events.`);
                                return;
                              }
                              if (confirm(`Delete client "${client.name}"?`)) {
                                setNoticeError(null);
                                store.deleteClient(client.id);
                              }
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
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
                  placeholder="e.g. Aster Medcity, Cochin Shipyard"
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
                  placeholder="Dietary requirements, preferred spices, past events..."
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
