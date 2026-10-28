'use client';

import React, { useEffect, useState } from 'react';
import { store } from '@/lib/store';
import { UserRole } from '@/lib/types';

export default function UsersPage() {
  const [state, setState] = useState(store.getState());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role = state.currentRole;
  const isOwner = role === 'owner';

  const roleDescriptions: Record<UserRole, string> = {
    owner: 'Full access to all modules, financial totals, quote margins, invoices & settings.',
    manager: 'Can create and edit clients, events, quotes, shifts, menu, and stock. Invoices are read-only.',
    accountant: 'Can create invoices, record client payments, and view finance dashboard. Other areas view-only.',
    chef: 'Kitchen specialist: manages dishes, ingredients, recipes, and warehouse stock. Events and shifts are read-only.',
    staff: 'Read-only operational personnel: can view assigned banquet schedule and event timelines.'
  };

  const handleRoleChange = (profileId: string, newRole: UserRole) => {
    store.updateUserRole(profileId, newRole);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Profiles &amp; Access Roles</h1>
          <p className="page-subtitle">
            Configure system users and assign access privilege levels (Owner, Manager, Accountant, Chef, Staff).
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
          ℹ️ <strong>Owner privilege required:</strong> Only the Owner can modify system user roles. Switch to <em>Owner</em> preview above to modify role assignments.
        </div>
      )}

      {/* Role Definitions Card */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-title">Role Permission Hierarchy (Update 4)</h2>
        <div className="grid-2">
          {Object.entries(roleDescriptions).map(([rKey, desc]) => (
            <div
              key={rKey}
              style={{
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0.75rem',
                background: '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span
                  className="role-tag-badge"
                  style={{
                    background:
                      rKey === 'owner'
                        ? '#e11d48'
                        : rKey === 'manager'
                        ? '#2563eb'
                        : rKey === 'accountant'
                        ? '#059669'
                        : rKey === 'chef'
                        ? '#d97706'
                        : '#64748b',
                    color: 'white'
                  }}
                >
                  {rKey.toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#475569' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <h2 className="card-title">Configured System User Profiles</h2>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Contact</th>
                <th>Assigned Role</th>
                <th>Role Privileges</th>
                {isOwner && <th style={{ textAlign: 'center' }}>Modify Role</th>}
              </tr>
            </thead>
            <tbody>
              {state.profiles.map((profile) => (
                <tr key={profile.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{profile.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      ID: {profile.id}
                    </div>
                  </td>
                  <td>{profile.phone || '—'}</td>
                  <td>
                    <span
                      className="role-tag-badge"
                      style={{
                        background:
                          profile.role === 'owner'
                            ? '#e11d48'
                            : profile.role === 'manager'
                            ? '#2563eb'
                            : profile.role === 'accountant'
                            ? '#059669'
                            : profile.role === 'chef'
                            ? '#d97706'
                            : '#64748b',
                        color: 'white'
                      }}
                    >
                      {profile.role.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '300px' }}>
                    {roleDescriptions[profile.role]}
                  </td>
                  {isOwner && (
                    <td style={{ textAlign: 'center' }}>
                      <select
                        className="form-control"
                        style={{ width: 'auto', display: 'inline-block', fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                        value={profile.role}
                        onChange={(e) => handleRoleChange(profile.id, e.target.value as UserRole)}
                      >
                        <option value="owner">Owner</option>
                        <option value="manager">Manager</option>
                        <option value="accountant">Accountant</option>
                        <option value="chef">Chef</option>
                        <option value="staff">Staff (Read-only)</option>
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
