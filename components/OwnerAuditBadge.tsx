'use client';

import React from 'react';
import { AuditLogEntry, UserRole } from '@/lib/types';
import { store } from '@/lib/store';
import { parseAuditDetails } from '@/lib/auditDiff';

interface OwnerAuditBadgeProps {
  entry?: AuditLogEntry;
  role?: UserRole;
  prefixLabel?: string;
  variant?: 'compact' | 'banner';
  showSummary?: boolean;
}

export function formatAuditTimestamp(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function getActorRoleStyle(actorRole: UserRole | 'database'): {
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  label: string;
} {
  switch (actorRole) {
    case 'super_admin':
      return {
        bg: '#eef2ff',
        text: '#312e81',
        border: '#c7d2fe',
        badgeBg: '#4f46e5',
        badgeText: '#ffffff',
        label: 'SUPER ADMIN'
      };
    case 'manager':
      return {
        bg: '#eff6ff',
        text: '#1e3a8a',
        border: '#bfdbfe',
        badgeBg: '#2563eb',
        badgeText: '#ffffff',
        label: 'MANAGER'
      };
    case 'accountant':
      return {
        bg: '#ecfdf5',
        text: '#065f46',
        border: '#a7f3d0',
        badgeBg: '#059669',
        badgeText: '#ffffff',
        label: 'ACCOUNTANT'
      };
    case 'staff':
      return {
        bg: '#f5f3ff',
        text: '#4c1d95',
        border: '#ddd6fe',
        badgeBg: '#7c3aed',
        badgeText: '#ffffff',
        label: 'STAFF'
      };
    case 'database':
      return {
        bg: '#fff7ed',
        text: '#9a3412',
        border: '#fed7aa',
        badgeBg: '#ea580c',
        badgeText: '#ffffff',
        label: 'DIRECT DB'
      };
    default:
      return {
        bg: '#f8fafc',
        text: '#334155',
        border: '#e2e8f0',
        badgeBg: '#475569',
        badgeText: '#ffffff',
        label: 'OWNER'
      };
  }
}

export default function OwnerAuditBadge({
  entry,
  role,
  prefixLabel = 'Last updated by',
  variant = 'compact',
  showSummary = false
}: OwnerAuditBadgeProps) {
  const activeRole = role ?? store.getState().currentRole;

  // Strictly visible ONLY to Owner and Super Admin
  const isPrivileged = activeRole === 'owner' || activeRole === 'super_admin';
  if (!isPrivileged || !entry) {
    return null;
  }

  // CRITICAL STEALTH: Super Admin activities must NEVER be visible to Owner!
  if (activeRole === 'owner' && entry.actor_role === 'super_admin') {
    return null;
  }

  // Simplified UX: Keep all compact table rows clean — activity history lives quietly in Notifications
  if (variant === 'compact') {
    return null;
  }

  const styleMeta = getActorRoleStyle(entry.actor_role);
  const loginDisplay =
    entry.source === 'database' ? 'supabase_db' : `@${entry.actor_username}`;
  const parsed = parseAuditDetails(entry.details);

  return (
    <div
      className="no-print"
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        color: '#334155',
        borderRadius: '8px',
        padding: '0.5rem 0.85rem',
        fontSize: '0.78rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.65rem',
        flexWrap: 'wrap'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, color: '#64748b' }}>{prefixLabel}:</span>
        <span
          style={{
            background: styleMeta.badgeBg,
            color: styleMeta.badgeText,
            padding: '0.08rem 0.42rem',
            borderRadius: '4px',
            fontSize: '0.66rem',
            fontWeight: 700
          }}
        >
          {styleMeta.label}
        </span>
        <strong style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#0f172a' }}>
          {loginDisplay}
        </strong>
        {showSummary && parsed.changes.length > 0 && (
          <span style={{ color: '#475569' }}>
            • {parsed.changes[0].field}:{' '}
            <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>
              {parsed.changes[0].before}
            </span>{' '}
            &rarr; <strong style={{ color: '#059669' }}>{parsed.changes[0].after}</strong>
          </span>
        )}
      </div>
      <span style={{ fontSize: '0.73rem', color: '#64748b' }}>
        {formatAuditTimestamp(entry.created_at)}
      </span>
    </div>
  );
}
