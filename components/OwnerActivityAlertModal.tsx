'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BackupReminderStatus, store } from '@/lib/store';
import { AuditLogEntry } from '@/lib/types';
import { parseAuditDetails } from '@/lib/auditDiff';
import { formatAuditTimestamp, getActorRoleStyle } from './OwnerAuditBadge';

interface OwnerActivityAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function getAuditTargetLink(entry: AuditLogEntry): { href: string; label: string } {
  if (entry.parent_event_id) {
    return { href: `/events/${entry.parent_event_id}`, label: 'View Event' };
  }
  switch (entry.entity_type) {
    case 'event':
    case 'quotation':
    case 'event_expense':
      return {
        href: entry.entity_id && entry.entity_type !== 'event_expense' ? `/events/${entry.entity_id}` : '/events',
        label: 'View Event'
      };
    case 'invoice':
    case 'payment':
      return { href: '/invoices', label: 'View Invoices' };
    case 'client':
      return { href: '/clients', label: 'View Clients' };
    case 'menu':
    case 'recipe':
      return { href: '/menu', label: 'View Menu' };
    case 'stock':
    case 'purchase':
      return { href: '/stock', label: 'View Stock' };
    case 'staff':
    case 'shift':
    case 'salary':
      return { href: '/staff', label: 'View Staff' };
    case 'user':
      return { href: '/users', label: 'View Users' };
    case 'settings':
      return { href: '/settings', label: 'View Settings' };
    default:
      return { href: '/activity', label: 'View History' };
  }
}

