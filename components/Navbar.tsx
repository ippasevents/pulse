'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { store } from '@/lib/store';
import { UserRole } from '@/lib/types';
import { PWAInstallButton } from './PWAInstallButton';
import StockNotificationModal from './StockNotificationModal';
import OwnerActivityAlertModal from './OwnerActivityAlertModal';
import ChangePasswordModal from './ChangePasswordModal';

interface NavRoute {
  label: string;
  href: string;
  desc?: string;
  accent?: string;
}

export default function Navbar() {
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole>('owner');
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [lowStockCount, setLowStockCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadAuditCount, setUnreadAuditCount] = useState(0);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isDbConnected, setIsDbConnected] = useState(false);

  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const state = store.getState();
      setRole(state.currentRole);
      setCurrentUser(store.getCurrentUser());
      setIsDbConnected(store.isSqlConnected());
      const lowCount = state.ingredients.filter((i) => i.stock_qty <= i.low_stock_level).length;
      setLowStockCount(lowCount);
      setUnreadAuditCount(
        state.currentRole === 'owner'
          ? store.getUnreadOwnerAlerts().length
          : state.currentRole === 'super_admin'
          ? (state.auditLogs || []).filter((l) => !l.is_read_by_owner && l.actor_role !== 'super_admin').length
          : 0
      );
    };

    update();
    const unsubscribe = store.subscribe(update);
    return unsubscribe;
  }, []);

  // Close dropdowns on route change or outside click
  useEffect(() => {
    setMoreMenuOpen(false);
    setProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const isStaff = role === 'staff';

  const getPrimaryAndMoreRoutes = (): { primary: NavRoute[]; more: NavRoute[] } => {
    if (role === 'staff') {
      return {
        primary: [
          { label: 'Duty & Salary', href: '/dashboard' },
          { label: 'മലയാളം മാനുവൽ', href: '/manuals' }
        ],
        more: []
      };
    }

    if (role === 'accountant') {
      return {
        primary: [
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Invoices', href: '/invoices' },
          { label: 'Events', href: '/events' },
          { label: 'Clients', href: '/clients' },
          { label: 'Staff', href: '/staff' }
        ],
        more: [
          { label: 'മലയാളം യൂസർ മാനുവൽ (PDF)', href: '/manuals', desc: 'Malayalam PDF user guide', accent: '#059669' }
        ]
      };
    }

    if (role === 'manager') {
      return {
        primary: [
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Events', href: '/events' },
          { label: 'Menu', href: '/menu' },
          { label: 'Stock', href: '/stock' },
          { label: 'Staff', href: '/staff' }
        ],
        more: [
          { label: 'Clients Directory', href: '/clients', desc: 'Customer contacts & bookings', accent: '#2563eb' },
          { label: 'മലയാളം യൂസർ മാനുവൽ (PDF)', href: '/manuals', desc: 'Malayalam PDF user manuals', accent: '#059669' }
        ]
      };
    }

    // Owner & Super Admin — clean 5 primary links + organized More menu
    return {
      primary: [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Events', href: '/events' },
        { label: 'Menu', href: '/menu' },
        { label: 'Invoices', href: '/invoices' },
        { label: 'Staff', href: '/staff' }
      ],
      more: [
        { label: 'Stock & Inventory', href: '/stock', desc: 'Warehouse pantry, bulk update & CSV', accent: '#d97706' },
        { label: 'Clients Directory', href: '/clients', desc: 'Customer profiles & event history', accent: '#2563eb' },
        { label: 'Profit & Loss (P&L)', href: '/pnl', desc: 'Event expenditure & net profit', accent: '#e11d48' },
        { label: 'Activity History', href: '/activity', desc: 'Previous → New edited data log', accent: '#6366f1' },
        { label: 'Team & Passwords', href: '/users', desc: 'Manage Manager, Accountant & Staff logins', accent: '#7c3aed' },
        { label: 'Business Settings', href: '/settings', desc: 'Bank details, terms & cloud sync', accent: '#0d9488' },
        { label: 'മലയാളം യൂസർ മാനുവൽ (PDF)', href: '/manuals', desc: '4 role-wise Malayalam PDF manuals', accent: '#059669' }
      ]
    };
  };

  const { primary: primaryRoutes, more: moreRoutes } = getPrimaryAndMoreRoutes();

  const isRouteActive = (href: string) =>
    pathname === href ||
    (href === '/dashboard' && pathname === '/') ||
    (href !== '/dashboard' && pathname.startsWith(href));

  const isAnyMoreActive = moreRoutes.some((r) => isRouteActive(r.href));

  const roleAccent: Record<UserRole, string> = {
    super_admin: '#4f46e5',
    owner: '#e11d48',
    manager: '#2563eb',
    accountant: '#059669',
    staff: '#7c3aed'
  };

  const roleDisplayName: Record<UserRole, string> = {
    super_admin: 'System Admin',
    owner: 'Owner',
    manager: 'Manager',
    accountant: 'Accountant',
    staff: 'Staff'
  };

  const initials = (currentUser?.full_name || 'IP')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <>
      <header className="top-navbar">
        <div className="top-navbar-accent" />
        <div className="nav-inner">
          {/* Zone 1: Brand Logo */}
          <div className="brand-section">
            <Link
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <img
                src="/logo.png"
                alt="IPPAS Food Service & Events"
                referrerPolicy="no-referrer"
                className="brand-logo-img"
              />
            </Link>
          </div>

          {/* Zone 2: Simplified Single-Row Primary Nav (Desktop) */}
          <nav className="nav-links desktop-only" aria-label="Main Navigation">
            {primaryRoutes.map((item) => {
              const active = isRouteActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${active ? 'active' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}

            {moreRoutes.length > 0 && (
              <div ref={moreRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setMoreMenuOpen((prev) => !prev)}
                  className={`nav-link nav-more-trigger ${isAnyMoreActive || moreMenuOpen ? 'active' : ''}`}
                >
                  <span>More</span>
                  <span style={{ fontSize: '0.7rem', marginLeft: '0.22rem' }}>▾</span>
                </button>

                {moreMenuOpen && (
                  <div className="nav-dropdown-menu" style={{ left: 0, minWidth: '285px' }}>
                    {moreRoutes.map((item) => {
                      const active = isRouteActive(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreMenuOpen(false)}
                          className={`nav-dropdown-item ${active ? 'active' : ''}`}
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '2px',
                              background: item.accent || '#e11d48',
                              flexShrink: 0,
                              marginTop: '0.35rem'
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#0f172a' }}>
                              {item.label}
                            </div>
                            {item.desc && (
                              <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '0.08rem' }}>
                                {item.desc}
                              </div>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Zone 3: Compact Action & Profile Cluster (Desktop & Mobile) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
            <PWAInstallButton variant="navbar" />

            {!isStaff && (
              <button
                type="button"
                onClick={() => setIsNotifOpen(true)}
                className="nav-icon-btn"
                style={{
                  background: lowStockCount > 0 ? '#fff1f2' : '#f8fafc',
                  borderColor: lowStockCount > 0 ? '#fecdd3' : '#e2e8f0',
                  color: lowStockCount > 0 ? '#be123c' : '#475569'
                }}
                title="Warehouse Low Stock Alerts"
              >
                <span>📦</span>
                {lowStockCount > 0 && (
                  <span className="nav-count-badge" style={{ background: '#e11d48', color: '#ffffff' }}>
                    {lowStockCount}
                  </span>
                )}
              </button>
            )}

            {(role === 'owner' || role === 'super_admin') && (
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(true)}
                className="nav-icon-btn"
                style={{
                  background: unreadAuditCount > 0 ? '#eef2ff' : '#f8fafc',
                  borderColor: unreadAuditCount > 0 ? '#c7d2fe' : '#e2e8f0',
                  color: unreadAuditCount > 0 ? '#4338ca' : '#475569'
                }}
                title="Recent Edits & Activity Notifications"
              >
                <span>🔔</span>
                {unreadAuditCount > 0 && (
                  <span className="nav-count-badge" style={{ background: '#4f46e5', color: '#ffffff' }}>
                    {unreadAuditCount}
                  </span>
                )}
              </button>
            )}

            {/* Account Profile Dropdown */}
            <div ref={profileRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
                className="nav-profile-trigger"
                title="Account & Settings"
              >
                <span
                  className="nav-avatar"
                  style={{ background: roleAccent[role] || '#e11d48' }}
                >
                  {initials}
                </span>
                <span className="desktop-only" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUser?.full_name?.split(' ')[0] || 'Account'}
                </span>
                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>▾</span>
              </button>

              {profileMenuOpen && (
                <div className="nav-dropdown-menu" style={{ right: 0, minWidth: '245px' }}>
                  <div
                    style={{
                      padding: '0.65rem 0.75rem',
                      borderBottom: '1px solid #f1f5f9',
                      marginBottom: '0.3rem'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                      {currentUser?.full_name || 'User'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.12rem' }}>
                      {roleDisplayName[role]} &middot; {isDbConnected ? 'Cloud Synced' : 'Online'}
                    </div>
                  </div>

                  <Link
                    href="/manuals"
                    onClick={() => setProfileMenuOpen(false)}
                    className="nav-dropdown-item"
                  >
                    <span>📘</span>
                    <span style={{ fontWeight: 600, fontSize: '0.83rem' }}>
                      മലയാളം യൂസർ മാനുവൽ (PDF)
                    </span>
                  </Link>

                  {(role === 'owner' || role === 'super_admin') && (
                    <Link
                      href="/settings"
                      onClick={() => setProfileMenuOpen(false)}
                      className="nav-dropdown-item"
                    >
                      <span>⚙️</span>
                      <span style={{ fontWeight: 600, fontSize: '0.83rem' }}>
                        Business Settings
                      </span>
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setIsChangePasswordOpen(true);
                    }}
                    className="nav-dropdown-item"
                    style={{ width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                  >
                    <span>🔑</span>
                    <span style={{ fontWeight: 600, fontSize: '0.83rem' }}>
                      Change Password
                    </span>
                  </button>

                  <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '0.3rem', paddingTop: '0.3rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        store.logout();
                      }}
                      className="nav-dropdown-item"
                      style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: '#dc2626'
                      }}
                    >
                      <span>🚪</span>
                      <span style={{ fontWeight: 700, fontSize: '0.83rem' }}>
                        Sign Out
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {!isStaff && (
        <StockNotificationModal isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
      )}

      {(role === 'owner' || role === 'super_admin') && (
        <OwnerActivityAlertModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
        />
      )}

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </>
  );
}
