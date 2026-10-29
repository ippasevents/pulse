'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { store } from '@/lib/store';
import { AuditLogEntry } from '@/lib/types';
import { formatAuditTimestamp, getActorRoleStyle } from './OwnerAuditBadge';

interface OwnerActivityAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function getAuditTargetLink(entry: AuditLogEntry): { href: string; label: string } {
  if (entry.parent_event_id) {
    return { href: `/events/${entry.parent_event_id}`, label: 'Open Event & Quote' };
  }
  switch (entry.entity_type) {
    case 'event':
    case 'quotation':
      return {
        href: entry.entity_id ? `/events/${entry.entity_id}` : '/events',
        label: 'Open Event'
      };
    case 'invoice':
    case 'payment':
      return { href: '/invoices', label: 'Open Invoices' };
    case 'client':
      return { href: '/clients', label: 'Open Clients' };
    case 'menu':
    case 'recipe':
      return { href: '/menu', label: 'Open Menu' };
    case 'stock':
    case 'purchase':
      return { href: '/stock', label: 'Open Stock' };
    case 'staff':
    case 'shift':
    case 'salary':
      return { href: '/staff', label: 'Open Staff & Salary' };
    case 'user':
      return { href: '/users', label: 'Open Users' };
    case 'settings':
      return { href: '/settings', label: 'Open Settings' };
    default:
      return { href: '/activity', label: 'Open Audit Log' };
  }
}

