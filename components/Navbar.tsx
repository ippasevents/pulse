'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { store } from '@/lib/store';
import { UserRole } from '@/lib/types';
import { PWAInstallButton } from './PWAInstallButton';
import StockNotificationModal from './StockNotificationModal';
import OwnerActivityAlertModal from './OwnerActivityAlertModal';
import ChangePasswordModal from './ChangePasswordModal';

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

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out of your account?')) {
      store.logout();
    }
  };

  // Visible nav items strictly filtered per role
  const allNavItems = [
    { label: 'Duty & Salary', href: '/dashboard', roles: ['staff'] },
    { label: 'Dashboard', href: '/dashboard', roles: ['super_admin', 'owner', 'manager', 'accountant'] },
    { label: 'Events & Quotes', href: '/events', roles: ['super_admin', 'owner', 'manager', 'accountant'] },
    { label: 'Clients', href: '/clients', roles: ['super_admin', 'owner', 'manager', 'accountant'] },
    { label: 'Menu & Recipes', href: '/menu', roles: ['super_admin', 'owner', 'manager'] },
    { label: 'Stock & Inventory', href: '/stock', roles: ['super_admin', 'owner', 'manager'] },
    { label: 'Staff & Salary', href: '/staff', roles: ['super_admin', 'owner', 'manager', 'accountant'] },
    { label: 'Invoices & Billing', href: '/invoices', roles: ['super_admin', 'owner', 'accountant'] },
    { label: 'Profit & Loss', href: '/pnl', roles: ['super_admin', 'owner'] },
    { label: 'Notifications', href: '/activity', roles: ['super_admin', 'owner'] },
    { label: 'Users & Passwords', href: '/users', roles: ['super_admin', 'owner'] },
    { label: 'Settings', href: '/settings', roles: ['super_admin', 'owner'] }
  ];

  const visibleNavItems = allNavItems.filter((item) => item.roles.includes(role));

  const roleColors: Record<UserRole, string> = {
    super_admin: '#4f46e5',
    owner: '#e11d48',
    manager: '#2563eb',
    accountant: '#059669',
    staff: '#7c3aed'
  };

  const isStaff = role === 'staff';

  return (
    <>
      <header className="top-navbar">
        {/* Desktop Top Status Banner */}
        <div className="role-switcher-banner desktop-only">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ opacity: 0.8 }}>Logged in as:</span>
            <strong>{currentUser?.full_name || 'User'}</strong>
            <span
              className="role-tag-badge"
              style={{
                background: roleColors[role] || '#e11d48',
                color: '#ffffff'
              }}
            >
              {role.toUpperCase().replace('_', ' ')}
            </span>

            {/* Live Supabase Database Status Indicator */}
            <Link
              href="/settings"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#064e3b',
                color: '#6ee7b7',
                border: '1px solid #059669',
                borderRadius: '9999px',
                padding: '0.12rem 0.55rem',
                fontSize: '0.7rem',
                fontWeight: 700,
                textDecoration: 'none',
                letterSpacing: '0.02em'
              }}
              title="Live connected to online Supabase PostgreSQL database."
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 6px #10b981'
                }}
              />
              <span>LIVE SUPABASE</span>
            </Link>

            <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>
              {role === 'super_admin' && '• Master System Control (Stealth Admin)'}
              {role === 'owner' && '• Full Executive Access'}
              {role === 'manager' && '• Events & Operations Schedule'}
              {role === 'accountant' && '• Financial Billing & Invoicing'}
              {role === 'staff' && '• Duty Schedule & Salary Balance'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Calm Activity Notifications for Owner and Super Admin */}
            {(role === 'owner' || role === 'super_admin') && (
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(true)}
                style={{
                  background: unreadAuditCount > 0 ? '#1d4ed8' : '#1e293b',
                  color: '#ffffff',
                  border: unreadAuditCount > 0 ? '1px solid #93c5fd' : '1px solid #475569',
                  borderRadius: '6px',
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease'
                }}
                title="View recent edits & activity notifications"
              >
                <span>🔔</span>
                <span>Notifications</span>
                {unreadAuditCount > 0 && (
                  <span
                    style={{
                      background: '#ffffff',
                      color: '#1d4ed8',
                      padding: '0.08rem 0.42rem',
                      borderRadius: '10px',
                      fontSize: '0.73rem',
                      fontWeight: 800
                    }}
                  >
                    {unreadAuditCount}
                  </span>
                )}
              </button>
            )}

            {/* Stock Low Notification Button (only for non-staff) */}
            {!isStaff && (
              <button
                type="button"
                onClick={() => setIsNotifOpen(true)}
                style={{
                  background: lowStockCount > 0 ? '#b91c1c' : '#334155',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease'
                }}
                title="Low Stock Notifications"
              >
                <span>📦</span>
                <span>Low Stock</span>
                {lowStockCount > 0 && (
                  <span
                    style={{
                      background: '#fef2f2',
                      color: '#dc2626',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: 800
                    }}
                  >
                    {lowStockCount}
                  </span>
                )}
              </button>
            )}

            {/* Change Password for ANY user */}
            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              style={{
                background: '#334155',
                color: '#ffffff',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '0.25rem 0.65rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
              title="Change your login password"
            >
              🔑 Password
            </button>

            <PWAInstallButton />

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: '#475569',
                color: '#ffffff',
                border: '1px solid #64748b',
                borderRadius: '6px',
                padding: '0.25rem 0.65rem',
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
              title="Sign out of your account"
            >
              🚪 Logout
            </button>
          </div>
        </div>

        <div className="nav-inner">
          <div className="brand-section">
            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <img
                src="/logo.png"
                alt="IPPAS Food Service & Events"
                className="brand-logo-img"
                style={{ height: '38px', width: 'auto', objectFit: 'contain' }}
              />
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <nav className="nav-links desktop-only">
            {visibleNavItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === '/dashboard' && pathname === '/') ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Top Bar */}
          <div className="mobile-only" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {(role === 'owner' || role === 'super_admin') && (
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(true)}
                style={{
                  background: unreadAuditCount > 0 ? '#eff6ff' : '#f1f5f9',
                  color: unreadAuditCount > 0 ? '#1d4ed8' : '#334155',
                  border: `1px solid ${unreadAuditCount > 0 ? '#93c5fd' : 'var(--border)'}`,
                  borderRadius: '6px',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontWeight: 700
                }}
                title="Notifications & Edit History"
              >
                🔔 {unreadAuditCount > 0 ? unreadAuditCount : ''}
              </button>
            )}

            {!isStaff && (
              <button
                type="button"
                onClick={() => setIsNotifOpen(true)}
                style={{
                  background: lowStockCount > 0 ? '#fee2e2' : '#f1f5f9',
                  color: lowStockCount > 0 ? '#dc2626' : '#475569',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontWeight: 700
                }}
                title="Low Stock Items"
              >
                📦 {lowStockCount > 0 ? lowStockCount : ''}
              </button>
            )}

            {isDbConnected && (
              <Link
                href="/settings"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  background: '#064e3b',
                  color: '#6ee7b7',
                  border: '1px solid #059669',
                  borderRadius: '9999px',
                  padding: '0.12rem 0.4rem',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  textDecoration: 'none'
                }}
                title="Live Supabase Database Connected"
              >
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981' }} />
                <span>LIVE</span>
              </Link>
            )}

            <span
              className="role-tag-badge"
              style={{
                background: roleColors[role] || '#e11d48',
                color: '#ffffff',
                fontSize: '0.65rem'
              }}
            >
              {role.toUpperCase()}
            </span>

            {/* Mobile Change Password */}
            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
              title="Change Password"
            >
              🔑
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
              title="Logout"
            >
              🚪
            </button>

            <PWAInstallButton />
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
