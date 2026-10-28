'use client';

import React from 'react';
import { AuditLogEntry, UserRole } from '@/lib/types';
import { store } from '@/lib/store';

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
        bg: '#fff1f2',
        text: '#881337',
        border: '#fecdd3',
        badgeBg: '#e11d48',
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

  // Strictly visible ONLY to Owner
  if (activeRole !== 'owner' || !entry) {
    return null;
  }

  const styleMeta = getActorRoleStyle(entry.actor_role);
  const loginDisplay =
    entry.source === 'database' ? 'supabase_db' : `@${entry.actor_username}`;

  if (variant === 'banner') {
    return (
      <div
        style={{
          background: styleMeta.bg,
          border: `1px solid ${styleMeta.border}`,
          color: styleMeta.text,
          borderRadius: '8px',
          padding: '0.55rem 0.85rem',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.65rem',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700 }}>🛡️ {prefixLabel}:</span>
          <span
            style={{
              background: styleMeta.badgeBg,
              color: styleMeta.badgeText,
              padding: '0.1rem 0.45rem',
              borderRadius: '4px',
              fontSize: '0.68rem',
              fontWeight: 800,
              letterSpacing: '0.02em'
            }}
          >
            {styleMeta.label}
          </span>
          <strong style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
            {loginDisplay}
          </strong>
          <span style={{ opacity: 0.9 }}>({entry.actor_name})</span>
          {showSummary && entry.summary && (
            <span style={{ opacity: 0.85 }}>— {entry.summary}</span>
          )}
        </div>
        <span style={{ fontSize: '0.74rem', fontWeight: 600, opacity: 0.85 }}>
          🕒 {formatAuditTimestamp(entry.created_at)}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        flexWrap: 'wrap',
        background: styleMeta.bg,
        border: `1px solid ${styleMeta.border}`,
        color: styleMeta.text,
        borderRadius: '6px',
        padding: '0.2rem 0.5rem',
        fontSize: '0.72rem',
        lineHeight: 1.35,
        marginTop: '0.25rem'
      }}
      title={`${entry.summary}${entry.details ? ` | ${entry.details}` : ''} (${formatAuditTimestamp(entry.created_at)})`}
    >
      <span
        style={{
          background: styleMeta.badgeBg,
          color: styleMeta.badgeText,
          padding: '0.05rem 0.35rem',
          borderRadius: '3px',
          fontSize: '0.62rem',
          fontWeight: 800
        }}
      >
        {styleMeta.label}
      </span>
      <span style={{ fontWeight: 600 }}>{prefixLabel}:</span>
      <strong style={{ fontFamily: 'monospace' }}>{loginDisplay}</strong>
      <span style={{ opacity: 0.85 }}>• {formatAuditTimestamp(entry.created_at)}</span>
    </div>
  );
}
