'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { store } from '@/lib/store';
import { UserRole } from '@/lib/types';
import Navbar from '@/components/Navbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import DashboardPage from '@/app/dashboard/page';

function isRouteAllowed(role: UserRole, pathname: string): boolean {
  if (role === 'super_admin' || role === 'owner') return true;
  if (role === 'staff') {
    return pathname === '/' || pathname === '/dashboard';
  }
  if (role === 'manager') {
    return (
      pathname === '/' ||
      pathname === '/dashboard' ||
      pathname.startsWith('/events') ||
      pathname.startsWith('/clients') ||
      pathname.startsWith('/menu') ||
      pathname.startsWith('/stock') ||
      pathname.startsWith('/staff')
    );
  }
  if (role === 'accountant') {
    return (
      pathname === '/' ||
      pathname === '/dashboard' ||
      pathname.startsWith('/events') ||
      pathname.startsWith('/clients') ||
      pathname.startsWith('/invoices') ||
      pathname.startsWith('/staff')
    );
  }
  return false;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState<UserRole>('owner');
  const [isMounted, setIsMounted] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const s = store.getState();
    setIsAuthenticated(s.isAuthenticated);
    setRole(s.currentRole);

    const unsub = store.subscribe(() => {
      const next = store.getState();
      setIsAuthenticated(next.isAuthenticated);
      setRole(next.currentRole);
    });
    return unsub;
  }, []);

  const allowed = isRouteAllowed(role, pathname);

  useEffect(() => {
    if (isMounted && isAuthenticated) {
      store.refreshOnNavigation();
    }
  }, [isMounted, isAuthenticated, pathname]);

  useEffect(() => {
    if (isMounted && isAuthenticated && !allowed) {
      router.replace('/dashboard');
    }
  }, [isMounted, isAuthenticated, allowed, router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      const result = store.login(username.trim(), password);
      setIsLoading(false);
      if (!result.success) {
        setError(result.error || 'Invalid credentials');
      }
    }, 200);
  };

  if (!isMounted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="/logo.png" alt="IPPAS Pulse" style={{ height: '50px', marginBottom: '1rem', objectFit: 'contain' }} />
          <div style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading IPPAS Pulse...</div>
        </div>
      </div>
    );
  }

  // If not authenticated, render strict and minimal Login Screen with ONLY Username & Password inputs
  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          color: '#f8fafc'
        }}
      >
        <div
          style={{
            maxWidth: '400px',
            width: '100%',
            background: '#ffffff',
            color: '#0f172a',
            borderRadius: '16px',
            padding: '2.25rem 2rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <img
              src="/logo.png"
              alt="IPPAS Food Service & Events"
              style={{ height: '48px', width: 'auto', margin: '0 auto 0.75rem auto', display: 'block' }}
            />
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              IPPAS Pulse
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.35rem' }}>
              Sign in to your account
            </p>
          </div>

          {error && (
            <div
              style={{
                background: '#fee2e2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '1.25rem',
                fontWeight: 500,
                textAlign: 'center'
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group" style={{ marginBottom: '1.15rem' }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                Username or Phone Number
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Username or Staff Phone"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                style={{ padding: '0.7rem 0.85rem', fontSize: '0.95rem' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                Password
              </label>
              <input
                type="password"
                className="form-control"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ padding: '0.7rem 0.85rem', fontSize: '0.95rem' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '8px'
              }}
            >
              {isLoading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated: Render full application with strict role route enforcement
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">{allowed ? children : <DashboardPage />}</main>
      <MobileBottomNav />
    </div>
  );
}
