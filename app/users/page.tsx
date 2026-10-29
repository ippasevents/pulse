'use client';

import React, { useEffect, useState } from 'react';
import { store } from '@/lib/store';
import { UserRole, Profile, StaffMember } from '@/lib/types';
import ChangePasswordModal from '@/components/ChangePasswordModal';

export default function UsersPage() {
  const [state, setState] = useState(store.getState());
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [savedNotice, setSavedNotice] = useState('');
  const [errorNotice, setErrorNotice] = useState('');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Add New User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    full_name: '',
    role: 'manager' as UserRole,
    username: '',
    password: '',
    phone: '',
    role_title: 'Buffet Server',
    hourly_rate: 200
  });
  const [addError, setAddError] = useState('');

  // Edit Management User Modal State
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    username: '',
    password: '',
    phone: '',
    role: 'manager' as UserRole
  });
  const [editError, setEditError] = useState('');

  // Edit Staff Login Modal State
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffEditForm, setStaffEditForm] = useState({
    name: '',
    phone: '',
    password: '',
    role_title: ''
  });

  // Delete Confirmation State
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteStaffId, setConfirmDeleteStaffId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role = state.currentRole;
  const isSuperAdmin = role === 'super_admin';
  const isOwner = role === 'owner';
  const canManageUsers = isSuperAdmin || isOwner;

  // Stealth: Super Admin is completely invisible to Owner, Manager, Accountant, and Staff
  const visibleProfiles = isSuperAdmin
    ? state.profiles
    : state.profiles.filter((p) => p.role !== 'super_admin');

  const notifySuccess = (msg: string) => {
    setErrorNotice('');
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(''), 3500);
  };

  const roleDescriptions: Record<UserRole, { title: string; desc: string; color: string }> = {
    super_admin: {
      title: 'Super Admin',
      desc: 'Master system controller with full administrative authority across all modules, all user credentials, and stealth invisibility from other accounts.',
      color: '#4f46e5'
    },
    owner: {
      title: 'Owner',
      desc: 'Full administrative access across all modules: executive dashboard, sales revenue, quotes, operations, invoices, bank details, and user accounts.',
      color: '#e11d48'
    },
    manager: {
      title: 'Manager',
      desc: 'Dedicated operational dashboard focusing on upcoming events & bookings, menu dishes & recipe formulations, warehouse pantry stock, and staff shifts.',
      color: '#2563eb'
    },
    accountant: {
      title: 'Accountant',
      desc: 'Dedicated financial dashboard displaying total sales, monthly sales revenue chart, quotations, invoicing, client payment collections, and upcoming works billing.',
      color: '#059669'
    },
    staff: {
      title: 'Staff Member',
      desc: 'Restricted crew login using mobile phone number as username, showing only upcoming assigned catering function and venue location.',
      color: '#7c3aed'
    }
  };

  const handleOpenAddModal = () => {
    setAddError('');
    setAddForm({
      full_name: '',
      role: 'manager',
      username: '',
      password: '',
      phone: '',
      role_title: 'Buffet Server',
      hourly_rate: 200
    });
    setIsAddModalOpen(true);
  };

  const handleAddUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!addForm.full_name.trim()) {
      setAddError('Full name is required.');
      return;
    }

    if (addForm.role === 'staff') {
      if (!addForm.phone.trim()) {
        setAddError('Phone number is required for Staff login.');
        return;
      }
      store.addStaff({
        name: addForm.full_name.trim(),
        phone: addForm.phone.trim(),
        password: addForm.password.trim() || 'password123',
        role_title: addForm.role_title.trim() || 'Service Crew',
        hourly_rate: Number(addForm.hourly_rate) || 200,
        active: true
      });
      setIsAddModalOpen(false);
      notifySuccess(`Added staff login for ${addForm.full_name.trim()} (Username: ${addForm.phone.trim()})`);
      return;
    }

    if (!addForm.username.trim() || !addForm.password.trim()) {
      setAddError('Username and password are required.');
      return;
    }

    const res = store.addProfile({
      full_name: addForm.full_name,
      username: addForm.username,
      password: addForm.password,
      phone: addForm.phone,
      role: addForm.role
    });

    if (!res.success) {
      setAddError(res.error || 'Could not create user.');
      return;
    }

    setIsAddModalOpen(false);
    notifySuccess(`Created ${addForm.role.toUpperCase()} account for ${addForm.full_name.trim()}!`);
  };

  const handleOpenEdit = (profile: Profile) => {
    setEditError('');
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
    if (!editForm.username.trim() || !editForm.password.trim()) {
      setEditError('Username and password are required.');
      return;
    }

    const res = store.updateProfile(editingUser.id, editForm);
    if (!res.success) {
      setEditError(res.error || 'Could not update profile.');
      return;
    }

    setEditingUser(null);
    notifySuccess(`Updated credentials for ${editForm.full_name}!`);
  };

  const handleDeleteUser = (profile: Profile) => {
    const res = store.deleteProfile(profile.id);
    setConfirmDeleteId(null);
    if (!res.success) {
      setErrorNotice(res.error || 'Cannot delete this account.');
      setTimeout(() => setErrorNotice(''), 4000);
      return;
    }
    notifySuccess(`Removed user account "${profile.full_name}".`);
  };

  const handleOpenStaffEdit = (staff: StaffMember) => {
    setEditingStaff(staff);
    setStaffEditForm({
      name: staff.name,
      phone: staff.phone || '',
      password: staff.password || 'password123',
      role_title: staff.role_title || 'Service Crew'
    });
  };

  const handleSaveStaffEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !staffEditForm.phone.trim()) return;
    store.updateStaff(editingStaff.id, {
      name: staffEditForm.name.trim(),
      phone: staffEditForm.phone.trim(),
      password: staffEditForm.password.trim() || 'password123',
      role_title: staffEditForm.role_title.trim()
    });
    setEditingStaff(null);
    notifySuccess(`Updated staff login credentials for ${staffEditForm.name.trim()}!`);
  };

  const handleDeleteStaffLogin = (staff: StaffMember) => {
    store.deleteStaff(staff.id);
    setConfirmDeleteStaffId(null);
    if (editingStaff?.id === staff.id) {
      setEditingStaff(null);
    }
    notifySuccess(`Removed staff member "${staff.name}" and revoked their mobile login.`);
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
            Create and manage system logins, access permissions, and passwords for Owner, Manager, Accountant, and Staff.
          </p>
        </div>
        {canManageUsers && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="btn btn-secondary"
            >
              🔑 Change My Password
            </button>
            <button type="button" onClick={handleOpenAddModal} className="btn btn-primary">
              + Add New User
            </button>
          </div>
        )}
      </div>

      {isSuperAdmin && (
        <div
          style={{
            background: '#eef2ff',
            border: '1px solid #c7d2fe',
            color: '#3730a3',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <span>👑</span>
          <div>
            <strong>Super Admin Mode:</strong> You have unrestricted master authority across all modules and can edit or manage credentials for all users (including Owner, Manager, Accountant, and Staff). Your Super Admin account and activities are completely invisible to other users.
          </div>
        </div>
      )}

      {!canManageUsers && (
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
          ℹ️ <strong>Access Restricted:</strong> You are currently logged in as <em>{role}</em>. Only Owner or Super Admin can create or modify system user accounts and passwords.
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

      {errorNotice && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '0.65rem 0.85rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem'
          }}
        >
          ⚠️ {errorNotice}
        </div>
      )}

      {/* Role Definitions Cards */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-title">System Role Hierarchy &amp; Access Rights</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {(isSuperAdmin
            ? (['super_admin', 'owner', 'manager', 'accountant', 'staff'] as UserRole[])
            : (['owner', 'manager', 'accountant', 'staff'] as UserRole[])
          ).map((rKey) => {
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
                    {rKey.toUpperCase().replace('_', ' ')}
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
              Authorized User Credentials ({visibleProfiles.length})
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Username and password login credentials for system accounts
            </p>
          </div>
          {canManageUsers && (
            <button type="button" onClick={handleOpenAddModal} className="btn btn-secondary btn-sm">
              + Add User Account
            </button>
          )}
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
              {visibleProfiles.map((profile) => {
                const isShowingPass = showPasswords[profile.id];
                const isActiveUser = state.currentUserId === profile.id;
                const ownerCount = state.profiles.filter((p) => p.role === 'owner').length;
                const canDelete = canManageUsers && !isActiveUser && !(profile.role === 'owner' && ownerCount <= 1);

                return (
                  <tr key={profile.id} style={{ background: isActiveUser ? '#f8fafc' : 'transparent' }}>
                    <td>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {profile.full_name}
                        {isActiveUser && (
                          <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontSize: '0.65rem' }}>
                            ✓ Signed In
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
                            profile.role === 'super_admin'
                              ? '#4f46e5'
                              : profile.role === 'owner'
                              ? '#e11d48'
                              : profile.role === 'manager'
                              ? '#2563eb'
                              : '#059669',
                          color: 'white'
                        }}
                      >
                        {profile.role.toUpperCase().replace('_', ' ')}
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
                      {canManageUsers ? (
                        confirmDeleteId === profile.id ? (
                          <div style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteUser(profile)}
                            >
                              Confirm Delete
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleOpenEdit(profile)}
                            >
                              Edit Credentials
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => setConfirmDeleteId(profile.id)}
                                title="Delete user account"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        )
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Protected</span>
                      )}
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
              Staff members log in using their registered mobile phone number as username to check their next assigned event and venue.
            </p>
          </div>
          {canManageUsers && (
            <button
              type="button"
              onClick={() => {
                setAddError('');
                setAddForm({
                  full_name: '',
                  role: 'staff',
                  username: '',
                  password: 'password123',
                  phone: '',
                  role_title: 'Buffet Server',
                  hourly_rate: 200
                });
                setIsAddModalOpen(true);
              }}
              className="btn btn-secondary btn-sm"
            >
              + Add Staff Login
            </button>
          )}
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
                {canManageUsers && <th style={{ textAlign: 'center' }}>Action</th>}
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
                    <span className="badge" style={{ background: staff.active ? '#dcfce7' : '#f1f5f9', color: staff.active ? '#15803d' : '#64748b' }}>
                      {staff.active ? 'Active Crew' : 'Inactive'}
                    </span>
                  </td>
                  {canManageUsers && (
                    <td style={{ textAlign: 'center' }}>
                      {confirmDeleteStaffId === staff.id ? (
                        <div style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteStaffLogin(staff)}
                          >
                            Confirm Remove
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setConfirmDeleteStaffId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenStaffEdit(staff)}
                          >
                            Edit Login
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setConfirmDeleteStaffId(staff.id)}
                            title="Remove staff member permanently"
                          >
                            🗑 Remove
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {state.staff.length === 0 && (
                <tr>
                  <td colSpan={canManageUsers ? 6 : 5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                    No staff members registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New User Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                  Add New User Account
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Create login credentials and assign role permissions
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsAddModalOpen(false)}>
                ✕
              </button>
            </div>

            {addError && (
              <div
                style={{
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  marginBottom: '1rem'
                }}
              >
                {addError}
              </div>
            )}

            <form onSubmit={handleAddUserSubmit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Access Role *</label>
                <select
                  className="form-control"
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value as UserRole })}
                >
                  {isSuperAdmin && (
                    <option value="super_admin">Super Admin (Master System Control &amp; Stealth)</option>
                  )}
                  <option value="manager">Manager (Events, Menus, Stock &amp; Staff)</option>
                  <option value="accountant">Accountant (Sales, Quotations, Invoices &amp; Payments)</option>
                  <option value="owner">Owner (Full Administrative Access)</option>
                  <option value="staff">Staff Member (Phone Login - Next Function Only)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Nithin Nair"
                  value={addForm.full_name}
                  onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                  required
                />
              </div>

              {addForm.role === 'staff' ? (
                <>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Staff Phone Number (Used as Login Username) *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 9745111009"
                      value={addForm.phone}
                      onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid-2">
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">Duty Designation</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Buffet Server"
                        value={addForm.role_title}
                        onChange={(e) => setAddForm({ ...addForm, role_title: e.target.value })}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">Hourly Rate (₹)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={addForm.hourly_rate}
                        onChange={(e) => setAddForm({ ...addForm, hourly_rate: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Login Password *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Default: password123"
                      value={addForm.password}
                      onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid-2">
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">Login Username *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. manager2"
                        value={addForm.username}
                        onChange={(e) => setAddForm({ ...addForm, username: e.target.value.toLowerCase().trim() })}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">Login Password *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter password"
                        value={addForm.password}
                        onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Contact Phone</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="+91 98470 00000"
                      value={addForm.phone}
                      onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    />
                  </div>
                </>
              )}

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 600 }}>
                  Create User Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  Update role, username, password, or contact phone
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingUser(null)}>
                ✕
              </button>
            </div>

            {editError && (
              <div
                style={{
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  marginBottom: '1rem'
                }}
              >
                {editError}
              </div>
            )}

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
                <label className="form-label">Role *</label>
                <select
                  className="form-control"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                  disabled={!isSuperAdmin && editingUser.role === 'owner' && state.profiles.filter((p) => p.role === 'owner').length <= 1}
                >
                  {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                  <option value="owner">Owner</option>
                  <option value="manager">Manager</option>
                  <option value="accountant">Accountant</option>
                </select>
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

      {/* Edit Staff Login Modal */}
      {editingStaff && (
        <div className="modal-overlay" onClick={() => setEditingStaff(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
                  Edit Staff Login: {editingStaff.name}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Staff members sign in using their phone number as username
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingStaff(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStaffEdit}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Staff Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={staffEditForm.name}
                  onChange={(e) => setStaffEditForm({ ...staffEditForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Phone Number (Login Username) *</label>
                <input
                  type="text"
                  className="form-control"
                  value={staffEditForm.phone}
                  onChange={(e) => setStaffEditForm({ ...staffEditForm, phone: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Login Password *</label>
                <input
                  type="text"
                  className="form-control"
                  value={staffEditForm.password}
                  onChange={(e) => setStaffEditForm({ ...staffEditForm, password: e.target.value })}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Designation</label>
                <input
                  type="text"
                  className="form-control"
                  value={staffEditForm.role_title}
                  onChange={(e) => setStaffEditForm({ ...staffEditForm, role_title: e.target.value })}
                />
              </div>

              <div
                className="modal-actions"
                style={{
                  display: 'flex',
                  justifyContent: isOwner ? 'space-between' : 'flex-end',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '1.25rem',
                  flexWrap: 'wrap'
                }}
              >
                {canManageUsers && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteStaffLogin(editingStaff)}
                  >
                    🗑 Remove Staff
                  </button>
                )}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingStaff(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ fontWeight: 600 }}>
                    Save Staff Login
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
}
