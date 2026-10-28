'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { store } from '@/lib/store';
import { StaffMember } from '@/lib/types';

export default function StaffPage() {
  const [state, setState] = useState(store.getState());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    role_title: 'Buffet Server',
    hourly_rate: 200,
    active: true
  });

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role = state.currentRole;
  const canEditStaff = role === 'owner' || role === 'manager';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingStaff) {
      store.updateStaff(editingStaff.id, formData);
    } else {
      store.addStaff(formData);
    }
    setIsModalOpen(false);
    setEditingStaff(null);
    setFormData({ name: '', phone: '', role_title: 'Buffet Server', hourly_rate: 200, active: true });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Event Staff &amp; Crew Roster</h1>
          <p className="page-subtitle">
            Manage banquet service personnel, utility crew, kitchen assistance, and wage rates.
          </p>
        </div>
        <div>
          {canEditStaff && (
            <button
              onClick={() => {
                setEditingStaff(null);
                setFormData({ name: '', phone: '', role_title: 'Buffet Server', hourly_rate: 200, active: true });
                setIsModalOpen(true);
              }}
              className="btn btn-primary"
            >
              + Register Staff Member
            </button>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Staff Members List */}
        <div className="card">
          <h2 className="card-title">Staff Crew Members</h2>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name &amp; Contact</th>
                  <th>Role Title</th>
                  <th style={{ textAlign: 'right' }}>Hourly Rate</th>
                  <th>Status</th>
                  {canEditStaff && <th style={{ textAlign: 'center' }}>Edit</th>}
                </tr>
              </thead>
              <tbody>
                {state.staff.map((staff) => (
                  <tr key={staff.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{staff.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {staff.phone || 'No phone'}
                      </div>
                    </td>
                    <td>{staff.role_title}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      ₹{staff.hourly_rate}/hr
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: staff.active ? '#dcfce7' : '#f1f5f9',
                          color: staff.active ? '#15803d' : '#64748b'
                        }}
                      >
                        {staff.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canEditStaff && (
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setEditingStaff(staff);
                            setFormData({
                              name: staff.name,
                              phone: staff.phone || '',
                              role_title: staff.role_title || '',
                              hourly_rate: staff.hourly_rate,
                              active: staff.active
                            });
                            setIsModalOpen(true);
                          }}
                        >
                          Edit
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upcoming Shifts Schedule */}
        <div className="card">
          <h2 className="card-title">Upcoming Event Shifts</h2>
          {state.shifts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              No upcoming shifts scheduled. Assign shifts from inside any event page.
            </p>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Staff Assigned</th>
                    <th>Role</th>
                    <th>Shift Timing</th>
                  </tr>
                </thead>
                <tbody>
                  {state.shifts.map((sh) => {
                    const evt = state.events.find((e) => e.id === sh.event_id);
                    const st = state.staff.find((s) => s.id === sh.staff_member_id);
                    return (
                      <tr key={sh.id}>
                        <td>
                          <Link
                            href={`/events/${evt?.id}`}
                            style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'underline' }}
                          >
                            {evt?.title || 'Unknown Event'}
                          </Link>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {evt?.event_date}
                          </div>
                        </td>
                        <td>{st?.name || 'Unassigned'}</td>
                        <td>
                          <span className="badge" style={{ background: '#f1f5f9' }}>
                            {sh.role_label || st?.role_title}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8rem' }}>
                          {sh.starts_at.slice(11, 16)} - {sh.ends_at.slice(11, 16)}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editingStaff ? 'Edit Staff Member' : 'Register Crew Member'}
              </h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Shyam Kumar"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Phone Contact</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="+91 97451 00000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Primary Role</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Senior Captain, Buffet Server, Sous Chef"
                    value={formData.role_title}
                    onChange={(e) => setFormData({ ...formData, role_title: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Hourly Wage Rate (INR ₹) *</label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="staffActive"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                />
                <label htmlFor="staffActive" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                  Available for scheduling
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingStaff ? 'Save Changes' : 'Register Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
