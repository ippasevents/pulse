'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { store } from '@/lib/store';
import { UserRole } from '@/lib/types';
import { PWAInstallButton } from './PWAInstallButton';
import StockNotificationModal from './StockNotificationModal';
import ChangePasswordModal from './ChangePasswordModal';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [role, setRole] = useState<UserRole>('owner');
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [lowStockCount, setLowStockCount] = useState(0);
  const [unreadAuditCount, setUnreadAuditCount] = useState(0);

  useEffect(() => {
    const update = () => {
      const state = store.getState();
      setRole(state.currentRole);
      setCurrentUser(store.getCurrentUser());
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
    const unsub = store.subscribe(update);
    return unsub;
  }, []);

  const isStaff = role === 'staff';

  const getNavItems = () => {
    if (isStaff) {
      return [
        { label: 'My Duty', href: '/dashboard', icon: '📍' },
        { label: 'മാനുവൽ', href: '/manuals', icon: '📘' },
        { label: 'Install', href: '#install', icon: '📲', isInstall: true },
        { label: 'Password', href: '#password', icon: '🔑', isPassword: true },
        { label: 'Sign Out', href: '#logout', icon: '🚪', isLogout: true }
      ];
    }

    if (role === 'accountant') {
      return [
        { label: 'Home', href: '/dashboard', icon: '📊' },
        { label: 'Invoices', href: '/invoices', icon: '🧾' },
        { label: 'Staff', href: '/staff', icon: '🧑‍🍳' },
        { label: 'Vendors', href: '/stock', icon: '📦' },
        { label: 'More', href: '#more', icon: '☰', isMore: true }
      ];
    }

    if (role === 'manager') {
      return [
        { label: 'Home', href: '/dashboard', icon: '📅' },
        { label: 'Events', href: '/events', icon: '📋' },
        { label: 'Menu', href: '/menu', icon: '🍽️' },
        { label: 'Stock', href: '/stock', icon: '📦' },
        { label: 'More', href: '#more', icon: '☰', isMore: true }
      ];
    }

    // Owner & Super Admin
    return [
      { label: 'Home', href: '/dashboard', icon: '📊' },
      { label: 'Events', href: '/events', icon: '📅' },
      { label: 'Invoices', href: '/invoices', icon: '🧾' },
      { label: 'Staff', href: '/staff', icon: '🧑‍🍳' },
      { label: 'More', href: '#more', icon: '☰', isMore: true }
    ];
  };

  const navItems = getNavItems();

  const allMoreTiles = [
    { label: 'Events & Quotes', href: '/events', icon: '📅', bg: '#fff1f2', border: '#fecdd3', color: '#be123c', roles: ['accountant'] },
    { label: 'Menu & Recipes', href: '/menu', icon: '🍽️', bg: '#fff1f2', border: '#fecdd3', color: '#be123c', roles: ['super_admin', 'owner', 'manager'] },
    { label: 'Vendor Bills & Stock', href: '/stock', icon: '📦', bg: '#fffbeb', border: '#fde68a', color: '#b45309', roles: ['super_admin', 'owner', 'manager', 'accountant'] },
    { label: 'Clients', href: '/clients', icon: '👥', bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', roles: ['super_admin', 'owner', 'manager', 'accountant'] },
    { label: 'Profit & Loss', href: '/pnl', icon: '📈', bg: '#ecfdf5', border: '#a7f3d0', color: '#047857', roles: ['super_admin', 'owner'] },
    { label: 'Staff & Payroll', href: '/staff', icon: '🧑‍🍳', bg: '#f5f3ff', border: '#ddd6fe', color: '#6d28d9', roles: ['super_admin', 'owner', 'manager', 'accountant'] },
    {
      label: unreadAuditCount > 0 ? `Activity (${unreadAuditCount})` : 'Activity Log',
      href: '/activity',
      icon: '🔔',
      bg: '#eef2ff',
      border: '#c7d2fe',
      color: '#4338ca',
      roles: ['super_admin', 'owner']
    },
    { label: 'Team Logins', href: '/users', icon: '🛡️', bg: '#fdf4ff', border: '#f5d0fe', color: '#a21caf', roles: ['super_admin', 'owner'] },
    { label: 'Settings', href: '/settings', icon: '⚙️', bg: '#f0fdfa', border: '#99f6e4', color: '#0f766e', roles: ['super_admin', 'owner'] },
    { label: 'മലയാളം മാനുവൽ', href: '/manuals', icon: '📘', bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', roles: ['super_admin', 'owner', 'manager', 'accountant'] }
  ];

  const visibleMoreTiles = allMoreTiles.filter((t) => t.roles.includes(role));

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        {navItems.map((item: any) => {
          if (item.isLogout) {
            return (
              <button
                key="logout-btn"
                type="button"
                onClick={() => store.logout()}
                className="mobile-nav-item"
              >
                <span className="mobile-nav-icon">{item.icon}</span>
                <span className="mobile-nav-label">{item.label}</span>
              </button>
            );
          }

          if (item.isInstall) {
            return <PWAInstallButton key="install-btn" variant="bottom" />;
          }

          if (item.isPassword) {
            return (
              <button
                key="password-btn"
                type="button"
                onClick={() => setIsChangePasswordOpen(true)}
                className="mobile-nav-item"
              >
                <span className="mobile-nav-icon">{item.icon}</span>
                <span className="mobile-nav-label">{item.label}</span>
              </button>
            );
          }

          if (item.isMore) {
            return (
              <button
                key="more-btn"
                type="button"
                onClick={() => setIsMoreOpen(true)}
                className={`mobile-nav-item ${isMoreOpen ? 'active' : ''}`}
              >
                <span className="mobile-nav-icon-wrap">
                  <span className="mobile-nav-icon">{item.icon}</span>
                </span>
                <span className="mobile-nav-label">{item.label}</span>
              </button>
            );
          }

          const isActive =
            pathname === item.href ||
            (item.href === '/dashboard' && pathname === '/') ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="mobile-nav-icon-wrap">
                <span className="mobile-nav-icon">{item.icon}</span>
              </span>
              <span className="mobile-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Simplified Colourful Mobile Drawer */}
      {!isStaff && isMoreOpen && (
        <div className="modal-overlay" onClick={() => setIsMoreOpen(false)}>
          <div className="mobile-bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.9rem',
                paddingBottom: '0.65rem',
                borderBottom: '1px solid #f1f5f9'
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.08rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  All Modules
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.1rem' }}>
                  {currentUser?.full_name} &middot; {role === 'super_admin' ? 'Admin' : role}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsMoreOpen(false)}
              >
                ✕
              </button>
            </div>

            {lowStockCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  setIsNotifOpen(true);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  marginBottom: '0.85rem',
                  borderRadius: '10px',
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  color: '#be123c',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer'
                }}
              >
                <span>📦 Low Stock Alert ({lowStockCount} items)</span>
                <span>View &rarr;</span>
              </button>
            )}

            {/* Colourful 2-Column Module Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.6rem',
                marginBottom: '0.95rem'
              }}
            >
              {visibleMoreTiles.map((tile) => {
                const active = pathname.startsWith(tile.href);
                return (
                  <Link
                    key={tile.href}
                    href={tile.href}
                    onClick={() => setIsMoreOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.75rem 0.8rem',
                      borderRadius: '12px',
                      background: tile.bg,
                      border: `1.5px solid ${active ? tile.color : tile.border}`,
                      color: '#0f172a',
                      minHeight: '54px'
                    }}
                  >
                    <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{tile.icon}</span>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.83rem',
                        color: tile.color,
                        lineHeight: 1.25
                      }}
                    >
                      {tile.label}
                    </span>
                  </Link>
                );
              })}
            </div>

            <div style={{ marginBottom: '0.85rem' }}>
              <PWAInstallButton variant="banner" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  setIsChangePasswordOpen(true);
                }}
                className="btn btn-secondary btn-sm"
                style={{ fontWeight: 600 }}
              >
                🔑 Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  store.logout();
                }}
                className="btn btn-danger btn-sm"
                style={{ fontWeight: 700 }}
              >
                🚪 Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {!isStaff && (
        <StockNotificationModal isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
      )}

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </>
  );
}
