'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { store } from '@/lib/store';
import { UserRole } from '@/lib/types';
import { PWAInstallButton } from './PWAInstallButton';

export default function Navbar() {
  const pathname = usePathname();
  const [role, setRole] = useState<UserRole>('owner');

  useEffect(() => {
    setRole(store.getState().currentRole);
    const unsubscribe = store.subscribe(() => {
      setRole(store.getState().currentRole);
    });
    return unsubscribe;
  }, []);

  const handleRoleChange = (newRole: UserRole) => {
    store.setRole(newRole);
  };

  const navItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Events', href: '/events' },
    { label: 'Clients', href: '/clients' },
    { label: 'Menu & Recipes', href: '/menu' },
    { label: 'Stock', href: '/stock' },
    { label: 'Staff', href: '/staff' },
    { label: 'Invoices', href: '/invoices' },
    { label: 'Users', href: '/users' },
    { label: 'Settings', href: '/settings' }
  ];

  const roleColors: Record<UserRole, string> = {
    owner: '#e11d48',
    manager: '#2563eb',
    accountant: '#059669',
    chef: '#d97706',
    staff: '#64748b'
  };

  return (
    <header className="top-navbar">
      {/* Desktop Role Switcher Bar */}
      <div className="role-switcher-banner desktop-only">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ opacity: 0.8 }}>Logged in as:</span>
          <span
            className="role-tag-badge"
            style={{
              background: roleColors[role],
              color: '#ffffff'
            }}
          >
            {role.toUpperCase()}
          </span>
          <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>
            {role === 'owner' && '(Full access: financials, quotes, ops, invoices)'}
            {role === 'manager' && '(Ops & events write, invoices read-only)'}
            {role === 'accountant' && '(Invoices & payments write, read-only elsewhere)'}
            {role === 'chef' && '(Kitchen: menu, recipes, stock write, events read-only)'}
            {role === 'staff' && '(Read-only view)'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <PWAInstallButton />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>Role:</span>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              style={{
                background: '#1e293b',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '4px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.75rem',
                cursor: 'pointer'
              }}
            >
              <option value="owner">Owner (Admin)</option>
              <option value="manager">Manager</option>
              <option value="accountant">Accountant</option>
              <option value="chef">Chef</option>
              <option value="staff">Staff (Read-only)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="nav-inner">
        <div className="brand-section">
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <img src="/logo.png" alt="IPPAS Food Service & Events" className="brand-logo-img" style={{ height: '38px', width: 'auto', objectFit: 'contain' }} />
          </Link>
        </div>

        {/* Desktop Nav Links */}
        <nav className="nav-links desktop-only">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
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

        {/* Mobile Top Bar Quick Info */}
        <div className="mobile-only" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            className="role-tag-badge"
            style={{
              background: roleColors[role],
              color: '#ffffff',
              fontSize: '0.65rem'
            }}
          >
            {role.toUpperCase()}
          </span>
          <PWAInstallButton />
        </div>
      </div>
    </header>
  );
}
