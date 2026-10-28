'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { store } from '@/lib/store';
import { UserRole } from '@/lib/types';
import { PWAInstallButton } from './PWAInstallButton';
import StockNotificationModal from './StockNotificationModal';

export default function Navbar() {
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole>('owner');
  const [currentUser, setCurrentUser] = useState(store.getCurrentUser());
  const [lowStockCount, setLowStockCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      const state = store.getState();
      setRole(state.currentRole);
      setCurrentUser(store.getCurrentUser());
      const lowCount = state.ingredients.filter((i) => i.stock_qty <= i.low_stock_level).length;
      setLowStockCount(lowCount);
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
    { label: 'Next Function', href: '/dashboard', roles: ['staff'] },
    { label: 'Dashboard', href: '/dashboard', roles: ['owner', 'manager', 'accountant'] },
    { label: 'Events & Quotes', href: '/events', roles: ['owner', 'manager', 'accountant'] },
    { label: 'Clients', href: '/clients', roles: ['owner', 'manager', 'accountant'] },
    { label: 'Menu & Recipes', href: '/menu', roles: ['owner', 'manager'] },
    { label: 'Stock & Inventory', href: '/stock', roles: ['owner', 'manager'] },
    { label: 'Staff Roster', href: '/staff', roles: ['owner', 'manager'] },
    { label: 'Invoices & Billing', href: '/invoices', roles: ['owner', 'accountant'] },
    { label: 'Users & Passwords', href: '/users', roles: ['owner'] },
    { label: 'Settings', href: '/settings', roles: ['owner'] }
  ];

  const visibleNavItems = allNavItems.filter((item) => item.roles.includes(role));

  const roleColors: Record<UserRole, string> = {
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
              {role.toUpperCase()}
            </span>
            <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>
              {role === 'owner' && '• Full Executive Access'}
              {role === 'manager' && '• Events & Operations Schedule'}
              {role === 'accountant' && '• Financial Billing & Invoicing'}
              {role === 'staff' && '• Next Assigned Event & Venue Details'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Stock Notification Bell with Badge (only for Owner & Manager) */}
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
                title="Stock Alerts & Exhaustion Notifications"
              >
                <span>🔔</span>
                <span>Stock Alert</span>
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
              >
                🔔 {lowStockCount > 0 ? lowStockCount : ''}
              </button>
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
    </>
  );
}
