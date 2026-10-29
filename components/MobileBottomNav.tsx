'use client';

import React, { useState, useEffect } from 'react';
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

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out?')) {
      store.logout();
    }
  };

  const isStaff = role === 'staff';

  const getNavItems = () => {
    if (isStaff) {
      return [
        { label: 'Duty & Salary', href: '/dashboard', icon: '📍' },
        { label: 'Install App', href: '#install', icon: '📲', isInstall: true },
        { label: 'Password', href: '#password', icon: '🔑', isPassword: true },
        { label: 'Logout', href: '#logout', icon: '🚪', isLogout: true }
      ];
    }

    if (role === 'accountant') {
      return [
        { label: 'Dashboard', href: '/dashboard', icon: '📊' },
        { label: 'Invoices', href: '/invoices', icon: '🧾' },
        { label: 'Events', href: '/events', icon: '📅' },
        { label: 'Clients', href: '/clients', icon: '👥' },
        { label: 'More', href: '#more', icon: '☰', isMore: true }
      ];
    }

    if (role === 'manager') {
      return [
        { label: 'Dashboard', href: '/dashboard', icon: '📅' },
        { label: 'Events', href: '/events', icon: '📋' },
        { label: 'Menu', href: '/menu', icon: '🍽️' },
        { label: 'Stock', href: '/stock', icon: '📦' },
        { label: 'More', href: '#more', icon: '☰', isMore: true }
      ];
    }

    // Owner & Super Admin (all)
    return [
      { label: 'Dashboard', href: '/dashboard', icon: '📊' },
      { label: 'Events', href: '/events', icon: '📅' },
      { label: 'Menu', href: '/menu', icon: '🍽️' },
      { label: 'Invoices', href: '/invoices', icon: '🧾' },
      { label: 'More', href: '#more', icon: '☰', isMore: true }
    ];
  };

  const navItems = getNavItems();

  const allMoreLinks = [
    { label: 'Events & Quotes', href: '/events', icon: '📅', desc: 'Banquet bookings & quotations', roles: ['super_admin', 'owner', 'manager', 'accountant'] },
    { label: 'Clients Directory', href: '/clients', icon: '👥', desc: 'Customer profiles & past history', roles: ['super_admin', 'owner', 'manager', 'accountant'] },
    { label: 'Menu & Recipes', href: '/menu', icon: '🍽️', desc: 'Dishes (per guest & per kg)', roles: ['super_admin', 'owner', 'manager'] },
    { label: 'Stock & Inventory', href: '/stock', icon: '📦', desc: 'Pantry ingredients & stock purchases', roles: ['super_admin', 'owner', 'manager'] },
    { label: 'Staff & Salary Management', href: '/staff', icon: '🧑‍🍳', desc: 'Crew wages, paid salary & pending balances', roles: ['super_admin', 'owner', 'manager', 'accountant'] },
    { label: 'Invoices & Receipts', href: '/invoices', icon: '🧾', desc: 'Billing, A4 prints & payments', roles: ['super_admin', 'owner', 'accountant'] },
    {
      label: unreadAuditCount > 0 ? `Activity & Audit (${unreadAuditCount} New)` : 'Activity & Audit Log',
      href: '/activity',
      icon: '🕵️',
      desc: 'Track user login IDs & live database updates',
      roles: ['super_admin', 'owner']
    },
    { label: 'User Roles & Passwords', href: '/users', icon: '🛡️', desc: 'System user accounts & passwords', roles: ['super_admin', 'owner'] },
    { label: 'Business Settings', href: '/settings', icon: '⚙️', desc: 'Bank details & payment terms', roles: ['super_admin', 'owner'] }
  ];

  const visibleMoreLinks = allMoreLinks.filter((l) => l.roles.includes(role));

  return (
    <>
      <nav className="mobile-bottom-nav">
        {navItems.map((item: any) => {
          if (item.isLogout) {
            return (
              <button
                key="logout-btn"
                type="button"
                onClick={handleLogout}
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
                <span className="mobile-nav-icon">{item.icon}</span>
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
              <span className="mobile-nav-icon">{item.icon}</span>
              <span className="mobile-nav-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Drawer (Only for non-staff) */}
      {!isStaff && isMoreOpen && (
        <div className="modal-overlay" onClick={() => setIsMoreOpen(false)}>
          <div className="mobile-bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bottom-sheet-handle" />
            <div className="modal-header" style={{ marginBottom: '1rem', paddingBottom: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                  IPPAS Navigation
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Logged in as: <strong>{currentUser?.full_name}</strong> ({role.toUpperCase()})
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsMoreOpen(false)}>
                ✕
              </button>
            </div>

            {/* Quick Actions in Mobile Drawer */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  setIsChangePasswordOpen(true);
                }}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  fontWeight: 600,
                  background: '#f8fafc',
                  color: 'var(--text-main)'
                }}
              >
                🔑 Change Password
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  fontWeight: 600,
                  color: '#dc2626'
                }}
              >
                🚪 Logout
              </button>
            </div>

            {/* Stock Alerts button if items are low */}
            {lowStockCount > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false);
                    setIsNotifOpen(true);
                  }}
                  className="btn btn-sm"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                    fontWeight: 600,
                    background: '#fff1f2',
                    color: '#e11d48',
                    border: '1px solid #fecaca'
                  }}
                >
                  🔔 Stock Alerts ({lowStockCount} Items Low)
                </button>
              </div>
            )}

            {/* Links list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {visibleMoreLinks.map((link) => (
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

            <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
              <PWAInstallButton variant="banner" showAlways={true} />
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
