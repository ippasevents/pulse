'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { store } from '@/lib/store';
import { formatAuditTimestamp, getActorRoleStyle } from '@/components/OwnerAuditBadge';
import { getAuditTargetLink } from '@/components/OwnerActivityAlertModal';

export default function OwnerActivityAuditPage() {
  const router = useRouter();
  const [state, setState] = useState(store.getState());
  const [actorFilter, setActorFilter] = useState<string>('all_non_owner');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    setState(store.getState());
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (state.currentRole !== 'owner') {
      router.replace('/dashboard');
    }
  }, [state.currentRole, router]);

  // Strict Owner-Only Visibility
  if (state.currentRole !== 'owner') {
    return null;
  }

  const allLogs = state.auditLogs || [];
  const unreadAlerts = store.getUnreadOwnerAlerts();
  const managerCount = allLogs.filter((l) => l.actor_role === 'manager').length;
  const accountantCount = allLogs.filter((l) => l.actor_role === 'accountant').length;
  const dbDirectCount = allLogs.filter((l) => l.source === 'database' || l.actor_role === 'database').length;

  const filteredLogs = allLogs.filter((log) => {
    if (actorFilter === 'all_non_owner' && log.actor_role === 'owner') return false;
    if (actorFilter === 'unread' && (log.is_read_by_owner || log.actor_role === 'owner')) return false;
    if (actorFilter === 'manager' && log.actor_role !== 'manager') return false;
    if (actorFilter === 'accountant' && log.actor_role !== 'accountant') return false;
    if (actorFilter === 'staff' && log.actor_role !== 'staff') return false;
    if (actorFilter === 'database' && log.source !== 'database' && log.actor_role !== 'database') return false;
    if (actorFilter === 'owner' && log.actor_role !== 'owner') return false;

    if (moduleFilter !== 'all') {
      if (moduleFilter === 'events_quotes' && log.entity_type !== 'event' && log.entity_type !== 'quotation') {
        return false;
      }
      if (moduleFilter === 'quotation' && log.entity_type !== 'quotation') return false;
      if (moduleFilter === 'event' && log.entity_type !== 'event') return false;
      if (moduleFilter === 'finance' && log.entity_type !== 'invoice' && log.entity_type !== 'payment') {
        return false;
      }
      if (moduleFilter === 'menu' && log.entity_type !== 'menu' && log.entity_type !== 'recipe') {
        return false;
      }
      if (moduleFilter === 'stock' && log.entity_type !== 'stock' && log.entity_type !== 'purchase') {
        return false;
      }
      if (
        moduleFilter === 'staff' &&
        log.entity_type !== 'staff' &&
        log.entity_type !== 'shift' &&
        log.entity_type !== 'salary'
      ) {
        return false;
      }
      if (moduleFilter === 'clients' && log.entity_type !== 'client') return false;
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = `${log.actor_username} ${log.actor_name} ${log.summary} ${log.details || ''} ${log.entity_type}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span
              className="role-tag-badge"
              style={{ background: '#e11d48', color: '#ffffff', fontSize: '0.72rem' }}
            >
              OWNER EXCLUSIVE MODULE
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Hidden from Manager, Accountant &amp; Staff logins
            </span>
          </div>
          <h1 className="page-title">User Activity &amp; Database Audit Log</h1>
          <p className="page-subtitle">
            Track every event edit, quotation update, billing action, and direct Supabase database modification with exact Login IDs.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {unreadAlerts.length > 0 && (
            <button
              type="button"
              onClick={() => store.markAllAuditLogsRead()}
              className="btn btn-primary"
            >
              ✓ Mark All {unreadAlerts.length} Alerts Seen
            </button>
          )}
          <button
            type="button"
            onClick={() => store.syncFromSupabase(false)}
            className="btn btn-secondary"
          >
            🔄 Refresh Live Logs
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}
      >
        <div className="stats-card" style={{ borderLeft: '4px solid #e11d48' }}>
          <span className="stats-label">Unread Non-Owner Alerts</span>
          <span
            className="stats-value"
            style={{ color: unreadAlerts.length > 0 ? '#e11d48' : 'var(--success)' }}
          >
            {unreadAlerts.length}
          </span>
          <span className="stats-sub">Pending Owner review</span>
        </div>

        <div className="stats-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <span className="stats-label">Manager Updates</span>
          <span className="stats-value" style={{ color: '#2563eb' }}>
            {managerCount}
          </span>
          <span className="stats-sub">Events, quotations, menu &amp; stock</span>
        </div>

        <div className="stats-card" style={{ borderLeft: '4px solid #059669' }}>
          <span className="stats-label">Accountant Updates</span>
          <span className="stats-value" style={{ color: '#059669' }}>
            {accountantCount}
          </span>
          <span className="stats-sub">Invoices, discounts &amp; payments</span>
        </div>

        <div className="stats-card" style={{ borderLeft: '4px solid #ea580c' }}>
          <span className="stats-label">Direct Database Edits</span>
          <span className="stats-value" style={{ color: '#ea580c' }}>
            {dbDirectCount}
          </span>
          <span className="stats-sub">Supabase SQL / Table Editor changes</span>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '230px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search by login ID (@manager), event name, dish, invoice #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>User / Source:</span>
            <select
              className="form-control"
              style={{ width: 'auto' }}
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
            >
              <option value="all_non_owner">All Non-Owner &amp; DB Changes</option>
              <option value="unread">Unread Alerts Only ({unreadAlerts.length})</option>
              <option value="all">All Users (Including Owner)</option>
              <option value="manager">Manager Logins Only</option>
              <option value="accountant">Accountant Logins Only</option>
              <option value="staff">Staff Logins Only</option>
              <option value="database">Direct Database Changes Only</option>
              <option value="owner">Owner Logins Only</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>Module:</span>
            <select
              className="form-control"
              style={{ width: 'auto' }}
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
            >
              <option value="all">All Modules</option>
              <option value="events_quotes">Events &amp; Quotations</option>
              <option value="event">Events Only</option>
              <option value="quotation">Quotations Only</option>
              <option value="finance">Invoices &amp; Payments</option>
              <option value="menu">Menu &amp; Recipes</option>
              <option value="stock">Stock &amp; Purchases</option>
              <option value="staff">Staff, Shifts &amp; Salary</option>
              <option value="clients">Clients</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Trail Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            Chronological Audit Trail ({filteredLogs.length})
          </h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Run <code>migration_07.sql</code> in Supabase SQL Editor to also capture offline SQL/Table Editor edits.
          </span>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>Login ID &amp; Role</th>
                <th>Module</th>
                <th>Action &amp; Change Summary</th>
                <th>Source</th>
                <th style={{ textAlign: 'center' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No matching activity records found for the selected filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const meta = getActorRoleStyle(log.actor_role);
                  const target = getAuditTargetLink(log);
                  const isUnread = !log.is_read_by_owner && log.actor_role !== 'owner';

                  return (
                    <tr
                      key={log.id}
                      style={{
                        background: isUnread ? '#fff1f2' : 'transparent'
                      }}
                    >
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', fontWeight: 600 }}>
                        <div>{formatAuditTimestamp(log.created_at)}</div>
                        {isUnread && (
                          <span
                            className="badge"
                            style={{ background: '#e11d48', color: '#fff', fontSize: '0.64rem', marginTop: '0.2rem' }}
                          >
                            NEW ALERT
                          </span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              background: meta.badgeBg,
                              color: meta.badgeText,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.65rem',
                              fontWeight: 800
                            }}
                          >
                            {meta.label}
                          </span>
                          <strong style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {log.source === 'database' ? 'supabase_db' : `@${log.actor_username}`}
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                          {log.actor_name}
                        </div>
                      </td>

                      <td>
                        <span
                          className="badge"
                          style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            fontSize: '0.68rem'
                          }}
                        >
                          {log.entity_type}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{log.summary}</div>
                        {log.details && (
                          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                            {log.details}
                          </div>
                        )}
                      </td>

                      <td>
                        <span
                          className="badge"
                          style={{
                            background: log.source === 'database' ? '#ffedd5' : '#ecfdf5',
                            color: log.source === 'database' ? '#9a3412' : '#065f46',
                            fontWeight: 700,
                            fontSize: '0.7rem'
                          }}
                        >
                          {log.source === 'database' ? '🗄️ Direct DB' : '💻 App Login'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                          <Link
                            href={target.href}
                            onClick={() => {
                              if (isUnread) store.markAuditLogRead(log.id);
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            {target.label} &rarr;
                          </Link>
                          {isUnread && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => store.markAuditLogRead(log.id)}
                              title="Mark alert as seen"
                            >
                              ✓
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