export default function OwnerActivityAlertModal({
  isOpen,
  onClose
}: OwnerActivityAlertModalProps) {
  const [role, setRole] = useState(store.getState().currentRole);
  const [unreadLogs, setUnreadLogs] = useState<AuditLogEntry[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLogEntry[]>([]);
  const [backupStatus, setBackupStatus] = useState<BackupReminderStatus>(() =>
    store.getBackupReminderStatus()
  );
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'unread' | 'edits' | 'all'>('all');

  useEffect(() => {
    const syncAuditState = () => {
      const s = store.getState();
      setRole(s.currentRole);
      setBackupStatus(store.getBackupReminderStatus());
      if (s.currentRole !== 'owner' && s.currentRole !== 'super_admin') {
        setUnreadLogs([]);
        setRecentLogs([]);
        return;
      }

      const isSuper = s.currentRole === 'super_admin';
      const unread = isSuper
        ? (s.auditLogs || []).filter((l) => !l.is_read_by_owner && l.actor_role !== 'super_admin')
        : store.getUnreadOwnerAlerts();
      const nonOwner = (s.auditLogs || [])
        .filter((l) => (isSuper ? true : l.actor_role !== 'owner' && l.actor_role !== 'super_admin'))
        .slice(0, 50);

      setUnreadLogs(unread);
      setRecentLogs(nonOwner);
    };

    syncAuditState();
    const unsub = store.subscribe(syncAuditState);
    return unsub;
  }, []);

  // Strict Owner & Super Admin visibility: render nothing for Manager, Accountant, or Staff
  if (!isOpen || (role !== 'owner' && role !== 'super_admin')) {
    return null;
  }

  const totalPendingAlertCount = unreadLogs.length + (backupStatus.isDue ? 1 : 0);

  const displayedLogs = recentLogs.filter((log) => {
    if (filterTab === 'unread') {
      return !log.is_read_by_owner;
    }
    if (filterTab === 'edits') {
      const parsed = parseAuditDetails(log.details);
      return log.action === 'update' || parsed.changes.length > 0;
    }
    return true;
  });

  const handleQuickBackupDownload = async () => {
    setIsDownloadingBackup(true);
    setBackupFeedback(null);
    try {
      const res = await store.downloadFullDatabaseBackupJson();
      setBackupStatus(store.getBackupReminderStatus());
      setBackupFeedback(
        `Downloaded ${res.filename} successfully. Next backup reminder scheduled in 15 days.`
      );
    } catch (err: any) {
      setBackupFeedback(err?.message || 'Could not download backup file.');
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  return (
    <div className="modal-overlay no-print" onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '680px', width: '95%' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                🔔 Notifications &amp; Edit History
              </h2>
              {totalPendingAlertCount > 0 && (
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#1d4ed8',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  &middot; {totalPendingAlertCount} Active
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Review 15-day database backup reminders and staff/manager/accountant edits (Previous Data &rarr; New Data).
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* PERSISTENT 15-DAY DATABASE BACKUP NOTIFICATION (STAYS UNTIL DOWNLOADED) */}
        {backupStatus.isDue && (
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fcd34d',
              borderTop: '3px solid #d97706',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              marginBottom: '0.9rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '0.75rem',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ flex: '1 1 260px' }}>
                <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#92400e' }}>
                  ⚠️ 15-Day Full Database Backup Due
                </div>
                <p
                  style={{
                    fontSize: '0.78rem',
                    color: '#78350f',
                    margin: '0.22rem 0 0',
                    lineHeight: 1.45,
                    fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {backupStatus.lastBackupAt
                    ? `It has been ${backupStatus.daysSinceBackup ?? 0} days since your last full database download. `
                    : 'You have not downloaded a full restorable database backup yet. '}
                  This reminder stays active until you download the full database backup.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                  disabled={isDownloadingBackup}
                  onClick={handleQuickBackupDownload}
                >
                  {isDownloadingBackup ? 'Preparing...' : '💾 Download Full Backup (.json)'}
                </button>
                <Link
                  href="/settings"
                  onClick={onClose}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.76rem', fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  Restore / Settings &rarr;
                </Link>
              </div>
            </div>
          </div>
        )}

        {backupFeedback && (
          <div
            style={{
              background: '#dcfce7',
              border: '1px solid #86efac',
              color: '#166534',
              padding: '0.6rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '0.85rem'
            }}
          >
            {backupFeedback}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginBottom: '0.9rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border)'
          }}
        >
          <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`btn btn-sm ${filterTab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.76rem', padding: '0.28rem 0.65rem', whiteSpace: 'nowrap' }}
            >
              All Recent ({recentLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('edits')}
              className={`btn btn-sm ${filterTab === 'edits' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.76rem', padding: '0.28rem 0.65rem', whiteSpace: 'nowrap' }}
            >
              Edits Only (Previous &rarr; New)
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('unread')}
              className={`btn btn-sm ${filterTab === 'unread' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.76rem', padding: '0.28rem 0.65rem', whiteSpace: 'nowrap' }}
            >
              Unread ({unreadLogs.length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            {unreadLogs.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => store.markAllAuditLogsRead()}
                style={{ fontSize: '0.76rem', fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                ✓ Mark Activity Read
              </button>
            )}
            <Link
              href="/activity"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.76rem', fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Full History &rarr;
            </Link>
          </div>
        </div>

        <div style={{ maxHeight: '58vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {displayedLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              No activity notifications in this view.
            </div>
          ) : (
            displayedLogs.map((log) => {
              const meta = getActorRoleStyle(log.actor_role);
              const target = getAuditTargetLink(log);
              const isUnread = !log.is_read_by_owner;
              const { changes, cleanNote } = parseAuditDetails(log.details);

              return (
                <div
                  key={log.id}
                  style={{
                    background: isUnread ? '#f8fafc' : '#ffffff',
                    border: `1px solid ${isUnread ? '#94a3b8' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '0.7rem 0.85rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                      <span
                        style={{
                          color: meta.badgeBg,
                          fontSize: '0.74rem',
                          fontWeight: 800
                        }}
                      >
                        {isUnread ? '[Unread] ' : ''}
                        {meta.label}
                      </span>
                      <span aria-hidden="true" style={{ color: '#94a3b8' }}>&middot;</span>
                      <strong style={{ fontSize: '0.8rem', color: '#0f172a' }}>
                        {log.actor_name}
                      </strong>
                      <span aria-hidden="true" style={{ color: '#94a3b8' }}>&middot;</span>
                      <span style={{ fontSize: '0.73rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                        {formatAuditTimestamp(log.created_at)}
                      </span>
                    </div>

                    <div style={{ fontWeight: 600, fontSize: '0.86rem', color: '#0f172a' }}>
                      {log.summary}
                    </div>

                    {changes.length > 0 && (
                      <div
                        style={{
                          marginTop: '0.4rem',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '0.4rem 0.6rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem'
                        }}
                      >
                        {changes.map((chg, idx) => (
                          <div
                            key={`${log.id}-chg-${idx}`}
                            style={{
                              fontSize: '0.76rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              flexWrap: 'wrap'
                            }}
                          >
                            <span style={{ fontWeight: 700, color: '#334155', minWidth: '90px' }}>
                              {chg.field}:
                            </span>
                            <span
                              style={{
                                background: '#fee2e2',
                                color: '#991b1b',
                                padding: '0.06rem 0.38rem',
                                borderRadius: '4px',
                                textDecoration: 'line-through',
                                fontWeight: 500
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
                                padding: '0.06rem 0.42rem',
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
                      <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem' }}>
                        {cleanNote}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Link
                      href={target.href}
                      onClick={() => {
                        if (isUnread) store.markAuditLogRead(log.id);
                        onClose();
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.73rem', fontWeight: 600, whiteSpace: 'nowrap' }}
                    >
                      {target.label} &rarr;
                    </Link>
                    {isUnread && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '0.73rem' }}
                        onClick={() => store.markAuditLogRead(log.id)}
                        title="Mark as read"
                      >
                        ✓
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
