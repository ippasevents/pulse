'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { store } from '@/lib/store';
import { parseAuditDetails } from '@/lib/auditDiff';
import { formatAuditTimestamp, getActorRoleStyle } from '@/components/OwnerAuditBadge';
import { getAuditTargetLink } from '@/components/OwnerActivityAlertModal';

export default function OwnerActivityAuditPage() {
  const router = useRouter();
  const [state, setState] = useState(store.getState());
  const [actorFilter, setActorFilter] = useState<string>('edits_only');
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
    if (state.currentRole !== 'owner' && state.currentRole !== 'super_admin') {
      router.replace('/dashboard');
    }
  }, [state.currentRole, router]);

  // Strict Owner & Super Admin Visibility
  if (state.currentRole !== 'owner' && state.currentRole !== 'super_admin') {
    return null;
  }

  const isSuperAdmin = state.currentRole === 'super_admin';
  const rawLogs = state.auditLogs || [];
  // Super Admin activities are completely invisible to Owner
  const allLogs = isSuperAdmin ? rawLogs : rawLogs.filter((l) => l.actor_role !== 'super_admin');
  const unreadNotifications = store.getUnreadOwnerAlerts();
  const editsCount = allLogs.filter((l) => {
    if (!isSuperAdmin && l.actor_role === 'owner') return false;
    const parsed = parseAuditDetails(l.details);
    return l.action === 'update' || parsed.changes.length > 0;
  }).length;
  const managerCount = allLogs.filter((l) => l.actor_role === 'manager').length;
  const accountantCount = allLogs.filter((l) => l.actor_role === 'accountant').length;
  const superAdminCount = rawLogs.filter((l) => l.actor_role === 'super_admin').length;

  const filteredLogs = allLogs.filter((log) => {
    const parsed = parseAuditDetails(log.details);

    if (actorFilter === 'edits_only') {
      if (!isSuperAdmin && log.actor_role === 'owner') return false;
      if (log.action !== 'update' && parsed.changes.length === 0) return false;
    }
    if (actorFilter === 'all_non_owner' && (log.actor_role === 'owner' || log.actor_role === 'super_admin')) return false;
    if (actorFilter === 'unread' && (log.is_read_by_owner || log.actor_role === 'owner' || log.actor_role === 'super_admin')) return false;
    if (actorFilter === 'manager' && log.actor_role !== 'manager') return false;
    if (actorFilter === 'accountant' && log.actor_role !== 'accountant') return false;
    if (actorFilter === 'staff' && log.actor_role !== 'staff') return false;
    if (actorFilter === 'database' && log.source !== 'database' && log.actor_role !== 'database') return false;
    if (actorFilter === 'owner' && log.actor_role !== 'owner') return false;
    if (actorFilter === 'super_admin' && log.actor_role !== 'super_admin') return false;

    if (moduleFilter !== 'all') {
      if (
        moduleFilter === 'events_quotes' &&
        log.entity_type !== 'event' &&
        log.entity_type !== 'quotation' &&
        log.entity_type !== 'event_expense'
      ) {
        return false;
      }
      if (moduleFilter === 'expenses' && log.entity_type !== 'event_expense') return false;
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
      const diffText = parsed.changes.map((c) => `${c.field} ${c.before} ${c.after}`).join(' ');
      const hay = `${log.actor_username} ${log.actor_name} ${log.summary} ${parsed.cleanNote} ${diffText} ${log.entity_type}`.toLowerCase();
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
              style={{ background: isSuperAdmin ? '#4f46e5' : '#1e293b', color: '#ffffff', fontSize: '0.72rem' }}
            >
              {isSuperAdmin ? 'SUPER ADMIN MASTER LOG' : 'OWNER NOTIFICATIONS'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Check staff, manager &amp; accountant edits whenever convenient
            </span>
          </div>
          <h1 className="page-title">Notifications &amp; Edit History</h1>
          <p className="page-subtitle">
            Review what data was edited with clear Previous Data &rarr; New Data comparisons.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {unreadNotifications.length > 0 && (
            <button
              type="button"
              onClick={() => store.markAllAuditLogsRead()}
              className="btn btn-primary"
            >
              ✓ Mark All {unreadNotifications.length} Read
            </button>
          )}
          <button
            type="button"
            onClick={() => store.syncFromSupabase(false)}
            className="btn btn-secondary"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Compact Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem'
        }}
      >
        <div className="stats-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <span className="stats-label">Unread Notifications</span>
          <span
            className="stats-value"
            style={{ color: unreadNotifications.length > 0 ? '#2563eb' : 'var(--success)' }}
          >
            {unreadNotifications.length}
          </span>
          <span className="stats-sub">Available for review</span>
        </div>

        <div className="stats-card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <span className="stats-label">Edited Records</span>
          <span className="stats-value" style={{ color: '#7c3aed' }}>
            {editsCount}
          </span>
          <span className="stats-sub">With Previous &rarr; New data</span>
        </div>

        <div className="stats-card" style={{ borderLeft: '4px solid #0284c7' }}>
          <span className="stats-label">Manager Activity</span>
          <span className="stats-value" style={{ color: '#0284c7' }}>
            {managerCount}
          </span>
          <span className="stats-sub">Events, expenses, menu &amp; stock</span>
        </div>

        <div className="stats-card" style={{ borderLeft: '4px solid #059669' }}>
          <span className="stats-label">Accountant Activity</span>
          <span className="stats-value" style={{ color: '#059669' }}>
            {accountantCount}
          </span>
          <span className="stats-sub">Invoices, payments &amp; expenses</span>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '230px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search edited field, old/new value, user, event, invoice..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>View:</span>
            <select
              className="form-control"
              style={{ width: 'auto' }}
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
            >
              <option value="edits_only">Edits Only — Previous &rarr; New ({editsCount})</option>
              <option value="unread">Unread Notifications ({unreadNotifications.length})</option>
              <option value="all_non_owner">All Team Notifications</option>
              <option value="all">All Activity (Including Owner)</option>
              {isSuperAdmin && (
                <option value="super_admin">Super Admin ({superAdminCount})</option>
              )}
              <option value="manager">Manager Only</option>
              <option value="accountant">Accountant Only</option>
              <option value="staff">Staff Only</option>
              <option value="database">Direct Database Edits</option>
              <option value="owner">Owner Only</option>
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
              <option value="events_quotes">Events, Quotes &amp; Expenses</option>
              <option value="expenses">Event Extra Expenses Only</option>
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

      {/* Simplified Notifications & Data Diff Table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            Activity &amp; Data Change History ({filteredLogs.length})
          </h2>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Updated By</th>
                <th>Module</th>
                <th>Edited Data (Previous &rarr; New)</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No matching notifications found. Switch &quot;View&quot; to &quot;All Team Notifications&quot; to see creations and other updates.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const meta = getActorRoleStyle(log.actor_role);
                  const target = getAuditTargetLink(log);
                  const isUnread = !log.is_read_by_owner && log.actor_role !== 'owner' && log.actor_role !== 'super_admin';
                  const { changes, cleanNote } = parseAuditDetails(log.details);

                  return (
                    <tr
                      key={log.id}
                      style={{
                        background: isUnread ? '#f8fafc' : 'transparent'
                      }}
                    >
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.81rem', fontWeight: 500 }}>
                        <div>{formatAuditTimestamp(log.created_at)}</div>
                        {isUnread && (
                          <span
                            className="badge"
                            style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '0.64rem', marginTop: '0.2rem' }}
                          >
                            UNREAD
                          </span>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              background: meta.badgeBg,
                              color: meta.badgeText,
                              padding: '0.08rem 0.38rem',
                              borderRadius: '4px',
                              fontSize: '0.64rem',
                              fontWeight: 700
                            }}
                          >
                            {meta.label}
                          </span>
                          <strong style={{ fontSize: '0.84rem', color: '#0f172a' }}>
                            {log.actor_name}
                          </strong>
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '0.12rem' }}>
                          {log.source === 'database' ? 'supabase_db' : `@${log.actor_username}`}
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
                          {log.entity_type.replace('_', ' ')}
                        </span>
                      </td>

                      <td style={{ minWidth: '300px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.86rem' }}>
                          {log.summary}
                        </div>

                        {changes.length > 0 && (
                          <div
                            style={{
                              marginTop: '0.4rem',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              padding: '0.45rem 0.65rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.28rem'
                            }}
                          >
                            {changes.map((chg, idx) => (
                              <div
                                key={`${log.id}-diff-${idx}`}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  flexWrap: 'wrap',
                                  fontSize: '0.78rem'
                                }}
                              >
                                <span style={{ fontWeight: 700, color: '#334155', minWidth: '105px' }}>
                                  {chg.field}:
                                </span>
                                <span
                                  style={{
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    padding: '0.08rem 0.42rem',
                                    borderRadius: '4px',
                                    textDecoration: 'line-through'
                                  }}
                                  title="Previous Data"
                                >
                                  {chg.before}
                                </span>
                                <span style={{ color: '#64748b', fontWeight: 700 }}>&rarr;</span>
                                <span
                                  style={{
                                    background: '#dcfce7',
                                    color: '#166534',
                                    padding: '0.08rem 0.45rem',
                                    borderRadius: '4px',
                                    fontWeight: 700
                                  }}
                                  title="New Data"
                                >
                                  {chg.after}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {cleanNote && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.22rem' }}>
                            {cleanNote}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
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
                              title="Mark read"
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
