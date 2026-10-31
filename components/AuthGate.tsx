'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { store } from '@/lib/store';
import { UserRole } from '@/lib/types';
import Navbar from '@/components/Navbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import DashboardPage from '@/app/dashboard/page';

function isRouteAllowed(role: UserRole, pathname: string): boolean {
  if (pathname.startsWith('/manuals')) return true;
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
      pathname.startsWith('/staff') ||
      pathname.startsWith('/stock')
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
  const [isOnline, setIsOnline] = useState(true);
  const [isDbReady, setIsDbReady] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loginSuccessMsg, setLoginSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Staff Forgot Password Self-Service Reset State
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetPhone, setResetPhone] = useState('');
  const [resetName, setResetName] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetConfirmPass, setResetConfirmPass] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const syncConnectionAndAuth = () => {
      const browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      const storeOnline = store.isOnline();
      setIsOnline(browserOnline && storeOnline);
      setIsDbReady(store.isInitialSyncDone());

      const s = store.getState();
      setIsAuthenticated(s.isAuthenticated);
      setRole(s.currentRole);
    };

    syncConnectionAndAuth();

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleOnline = async () => {
      setIsRetrying(true);
      await store.autoConnectSupabaseWhenOnline();
      setIsRetrying(false);
      syncConnectionAndAuth();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    const unsub = store.subscribe(syncConnectionAndAuth);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      unsub();
    };
  }, []);

  const allowed = isRouteAllowed(role, pathname);

  useEffect(() => {
    if (isMounted && isOnline && isDbReady && isAuthenticated) {
      store.refreshOnNavigation();
    }
  }, [isMounted, isOnline, isDbReady, isAuthenticated, pathname]);

  useEffect(() => {
    if (isMounted && isOnline && isDbReady && isAuthenticated && !allowed) {
      router.replace('/dashboard');
    }
  }, [isMounted, isOnline, isDbReady, isAuthenticated, allowed, router]);

  const handleRetryConnection = async () => {
    setIsRetrying(true);
    await store.autoConnectSupabaseWhenOnline();
    setIsOnline((typeof navigator === 'undefined' ? true : navigator.onLine) && store.isOnline());
    setIsDbReady(store.isInitialSyncDone());
    setIsRetrying(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return;
    }

    setError('');
    setLoginSuccessMsg('');
    setIsLoading(true);

    await store.syncFromSupabase(true);
    if (!store.isOnline()) {
      setIsLoading(false);
      setIsOnline(false);
      return;
    }

    const result = store.login(username.trim(), password);
    setIsLoading(false);
    if (!result.success) {
      setError(result.error || 'Invalid credentials');
    }
  };

  const handleStaffResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return;
    }

    setResetError('');
    if (resetNewPass.trim().length < 4) {
      setResetError('New password must be at least 4 characters long.');
      return;
    }
    if (resetNewPass.trim() !== resetConfirmPass.trim()) {
      setResetError('New password and confirm password do not match.');
      return;
    }

    setIsResetting(true);
    await store.syncFromSupabase(true);
    if (!store.isOnline()) {
      setIsResetting(false);
      setIsOnline(false);
      return;
    }

    const res = store.resetStaffPasswordSelfService(
      resetPhone,
      resetName,
      resetNewPass.trim()
    );
    setIsResetting(false);

    if (!res.success) {
      setResetError(res.error || 'Could not reset password.');
      return;
    }

    // Pre-fill login form and return to Sign In with confirmation message
    setUsername(res.loginPhone || resetPhone.trim());
    setPassword(resetNewPass.trim());
    setIsResetMode(false);
    setError('');
    setLoginSuccessMsg(
      `✓ Password reset for ${res.staffName || 'Staff'}! Tap Sign In below to continue.`
    );
    setResetPhone('');
    setResetName('');
    setResetNewPass('');
    setResetConfirmPass('');
  };

  // STRICT OFFLINE / DISCONNECTED GATE
  if (isMounted && !isOnline) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#0f172a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          color: '#f8fafc',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            maxWidth: '420px',
            width: '100%',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '2.5rem 2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
              fontSize: '1.75rem'
            }}
          >
            📡
          </div>
          <h1
            style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              color: '#ffffff',
              margin: '0 0 0.65rem 0',
              letterSpacing: '-0.02em'
            }}
          >
            Internet Disconnected
          </h1>
          <p
            style={{
              fontSize: '0.9rem',
              color: '#94a3b8',
              lineHeight: 1.6,
              margin: '0 0 1.5rem 0'
            }}
          >
            No active internet connection to Supabase database. Please reconnect to the internet to continue — offline viewing is disabled.
          </p>
          <button
            type="button"
            onClick={handleRetryConnection}
            disabled={isRetrying}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              fontSize: '0.92rem',
              fontWeight: 700,
              borderRadius: '8px'
            }}
          >
            {isRetrying ? 'Reconnecting to Supabase...' : 'Retry Connection'}
          </button>
        </div>
      </div>
    );
  }

  // Wait for live Supabase connection & initial data sync before rendering any page
  if (!isMounted || !isDbReady) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <img
            src="/logo.png"
            alt="IPPAS Pulse"
            referrerPolicy="no-referrer"
            style={{ height: '50px', marginBottom: '1rem', objectFit: 'contain' }}
          />
          <div style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.95rem' }}>
            Connecting Pulse
          </div>
          <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.3rem' }}>
            Syncing real-time online records
          </div>
        </div>
      </div>
    );
  }

  // Login Screen (with Staff Forgot Password Self-Service Reset)
  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(at 15% 15%, rgba(225, 29, 72, 0.32) 0px, transparent 50%), radial-gradient(at 85% 20%, rgba(79, 70, 229, 0.35) 0px, transparent 52%), radial-gradient(at 50% 90%, rgba(16, 185, 129, 0.24) 0px, transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          color: '#f8fafc'
        }}
      >
        <div
          style={{
            maxWidth: '420px',
            width: '100%',
            background: '#ffffff',
            color: '#0f172a',
            borderRadius: '18px',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)'
          }}
        >
          <div
            style={{
              height: '5px',
              width: '100%',
              background: 'linear-gradient(90deg, #e11d48 0%, #7c3aed 50%, #10b981 100%)'
            }}
          />
          <div style={{ padding: '2rem 2rem 2.15rem 2rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <img
                src="/logo.png"
                alt="IPPAS Food Service & Events"
                referrerPolicy="no-referrer"
                style={{ height: '50px', width: 'auto', margin: '0 auto 0.75rem auto', display: 'block' }}
              />
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                IPPAS Pulse
              </h1>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.3rem', fontWeight: 500 }}>
                Outdoor Catering • Event Management • Calicut
              </p>
            </div>

            {isResetMode ? (
              <div>
                <div
                  style={{
                    background: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    borderRadius: '10px',
                    padding: '0.75rem 0.9rem',
                    marginBottom: '1rem'
                  }}
                >
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#5b21b6' }}>
                    🔑 Staff Password Reset
                  </div>
                  <div style={{ fontSize: '0.76rem', color: '#6d28d9', marginTop: '0.2rem', lineHeight: 1.4 }}>
                    Enter your registered mobile number and full name to set a new login password.
                  </div>
                </div>

                {resetError && (
                  <div
                    style={{
                      background: '#fee2e2',
                      border: '1px solid #fecaca',
                      color: '#dc2626',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      marginBottom: '1rem',
                      fontWeight: 600
                    }}
                  >
                    {resetError}
                  </div>
                )}

                <form onSubmit={handleStaffResetPassword}>
                  <div className="form-group" style={{ marginBottom: '0.9rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                      Registered Staff Mobile Number *
                    </label>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="e.g. 9745111001"
                      value={resetPhone}
                      onChange={(e) => setResetPhone(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.9rem' }}>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                      Full Name (as registered) *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Shyam Kumar"
                      value={resetName}
                      onChange={(e) => setResetName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid-2" style={{ gap: '0.65rem', marginBottom: '1.15rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                        New Password *
                      </label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="Min 4 chars"
                        value={resetNewPass}
                        onChange={(e) => setResetNewPass(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="Re-enter"
                        value={resetConfirmPass}
                        onChange={(e) => setResetConfirmPass(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isResetting}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      background: '#7c3aed',
                      borderColor: '#7c3aed'
                    }}
                  >
                    {isResetting ? 'Resetting Password...' : 'Save New Password'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(false);
                      setResetError('');
                    }}
                    className="btn btn-secondary"
                    style={{
                      width: '100%',
                      marginTop: '0.55rem',
                      padding: '0.65rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: '8px'
                    }}
                  >
                    ← Back to Sign In
                  </button>
                </form>
              </div>
            ) : (
              <>
                {loginSuccessMsg && (
                  <div
                    style={{
                      background: '#dcfce7',
                      border: '1px solid #86efac',
                      color: '#166534',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.83rem',
                      marginBottom: '1rem',
                      fontWeight: 600,
                      textAlign: 'center'
                    }}
                  >
                    {loginSuccessMsg}
                  </div>
                )}

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

                  <div className="form-group" style={{ marginBottom: '0.6rem' }}>
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

                  <div style={{ textAlign: 'right', marginBottom: '1.2rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setResetPhone(username);
                        setResetError('');
                        setIsResetMode(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: '#7c3aed',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Forgot Staff Password?
                    </button>
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

                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                  <PWAInstallButton variant="login" />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Authenticated & Online: Render full application with strict role route enforcement
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">{allowed ? children : <DashboardPage />}</main>
      <MobileBottomNav />
    </div>
  );
}