export default function OwnerActivityAlertModal({
  isOpen,
  onClose
}: OwnerActivityAlertModalProps) {
  const [role, setRole] = useState(store.getState().currentRole);
  const [unreadAlerts, setUnreadAlerts] = useState<AuditLogEntry[]>([]);
  const [recentNonOwnerLogs, setRecentNonOwnerLogs] = useState<AuditLogEntry[]>([]);
  const [liveToastEntry, setLiveToastEntry] = useState<AuditLogEntry | null>(null);
  const seenToastIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef<boolean>(false);

  useEffect(() => {
    const syncAuditState = () => {
      const s = store.getState();
      setRole(s.currentRole);
      if (s.currentRole !== 'owner' && s.currentRole !== 'super_admin') {
        setUnreadAlerts([]);
        setRecentNonOwnerLogs([]);
        setLiveToastEntry(null);
        return;
      }

      const isSuper = s.currentRole === 'super_admin';
      const unread = isSuper
        ? (s.auditLogs || []).filter((l) => !l.is_read_by_owner && l.actor_role !== 'super_admin')
        : store.getUnreadOwnerAlerts();
      const nonOwner = (s.auditLogs || [])
        .filter((l) => isSuper ? true : (l.actor_role !== 'owner' && l.actor_role !== 'super_admin'))
        .slice(0, 30);

      setUnreadAlerts(unread);
      setRecentNonOwnerLogs(nonOwner);

      // Seed existing IDs on initial mount so only newly arriving changes pop a live toast
      if (!initializedRef.current) {
        unread.forEach((u) => seenToastIdsRef.current.add(u.id));
        initializedRef.current = true;
        return;
      }

      const brandNew = unread.find((u) => !seenToastIdsRef.current.has(u.id));
      if (brandNew) {
        seenToastIdsRef.current.add(brandNew.id);
        setLiveToastEntry(brandNew);
      }
    };

    syncAuditState();
    const unsub = store.subscribe(syncAuditState);
    return unsub;
  }, []);

  // Strict Owner & Super Admin visibility: render nothing for Manager, Accountant, or Staff
  if (role !== 'owner' && role !== 'super_admin') {
    return null;
  }

  return (
    <>
      {/* Live Non-Blocking Toast Banner for New Non-Owner or Direct Database Changes */}
      {liveToastEntry && !isOpen && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            bottom: '1.25rem',
            right: '1.25rem',
            zIndex: 9999,
            maxWidth: '410px',
            width: 'calc(100vw - 2.5rem)',
            background: '#0f172a',
            color: '#f8fafc',
            borderRadius: '12px',
            padding: '0.95rem 1.1rem',
            boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.35)',
            border: '1px solid #334155'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.4rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span
                style={{
                  background: getActorRoleStyle(liveToastEntry.actor_role).badgeBg,
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '0.12rem 0.45rem',
                  borderRadius: '4px'
                }}
              >
                {getActorRoleStyle(liveToastEntry.actor_role).label}
              </span>
              <strong style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: '#fda4af' }}>
                {liveToastEntry.source === 'database'
                  ? 'supabase_db'
                  : `@${liveToastEntry.actor_username}`}
              </strong>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {formatAuditTimestamp(liveToastEntry.created_at)}
            </span>
          </div>

          <div style={{ fontSize: '0.88rem', fontWeight: 600, lineHeight: 1.4, marginBottom: '0.25rem' }}>
            {liveToastEntry.summary}
          </div>
          <div style={{ fontSize: '0.76rem', color: '#cbd5e1', marginBottom: '0.65rem' }}>
            By {liveToastEntry.actor_name}
            {liveToastEntry.details ? ` • ${liveToastEntry.details}` : ''}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <Link
              href={getAuditTargetLink(liveToastEntry).href}
              onClick={() => {
                store.markAuditLogRead(liveToastEntry.id);
                setLiveToastEntry(null);
              }}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
            >
              {getAuditTargetLink(liveToastEntry).label} &rarr;
            </Link>
            <button
              type="button"
              onClick={() => {
                store.markAuditLogRead(liveToastEntry.id);
                setLiveToastEntry(null);
              }}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            >
              Mark Seen
            </button>
          </div>
        </div>
      )}

      {/* Owner Activity & Database Change Modal */}
      {isOpen && (
        <div className="modal-overlay" onClick={onClose}>
          <div
            className="modal-content"
            style={{ maxWidth: '720px', width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                    🛡️ Owner Activity &amp; Database Alerts
                  </h2>
                  <span
                    className="badge"
                    style={{ background: '#fff1f2', color: '#be123c', fontWeight: 700 }}
                  >
                    OWNER ONLY
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Every update made by Managers, Accountants, Staff, or directly in the Supabase Database is reported here.
                </p>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                ✕
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
                flexWrap: 'wrap',
                marginBottom: '1rem',
                paddingBottom: '0.75rem',
                borderBottom: '1px solid var(--border)'
              }}
            >
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                Unread Changes:{' '}
                <strong style={{ color: unreadAlerts.length > 0 ? '#e11d48' : '#059669' }}>
                  {unreadAlerts.length}
                </strong>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {unreadAlerts.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => store.markAllAuditLogsRead()}
                    style={{ fontWeight: 600 }}
                  >
                    ✓ Mark All as Seen
                  </button>
                )}
                <Link
                  href="/activity"
                  onClick={onClose}
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 600 }}
                >
                  Open Full Audit Log &rarr;
                </Link>
              </div>
            </div>

            <div style={{ maxHeight: '62vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {recentNonOwnerLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No non-owner or direct database changes recorded yet.
                </div>
              ) : (
                recentNonOwnerLogs.map((log) => {
                  const meta = getActorRoleStyle(log.actor_role);
                  const target = getAuditTargetLink(log);
                  const isUnread = !log.is_read_by_owner;

                  return (
                    <div
                      key={log.id}
                      style={{
                        background: isUnread ? meta.bg : '#f8fafc',
                        border: `1px solid ${isUnread ? meta.border : 'var(--border)'}`,
                        borderRadius: '8px',
                        padding: '0.75rem 0.9rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '240px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          {isUnread && (
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#e11d48',
                                display: 'inline-block'
                              }}
                              title="Unread change"
                            />
                          )}
                          <span
                            style={{
                              background: meta.badgeBg,
                              color: meta.badgeText,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.66rem',
                              fontWeight: 800
                            }}
                          >
                            {meta.label}
                          </span>
                          <strong style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#0f172a' }}>
                            {log.source === 'database' ? 'supabase_db' : `@${log.actor_username}`}
                          </strong>
                          <span style={{ fontSize: '0.78rem', color: '#475569' }}>
                            ({log.actor_name})
                          </span>
                          <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                            • {formatAuditTimestamp(log.created_at)}
                          </span>
                        </div>

                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                          {log.summary}
                        </div>
                        {log.details && (
                          <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: '0.15rem' }}>
                            {log.details}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Link
                          href={target.href}
                          onClick={() => {
                            if (isUnread) store.markAuditLogRead(log.id);
                            onClose();
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.74rem', fontWeight: 600 }}
                        >
                          {target.label} &rarr;
                        </Link>
                        {isUnread && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.74rem' }}
                            onClick={() => store.markAuditLogRead(log.id)}
                            title="Mark as seen"
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
      )}
    </>
  );
}
