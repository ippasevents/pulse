'use client';

import React, { useEffect, useState } from 'react';
import { store } from '@/lib/store';
import { UserRole, Profile } from '@/lib/types';

export default function UsersPage() {
  const [state, setState] = useState(store.getState());
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [editForm, setEditForm] = useState({
    full_name: '',
    username: '',
    password: '',
    phone: '',
    role: 'manager' as UserRole
  });
  const [savedNotice, setSavedNotice] = useState('');

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role = state.currentRole;
  const isOwner = role === 'owner';

  const roleDescriptions: Record<UserRole, { title: string; desc: string; color: string }> = {
    owner: {
      title: 'Owner',
      desc: 'Full administrative access across all modules: executive dashboard, sales revenue, quotes, operations, invoices, bank details, and user passwords.',
      color: '#e11d48'
    },
    manager: {
      title: 'Manager',
      desc: 'Dedicated operational dashboard focusing on upcoming events & bookings, menu dishes & recipe formulations, warehouse pantry stock adjustments, and staff shifts.',
      color: '#2563eb'
    },
    accountant: {
      title: 'Accountant',
      desc: 'Dedicated financial dashboard displaying total sales, monthly sales revenue chart, invoicing, client payments collection, and upcoming works billing details.',
      color: '#059669'
    },
    staff: {
      title: 'Staff Member',
      desc: 'Dedicated restricted view showing only upcoming assigned catering functions, venue location, reporting time, and duty role using phone number login.',
      color: '#7c3aed'
    }
  };

  const handleOpenEdit = (profile: Profile) => {
    setEditingUser(profile);
    setEditForm({
      full_name: profile.full_name,
      username: profile.username || '',
      password: profile.password || '',
      phone: profile.phone || '',
      role: profile.role
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editForm.username || !editForm.password) {
      alert('Username and password are required.');
      return;
    }

    store.updateProfile(editingUser.id, editForm);
    setSavedNotice(`Updated profile for ${editForm.full_name}!`);
    setEditingUser(null);
    setTimeout(() => setSavedNotice(''), 3000);
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Accounts &amp; Access Roles</h1>
          <p className="page-subtitle">
            Manage system logins, access permissions, and passwords for Owner, Manager, Accountant, and Staff.
          </p>
        </div>
      </div>

      {!isOwner && (
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1e40af',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem'
          }}
        >
          ℹ️ <strong>Owner privilege:</strong> You are currently logged in as <em>{role}</em>. Only the Owner can modify system usernames and passwords.
        </div>
      )}

      {savedNotice && (
        <div
          style={{
            background: '#dcfce7',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            padding: '0.65rem 0.85rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem'
          }}
        >
          ✓ {savedNotice}
        </div>
      )}

      {/* Role Definitions Cards */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-title">System Role Hierarchy &amp; Access Rights</h2>
        <div className="grid-3">
          {(['owner', 'manager', 'accountant'] as UserRole[]).map((rKey) => {
            const rInfo = roleDescriptions[rKey];
            return (
              <div
                key={rKey}
                style={{
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${rInfo.color}`,
                  borderRadius: '8px',
                  padding: '0.85rem',
                  background: '#f8fafc'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span
                    className="role-tag-badge"
                    style={{ background: rInfo.color, color: 'white' }}
                  >
                    {rKey.toUpperCase()}
                  </span>
                </div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0.25rem 0' }}>{rInfo.title}</h3>
                <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.45 }}>{rInfo.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Management User Credentials Table */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>
              Authorized User Credentials
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Username and password login credentials for Owner, Manager, and Accountant
            </p>
          </div>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Profile &amp; Name</th>
                <th>Role</th>
                <th>Username</th>
                <th>Password</th>
                <th>Phone</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {state.profiles.map((profile) => {
                const isShowingPass = showPasswords[profile.id];
                const isActiveUser = state.currentUserId === profile.id || state.currentRole === profile.role;

                return (
                  <tr key={profile.id} style={{ background: isActiveUser ? '#f8fafc' : 'transparent' }}>
                    <td>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {profile.full_name}
                        {isActiveUser && (
                          <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.65rem' }}>
                            ✓ Active
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ID: {profile.id}
                      </div>
                    </td>
                    <td>
                      <span
                        className="role-tag-badge"
                        style={{
                          background:
                            profile.role === 'owner'
                              ? '#e11d48'
                              : profile.role === 'manager'
                              ? '#2563eb'
                              : '#059669',
                          color: 'white'
                        }}
                      >
                        {profile.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <code
                        style={{
                          background: '#f1f5f9',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontWeight: 700,
                          color: '#0f172a'
                        }}
                      >
                        {profile.username || '—'}
                      </code>
                    </td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                        <code
                          style={{
                            background: '#f1f5f9',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontWeight: 600,
                            letterSpacing: isShowingPass ? 'normal' : '2px'
                          }}
                        >
                          {isShowingPass ? profile.password : '••••••••'}
                        </code>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
                          onClick={() => togglePasswordVisibility(profile.id)}
                          title={isShowingPass ? 'Hide password' : 'Show password'}
                        >
                          {isShowingPass ? '🙈' : '👁️'}
                        </button>
                      </div>
                    </td>
                    <td>{profile.phone || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {isOwner ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleOpenEdit(profile)}
                          >
                            Edit Credentials
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Protected</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Phone Logins Information */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>
              Staff Phone Logins (Crew Mobile Access)
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Staff members log in using their registered mobile phone number to check their next assigned event and venue.
            </p>
          </div>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Role / Designation</th>
                <th>Login Username (Phone Number)</th>
                <th>Password</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {state.staff.map((staff) => (
                <tr key={staff.id}>
                  <td style={{ fontWeight: 600 }}>{staff.name}</td>
                  <td>{staff.role_title || 'Service Crew'}</td>
                  <td>
                    <code style={{ background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: 700, color: '#0f172a' }}>
                      {staff.phone}
                    </code>
                  </td>
                  <td>
                    <code style={{ background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {staff.password || 'password123'}
                    </code>
                  </td>
                  <td>
                    <span className="badge" style={{ background: '#dcfce7', color: '#15803d' }}>
                      Active Crew
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Credentials Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  Edit Credentials for {editingUser.full_name}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Update username, password, or contact phone
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingUser(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Username *</label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value.toLowerCase().trim() })}
                  required
                  placeholder="e.g. owner, manager, accountant"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Password *</label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  required
                  placeholder="Enter new password"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Contact Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+91 98470 12345"
                />
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 600 }}>
                  Save Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
