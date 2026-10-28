'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { store } from '@/lib/store';
import { UserRole } from '@/lib/types';
import { PWAInstallButton } from './PWAInstallButton';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [role, setRole] = useState<UserRole>('owner');

  useEffect(() => {
    setRole(store.getState().currentRole);
    const unsub = store.subscribe(() => {
      setRole(store.getState().currentRole);
    });
    return unsub;
  }, []);

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    { label: 'Events', href: '/events', icon: '📅' },
    { label: 'Menu', href: '/menu', icon: '🍽️' },
    { label: 'Stock', href: '/stock', icon: '📦' },
    { label: 'More', href: '#more', icon: '☰', isMore: true }
  ];

  const moreLinks = [
    { label: 'Clients Directory', href: '/clients', icon: '👥', desc: 'Customer profiles & past history' },
    { label: 'Staff & Roster', href: '/staff', icon: '🧑‍🍳', desc: 'Crew members & shift timings' },
    { label: 'Invoices & Receipts', href: '/invoices', icon: '🧾', desc: 'Billing, A4 prints & payments' },
    { label: 'User Roles', href: '/users', icon: '🛡️', desc: 'Access levels & profiles' },
    { label: 'Business Settings', href: '/settings', icon: '⚙️', desc: 'Company info & database status' }
  ];

  return (
    <>
      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        {navItems.map((item) => {
          if (item.isMore) {
            const isMoreActive =
              isMoreOpen ||
              ['/clients', '/staff', '/invoices', '/users', '/settings'].some((p) =>
                pathname.startsWith(p)
              );

            return (
              <button
                key="more-btn"
                type="button"
                onClick={() => setIsMoreOpen(true)}
                className={`mobile-nav-item ${isMoreActive ? 'active' : ''}`}
              >
                <span className="mobile-nav-icon">{item.icon}</span>
                <span className="mobile-nav-label">{item.label}</span>
              </button>
            );
          }

          const isActive =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile "More" Drawer / Bottom Sheet */}
      {isMoreOpen && (
        <div className="modal-overlay" onClick={() => setIsMoreOpen(false)}>
          <div
            className="mobile-bottom-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bottom-sheet-handle" />
            <div className="modal-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Catering Operations</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Quick navigation &amp; role management
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setIsMoreOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Quick Role Switch in Mobile Drawer */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  ACTIVE ROLE PREVIEW:
                </span>
                <span
                  className="role-tag-badge"
                  style={{
                    background:
                      role === 'owner'
                        ? '#e11d48'
                        : role === 'manager'
                        ? '#2563eb'
                        : role === 'accountant'
                        ? '#059669'
                        : role === 'chef'
                        ? '#d97706'
                        : '#64748b',
                    color: 'white'
                  }}
                >
                  {role.toUpperCase()}
                </span>
              </div>
              <select
                value={role}
                onChange={(e) => store.setRole(e.target.value as UserRole)}
                className="form-control"
                style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
              >
                <option value="owner">Owner (Full admin)</option>
                <option value="manager">Manager (Ops &amp; quotes)</option>
                <option value="accountant">Accountant (Billing)</option>
                <option value="chef">Chef (Kitchen &amp; stock)</option>
                <option value="staff">Staff (Read-only)</option>
              </select>
            </div>

            {/* Links list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {moreLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMoreOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: pathname.startsWith(link.href) ? 'var(--primary-light)' : '#ffffff',
                    border: '1px solid var(--border)',
                    color: 'var(--text-main)'
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>{link.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{link.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{link.desc}</div>
                  </div>
                  <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
                </Link>
              ))}
            </div>

            {/* PWA Install Button inside Drawer */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '0.5rem' }}>
              <PWAInstallButton />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
