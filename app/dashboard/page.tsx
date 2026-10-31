'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { store } from '@/lib/store';
import { UserRole } from '@/lib/types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import InvoiceCollectionsCard from '@/components/InvoiceCollectionsCard';
import PWAInstallBanner from '@/components/PWAInstallBanner';
import ChangePasswordModal from '@/components/ChangePasswordModal';

export default function DashboardPage() {
  const [state, setState] = useState(store.getState());
  const [isMounted, setIsMounted] = useState(false);
  const [managerSearch, setManagerSearch] = useState('');
  const [accountantSearch, setAccountantSearch] = useState('');
  const [ownerChartRange, setOwnerChartRange] = useState<'all' | '6m'>('all');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [staffSectionTab, setStaffSectionTab] = useState<'all' | 'upcoming' | 'attended' | 'payments'>('all');

  useEffect(() => {
    setIsMounted(true);
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role: UserRole = state.currentRole;
  const currentUser = store.getCurrentUser();

  // Calculations for Financials (Owner & Accountant)
  let totalSales = 0;
  state.events.forEach((evt) => {
    if (evt.status !== 'cancelled') {
      const { grandTotal } = store.getEventTotal(evt.id);
      totalSales += grandTotal;
    }
  });

  const totalInvoiced = state.invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalPaid = state.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalPending = Math.max(0, totalInvoiced - totalPaid);

  const totalStockPurchases = (state.stockPurchases || []).reduce((sum, sp) => sum + sp.total_amount, 0);
  const totalVendorPaid = (state.stockPurchases || []).reduce((sum, sp) => sum + sp.paid_amount, 0);
  const totalVendorDues = (state.stockPurchases || []).reduce((sum, sp) => sum + sp.balance_amount, 0);

  const totalStaffSalaryPaid = state.staff.reduce(
    (sum, st) => sum + store.getStaffSalarySummary(st.id).totalPaid,
    0
  );
  const totalStaffSalaryPayable = state.staff.reduce(
    (sum, st) => sum + store.getStaffSalarySummary(st.id).balancePayable,
    0
  );

  // Monthly breakdown for recharts
  const monthlySales: Record<string, { total: number; count: number }> = {};
  state.events.forEach((evt) => {
    if (evt.status !== 'cancelled') {
      const monthKey = evt.event_date.slice(0, 7); // YYYY-MM
      const { grandTotal } = store.getEventTotal(evt.id);
      if (!monthlySales[monthKey]) {
        monthlySales[monthKey] = { total: 0, count: 0 };
      }
      monthlySales[monthKey].total += grandTotal;
      monthlySales[monthKey].count += 1;
    }
  });

  const chartData = Object.entries(monthlySales)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, data]) => {
      const [year, month] = monthKey.split('-');
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
      const monthLabel = !isNaN(date.getTime())
        ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : monthKey;
      return {
        monthKey,
        month: monthLabel,
        sales: data.total,
        count: data.count
      };
    });

  // Events classifications
  const activeEvents = state.events.filter((e) => e.status === 'confirmed');
  const upcomingEvents = [...state.events]
    .filter((e) => e.status !== 'completed' && e.status !== 'cancelled')
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  const totalUpcomingPax = upcomingEvents.reduce((sum, e) => sum + (e.guest_count || 0), 0);
  const lowStockItems = state.ingredients.filter((i) => i.stock_qty <= i.low_stock_level);

  // -------------------------------------------------------------------------------------
  // 0. STAFF VIEW (Next Catering Function, Venue & Personal Salary Balance / Payments)
  // -------------------------------------------------------------------------------------
  if (role === 'staff') {
    const staffRecord = state.staff.find((s) => s.id === currentUser?.id);
    const salarySummary = currentUser
      ? store.getStaffSalarySummary(currentUser.id)
      : {
          staffId: '',
          shiftItems: [],
          attendedShiftsCount: 0,
          absentShiftsCount: 0,
          pendingShiftsCount: 0,
          totalShiftHours: 0,
          shiftEarnings: 0,
          extraEarnings: 0,
          totalEarned: 0,
          totalPaid: 0,
          balancePayable: 0,
          advanceExcess: 0,
          paymentRecords: [],
          earningRecords: []
        };

    const nowDate = new Date();
    const todayYmd = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(
      nowDate.getDate()
    ).padStart(2, '0')}`;

    const upcomingDuties = salarySummary.shiftItems
      .filter((si) => {
        if (!si.event || si.event.status === 'cancelled') return false;
        if (si.event.status === 'completed') return false;
        if (si.attendanceStatus === 'present' || si.attendanceStatus === 'absent') return false;
        return si.event.event_date >= todayYmd || si.event.status === 'confirmed' || si.event.status === 'inquiry';
      })
      .sort((a, b) => (a.event?.event_date || '').localeCompare(b.event?.event_date || ''));

    const attendedDuties = salarySummary.shiftItems
      .filter((si) => {
        if (!si.event || si.event.status === 'cancelled') return false;
        if (si.isAttended) return true;
        return (
          (si.event.status === 'completed' || si.event.event_date < todayYmd) &&
          si.attendanceStatus !== 'absent' &&
          !upcomingDuties.some((u) => u.shift.id === si.shift.id)
        );
      })
      .sort((a, b) => (b.event?.event_date || '').localeCompare(a.event?.event_date || ''));

    const nextAssignment = upcomingDuties[0];
    const otherUpcoming = upcomingDuties.slice(1);

    const showUpcomingSection = staffSectionTab === 'all' || staffSectionTab === 'upcoming';
    const showAttendedSection = staffSectionTab === 'all' || staffSectionTab === 'attended';
    const showPaymentsSection = staffSectionTab === 'all' || staffSectionTab === 'payments';

    return (
      <div style={{ maxWidth: '940px', margin: '0 auto', paddingBottom: '2.5rem' }}>
        {/* Clean Simplified Staff Header */}
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #9333ea 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '14px',
            padding: '1.35rem 1.5rem',
            marginBottom: '1.25rem',
            boxShadow: '0 10px 25px -8px rgba(79, 70, 229, 0.35)'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.85rem'
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, opacity: 0.9, marginBottom: '0.2rem' }}>
                Staff Duty &amp; Salary Portal · {currentUser?.phone || 'Crew'}
                {staffRecord?.hourly_rate ? ` · ₹${staffRecord.hourly_rate}/hr` : ''}
              </div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#ffffff' }}>
                👋 {currentUser?.full_name || 'Staff Member'}
              </h1>
              <div style={{ fontSize: '0.84rem', opacity: 0.92, marginTop: '0.2rem' }}>
                വരാനിരിക്കുന്ന പരിപാടികളും ഇതുവരെ പങ്കെടുത്ത പരിപാടികളും ശമ്പള വിവരങ്ങളും ഒറ്റനോട്ടത്തിൽ
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link
                href="/manuals"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: '#ffffff',
                  color: '#4f46e5',
                  padding: '0.48rem 0.85rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                📘 മലയാളം മാനുവൽ (PDF)
              </Link>
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(255,255,255,0.18)',
                  border: '1px solid rgba(255,255,255,0.35)',
                  color: '#ffffff',
                  padding: '0.48rem 0.85rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                🔑 Change Password
              </button>
            </div>
          </div>
        </div>

        <PWAInstallBanner />

        {/* 3 Simplified Colourful Salary KPI Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))',
            gap: '0.9rem',
            marginBottom: '1.25rem'
          }}
        >
          <div
            className="stats-card"
            style={{
              borderTop: '3px solid #2563eb',
              background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 70%)'
            }}
          >
            <span className="stats-label" style={{ color: '#1d4ed8' }}>
              Total Salary Earned
            </span>
            <span className="stats-value" style={{ color: '#1d4ed8', fontVariantNumeric: 'tabular-nums' }}>
              ₹{salarySummary.totalEarned.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {salarySummary.attendedShiftsCount} attended ({salarySummary.totalShiftHours} hrs)
              {salarySummary.extraEarnings > 0
                ? ` · +₹${salarySummary.extraEarnings.toLocaleString('en-IN')} allowance`
                : ''}
            </span>
          </div>

          <div
            className="stats-card"
            style={{
              borderTop: '3px solid #059669',
              background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 70%)'
            }}
          >
            <span className="stats-label" style={{ color: '#047857' }}>
              Salary Received
            </span>
            <span className="stats-value" style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
              ₹{salarySummary.totalPaid.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {salarySummary.paymentRecords.length} payment{salarySummary.paymentRecords.length === 1 ? '' : 's'} received
            </span>
          </div>

          <div
            className="stats-card"
            style={{
              borderTop: `3px solid ${salarySummary.balancePayable > 0 ? '#e11d48' : '#059669'}`,
              background:
                salarySummary.balancePayable > 0
                  ? 'linear-gradient(180deg, #fff1f2 0%, #ffffff 70%)'
                  : 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 70%)'
            }}
          >
            <span
              className="stats-label"
              style={{ color: salarySummary.balancePayable > 0 ? '#be123c' : '#047857' }}
            >
              Pending Balance Payable
            </span>
            <span
              className="stats-value"
              style={{
                color: salarySummary.balancePayable > 0 ? '#dc2626' : '#059669',
                fontVariantNumeric: 'tabular-nums'
              }}
            >
              ₹{salarySummary.balancePayable.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {salarySummary.balancePayable > 0
                ? 'Remaining salary payable to you'
                : salarySummary.advanceExcess > 0
                ? `Advance excess: ₹${salarySummary.advanceExcess.toLocaleString('en-IN')}`
                : 'All earned salary settled'}
            </span>
          </div>
        </div>

        {/* Clean Segmented Filter Bar */}
        <div
          style={{
            display: 'flex',
            gap: '0.4rem',
            padding: '0.35rem',
            background: '#f1f5f9',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            overflowX: 'auto'
          }}
        >
          {[
            { id: 'all' as const, label: 'All Overview' },
            { id: 'upcoming' as const, label: `📅 Upcoming Events (${upcomingDuties.length})` },
            { id: 'attended' as const, label: `✅ Attended Events (${attendedDuties.length})` },
            { id: 'payments' as const, label: `💸 Salary Received (${salarySummary.paymentRecords.length})` }
          ].map((tab) => {
            const active = staffSectionTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStaffSectionTab(tab.id)}
                style={{
                  padding: '0.5rem 0.9rem',
                  borderRadius: '7px',
                  border: 'none',
                  background: active ? '#ffffff' : 'transparent',
                  color: active ? '#0f172a' : '#475569',
                  fontWeight: active ? 700 : 600,
                  fontSize: '0.82rem',
                  boxShadow: active ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* SECTION 1: UPCOMING EVENTS (വരാനിരിക്കുന്ന പരിപാടികൾ) */}
        {showUpcomingSection && (
          <div
            className="card"
            style={{
              borderTop: '3px solid #7c3aed',
              marginBottom: '1.25rem',
              padding: '1.25rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginBottom: '0.9rem'
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  📅 വരാനിരിക്കുന്ന പരിപാടികൾ · Upcoming Events ({upcomingDuties.length})
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                  Your scheduled catering duties, reporting timings, and venue locations
                </p>
              </div>
            </div>

            {nextAssignment ? (
              <div>
                <div
                  style={{
                    background: 'linear-gradient(135deg, #faf5ff 0%, #eef2ff 100%)',
                    border: '1px solid #ddd6fe',
                    borderRadius: '10px',
                    padding: '1.1rem 1.2rem',
                    marginBottom: otherUpcoming.length > 0 ? '1rem' : 0
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                      marginBottom: '0.45rem'
                    }}
                  >
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#6d28d9' }}>
                      Next Scheduled Duty ·{' '}
                      {new Date(nextAssignment.event!.event_date).toLocaleDateString('en-GB', {
                        weekday: 'short',
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#4338ca' }}>
                      {nextAssignment.shift.role_label || currentUser?.role_title || 'Service Crew'}
                    </span>
                  </div>

                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.35rem' }}>
                    {nextAssignment.event?.title}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.85rem',
                      fontSize: '0.84rem',
                      color: '#334155',
                      marginBottom: '0.75rem',
                      fontVariantNumeric: 'tabular-nums'
                    }}
                  >
                    <span>📍 {nextAssignment.event?.venue || 'Venue TBD'}</span>
                    <span>·</span>
                    <span>
                      ⏰{' '}
                      {nextAssignment.shift.starts_at
                        ? nextAssignment.shift.starts_at.slice(11, 16)
                        : nextAssignment.event?.start_time || 'On Call'}
                      {nextAssignment.shift.ends_at ? ` – ${nextAssignment.shift.ends_at.slice(11, 16)}` : ''}
                    </span>
                    <span>·</span>
                    <span>👥 {nextAssignment.event?.guest_count || 0} Pax</span>
                  </div>

                  {nextAssignment.shift.duty_note && (
                    <div
                      style={{
                        fontSize: '0.8rem',
                        color: '#475569',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '7px',
                        padding: '0.5rem 0.75rem',
                        marginBottom: '0.75rem'
                      }}
                    >
                      <strong>Duty Note:</strong> {nextAssignment.shift.duty_note}
                    </div>
                  )}

                  {nextAssignment.event?.venue && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        nextAssignment.event.venue
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        background: '#6d28d9',
                        borderColor: '#6d28d9',
                        fontWeight: 700,
                        whiteSpace: 'nowrap'
                      }}
                    >
                      🗺️ Open Venue in Google Maps
                    </a>
                  )}
                </div>

                {otherUpcoming.length > 0 && (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date &amp; Time</th>
                          <th>Event &amp; Venue</th>
                          <th>Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {otherUpcoming.map((item) => (
                          <tr key={item.shift.id}>
                            <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>
                                {new Date(item.event!.event_date).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {(item.shift.starts_at || '').slice(11, 16) || item.event?.start_time || '—'}
                                {item.shift.ends_at ? ` – ${item.shift.ends_at.slice(11, 16)}` : ''}
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.event?.title}</div>
                              <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                                📍 {item.event?.venue || 'Venue TBD'}
                              </div>
                            </td>
                            <td style={{ fontWeight: 600, color: '#6d28d9', fontSize: '0.82rem' }}>
                              {item.shift.role_label || currentUser?.role_title || 'Service Crew'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: '1.35rem',
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  fontSize: '0.86rem'
                }}
              >
                നിലവിൽ പുതിയ വരാനിരിക്കുന്ന പരിപാടികൾ ഒന്നും അസൈൻ ചെയ്തിട്ടില്ല · No upcoming events assigned right now.
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: EVENTS ATTENDED SO FAR (ഇതുവരെ പങ്കെടുത്ത പരിപാടികൾ) */}
        {showAttendedSection && (
          <div
            className="card"
            style={{
              borderTop: '3px solid #059669',
              marginBottom: '1.25rem',
              padding: '1.25rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
                marginBottom: '0.9rem'
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  ✅ ഇതുവരെ പങ്കെടുത്ത പരിപാടികൾ · Events Attended So Far ({attendedDuties.length})
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                  Completed catering functions, hours worked, bonuses, and wages earned
                </p>
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#047857', fontVariantNumeric: 'tabular-nums' }}>
                Total Worked: {salarySummary.totalShiftHours} hrs
              </div>
            </div>

            {attendedDuties.length === 0 && salarySummary.earningRecords.length === 0 ? (
              <div
                style={{
                  padding: '1.35rem',
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  fontSize: '0.86rem'
                }}
              >
                ഇതുവരെ പൂർത്തിയായ ഡ്യൂട്ടികൾ രേഖപ്പെടുത്തിയിട്ടില്ല · No attended past events recorded yet.
              </div>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Event &amp; Venue</th>
                      <th>Role &amp; Hours</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Earned (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendedDuties.map((si) => (
                      <tr key={si.shift.id}>
                        <td style={{ fontSize: '0.82rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {si.event?.event_date
                            ? new Date(si.event.event_date).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })
                            : '—'}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.86rem' }}>
                            {si.event?.title || 'Event Shift'}
                          </div>
                          {si.event?.venue && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>📍 {si.event.venue}</div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.82rem', fontVariantNumeric: 'tabular-nums' }}>
                          <div style={{ fontWeight: 600 }}>{si.shift.role_label || currentUser?.role_title || 'Crew'}</div>
                          <div style={{ fontSize: '0.74rem', color: '#64748b' }}>{si.hours} hrs</div>
                        </td>
                        <td style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                          {si.isAttended ? (
                            <span style={{ color: '#059669' }}>✓ Attended</span>
                          ) : (
                            <span style={{ color: '#b45309' }}>⏳ Attendance Pending</span>
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            color: si.isAttended ? '#059669' : '#64748b'
                          }}
                        >
                          {si.isAttended ? `₹${si.earnedAmount.toLocaleString('en-IN')}` : '—'}
                        </td>
                      </tr>
                    ))}
                    {salarySummary.earningRecords.map((er) => (
                      <tr key={er.id}>
                        <td style={{ fontSize: '0.82rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {new Date(er.recorded_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#1d4ed8', fontSize: '0.86rem' }}>{er.method}</div>
                          {er.note && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{er.note}</div>}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>Allowance / Bonus</td>
                        <td style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1d4ed8' }}>+ Bonus</td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#1d4ed8',
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          ₹{er.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SECTION 3: SALARY PAYMENTS RECEIVED (ലഭിച്ച ശമ്പള വിവരങ്ങൾ) */}
        {showPaymentsSection && (
          <div
            className="card"
            style={{
              borderTop: '3px solid #2563eb',
              padding: '1.25rem'
            }}
          >
            <h2 style={{ fontSize: '1.08rem', fontWeight: 800, margin: '0 0 0.85rem 0', color: '#0f172a' }}>
              💸 ലഭിച്ച ശമ്പള വിവരങ്ങൾ · Salary Payments Received ({salarySummary.paymentRecords.length})
            </h2>
            {salarySummary.paymentRecords.length === 0 ? (
              <div
                style={{
                  padding: '1.25rem',
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  color: '#64748b',
                  fontSize: '0.86rem'
                }}
              >
                No salary payouts recorded yet.
              </div>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Payment Method &amp; Note</th>
                      <th style={{ textAlign: 'right' }}>Amount Received (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salarySummary.paymentRecords.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontSize: '0.82rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {new Date(p.recorded_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td style={{ fontSize: '0.84rem' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.method}</div>
                          {p.note && <div style={{ color: '#64748b', fontSize: '0.75rem' }}>{p.note}</div>}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            color: '#059669',
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          ₹{p.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
        />
      </div>
    );
  }

  // -------------------------------------------------------------------------------------
  // 1. MANAGER VIEW
  // -------------------------------------------------------------------------------------
  if (role === 'manager') {
    const filteredUpcoming = upcomingEvents.filter((evt) => {
      const client = state.clients.find((c) => c.id === evt.client_id);
      return (
        evt.title.toLowerCase().includes(managerSearch.toLowerCase()) ||
        (evt.venue && evt.venue.toLowerCase().includes(managerSearch.toLowerCase())) ||
        (client && client.name.toLowerCase().includes(managerSearch.toLowerCase()))
      );
    });

    return (
      <div>
        <div className="page-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <span
                className="role-tag-badge"
                style={{ background: '#2563eb', color: '#fff', fontSize: '0.75rem' }}
              >
                MANAGER DASHBOARD
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Logged in as: <strong>{currentUser?.full_name}</strong>
              </span>
            </div>
            <h1 className="page-title">Upcoming Events &amp; Operations</h1>
            <p className="page-subtitle">
              Manage upcoming banquet events, menus, and warehouse kitchen stock.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href="/events" className="btn btn-primary">
              + New Event Booking
            </Link>
            <Link href="/menu" className="btn btn-secondary">
              🍽️ Add Menu Item
            </Link>
            <Link href="/stock" className="btn btn-secondary">
              📦 Manage Stock
            </Link>
          </div>
        </div>

        <PWAInstallBanner />

        {/* Manager Operational KPI Cards */}
        <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
          <div className="stats-card" style={{ borderTop: '3px solid #2563eb', background: 'linear-gradient(180deg, #eff6ff 0%, #ffffff 65%)' }}>
            <span className="stats-label" style={{ color: '#1d4ed8' }}>Upcoming Banquets Scheduled</span>
            <span className="stats-value" style={{ color: '#2563eb' }}>
              {upcomingEvents.length}
            </span>
            <span className="stats-sub">Confirmed &amp; inquiry functions</span>
          </div>

          <div className="stats-card" style={{ borderTop: '3px solid #059669', background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 65%)' }}>
            <span className="stats-label" style={{ color: '#047857' }}>Total Guests / Pax to Cater</span>
            <span className="stats-value" style={{ color: 'var(--success)' }}>
              {totalUpcomingPax.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub">Across all upcoming banquets</span>
          </div>

          <div className="stats-card" style={{ borderTop: '3px solid #d97706', background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 65%)' }}>
            <span className="stats-label" style={{ color: '#b45309' }}>Pantry Stock Health</span>
            <span
              className="stats-value"
              style={{ color: lowStockItems.length > 0 ? '#b45309' : 'var(--success)' }}
            >
              {lowStockItems.length > 0 ? `${lowStockItems.length} Low` : '✓ All Good'}
            </span>
            <span className="stats-sub">
              {lowStockItems.length > 0 ? 'Safety threshold alert' : 'Sufficient raw stock'}
            </span>
          </div>
        </div>

        {/* Low Stock Warning Banner if any */}
        {lowStockItems.length > 0 && (
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.9rem' }}>
                ⚠️ Kitchen Stock Notice: {lowStockItems.length} items below safety threshold!
              </div>
              <div style={{ fontSize: '0.8rem', color: '#b45309', marginTop: '0.2rem' }}>
                {lowStockItems
                  .map((i) => `${i.name} (${i.stock_qty} ${i.unit} left)`)
                  .slice(0, 4)
                  .join(' • ')}
              </div>
            </div>
            <Link href="/stock" className="btn btn-secondary btn-sm" style={{ fontWeight: 600 }}>
              Adjust / Restock &rarr;
            </Link>
          </div>
        )}

        {/* UPCOMING EVENTS LIST */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}
          >
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>
                📅 Upcoming Events &amp; Banquet Schedule
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Chronologically ordered catering events, venue details, and pax counts
              </p>
            </div>
            <div style={{ minWidth: '240px' }}>
              <input
                type="text"
                placeholder="Search upcoming events..."
                className="form-control"
                value={managerSearch}
                onChange={(e) => setManagerSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event Date &amp; Time</th>
                  <th>Title &amp; Venue</th>
                  <th>Client</th>
                  <th style={{ textAlign: 'center' }}>Pax Count</th>
                  <th style={{ textAlign: 'center' }}>Menu Items</th>
                  <th style={{ textAlign: 'center' }}>Staff Assigned</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredUpcoming.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      No upcoming events found.
                    </td>
                  </tr>
                ) : (
                  filteredUpcoming.map((evt) => {
                    const client = state.clients.find((c) => c.id === evt.client_id);
                    const itemsCount = state.eventItems.filter((i) => i.event_id === evt.id).length;
                    const shiftsCount = state.shifts.filter((s) => s.event_id === evt.id).length;

                    return (
                      <tr key={evt.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>
                            {new Date(evt.event_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {evt.start_time || '18:00'} - {evt.end_time || '23:00'}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{evt.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            📍 {evt.venue || 'Venue TBD'}
                          </div>
                        </td>
                        <td>
                          <div>{client?.name || 'Walk-in Client'}</div>
                          {client?.phone && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              📞 {client.phone}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {evt.guest_count} Pax
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge" style={{ background: '#f1f5f9' }}>
                            {itemsCount} items
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge" style={{ background: shiftsCount > 0 ? '#dcfce7' : '#fee2e2', color: shiftsCount > 0 ? '#15803d' : '#b91c1c' }}>
                            {shiftsCount} staff
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge badge-${evt.status}`}>
                            {evt.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Link href={`/events/${evt.id}`} className="btn btn-secondary btn-sm">
                            Manage &rarr;
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Manager Quick Navigation Cards */}
        <div className="grid-2">
          <div className="card">
            <h3 className="card-title">🍽️ Menu &amp; Recipe Management</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Create dishes, assign per-guest pricing, and define scaled raw ingredients per pax.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link href="/menu" className="btn btn-primary btn-sm">
                Open Menu Catalog ({state.menuItems.length} items)
              </Link>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">📦 Warehouse Pantry Stock</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Quickly adjust pantry quantities (+1, +10, -5) and monitor safety stock thresholds.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link href="/stock" className="btn btn-secondary btn-sm">
                View Pantry Stock ({state.ingredients.length} items)
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------------------
  // 2. ACCOUNTANT VIEW
  // -------------------------------------------------------------------------------------
  if (role === 'accountant') {
    const filteredWorks = upcomingEvents.filter((evt) => {
      const client = state.clients.find((c) => c.id === evt.client_id);
      return (
        evt.title.toLowerCase().includes(accountantSearch.toLowerCase()) ||
        (client && client.name.toLowerCase().includes(accountantSearch.toLowerCase())) ||
        (evt.venue && evt.venue.toLowerCase().includes(accountantSearch.toLowerCase()))
      );
    });

    return (
      <div>
        <div className="page-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <span
                className="role-tag-badge"
                style={{ background: '#059669', color: '#fff', fontSize: '0.75rem' }}
              >
                ACCOUNTANT DASHBOARD
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Logged in as: <strong>{currentUser?.full_name}</strong>
              </span>
            </div>
            <h1 className="page-title">Financial Sales &amp; Upcoming Works</h1>
            <p className="page-subtitle">
              Total sales revenue, invoice status, and billing details for upcoming works.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Link href="/invoices" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
              🧾 Invoices &amp; Billing
            </Link>
            <Link
              href="/staff"
              className="btn btn-secondary"
              style={{
                background: '#f5f3ff',
                borderColor: '#c4b5fd',
                color: '#5b21b6',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}
            >
              💸 Pay Staff Salary
            </Link>
            <Link
              href="/stock?tab=purchases"
              className="btn btn-secondary"
              style={{
                background: '#ecfdf5',
                borderColor: '#6ee7b7',
                color: '#047857',
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}
            >
              💳 Pay Vendor Bills
            </Link>
          </div>
        </div>

        {/* PWA App Install Banner */}
        <PWAInstallBanner />

        {/* Accountant Top Financial KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="stats-card" style={{ borderTop: '3px solid #e11d48', background: 'linear-gradient(180deg, #fff1f2 0%, #ffffff 65%)' }}>
            <span className="stats-label" style={{ color: '#be123c' }}>Total Projected Sales</span>
            <span className="stats-value" style={{ color: '#e11d48', fontVariantNumeric: 'tabular-nums' }}>
              ₹{totalSales.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub">From {state.events.length} booked banquet functions</span>
          </div>

          <div className="stats-card" style={{ borderTop: '3px solid #059669', background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 65%)' }}>
            <span className="stats-label" style={{ color: '#047857' }}>Client Payments Received</span>
            <span className="stats-value" style={{ color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
              ₹{totalPaid.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub" style={{ fontVariantNumeric: 'tabular-nums' }}>Invoiced: ₹{totalInvoiced.toLocaleString('en-IN')}</span>
          </div>

          <div className="stats-card" style={{ borderTop: '3px solid #d97706', background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 65%)' }}>
            <span className="stats-label" style={{ color: '#b45309' }}>Receivables from Clients</span>
            <span
              className="stats-value"
              style={{ color: totalPending > 0 ? '#dc2626' : 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}
            >
              ₹{totalPending.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub">Pending client invoice balances</span>
          </div>

          <div className="stats-card" style={{ borderTop: '3px solid #dc2626', background: 'linear-gradient(180deg, #fef2f2 0%, #ffffff 65%)' }}>
            <span className="stats-label" style={{ color: '#b91c1c' }}>Vendor Dues</span>
            <span
              className="stats-value"
              style={{ color: totalVendorDues > 0 ? '#dc2626' : 'var(--success)', fontVariantNumeric: 'tabular-nums' }}
            >
              ₹{totalVendorDues.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub" style={{ fontVariantNumeric: 'tabular-nums' }}>
              Paid: ₹{totalVendorPaid.toLocaleString('en-IN')} ·{' '}
              <Link href="/stock?tab=purchases" style={{ color: '#047857', fontWeight: 700, textDecoration: 'underline' }}>
                Pay Vendors &rarr;
              </Link>
            </span>
          </div>

          <div className="stats-card" style={{ borderTop: '3px solid #7c3aed', background: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 65%)' }}>
            <span className="stats-label" style={{ color: '#6d28d9' }}>Staff Salary Payable</span>
            <span
              className="stats-value"
              style={{ color: totalStaffSalaryPayable > 0 ? '#dc2626' : 'var(--success)', fontVariantNumeric: 'tabular-nums' }}
            >
              ₹{totalStaffSalaryPayable.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub" style={{ fontVariantNumeric: 'tabular-nums' }}>
              Paid: ₹{totalStaffSalaryPaid.toLocaleString('en-IN')} ·{' '}
              <Link href="/staff" style={{ color: '#6d28d9', fontWeight: 700, textDecoration: 'underline' }}>
                Pay Salary &rarr;
              </Link>
            </span>
          </div>
        </div>

        {/* Bank vs Cash & Destination Account Holdings */}
        <InvoiceCollectionsCard
          breakdown={store.getInvoiceCollectionsBreakdown()}
          showInvoicesLink
        />

        {/* 1. Monthly Total Sales Amount Graph */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}
          >
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>
                📊 Monthly Total Sales Revenue
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Monthly sales distribution across catering orders and banquet contracts
              </p>
            </div>
            <span className="badge" style={{ background: '#f1f5f9', fontSize: '0.8rem' }}>
              Amounts in INR (₹)
            </span>
          </div>

          {chartData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No events recorded yet.</p>
          ) : !isMounted ? (
            <div
              style={{
                height: 280,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}
            >
              Loading chart...
            </div>
          ) : (
            <div style={{ height: 280, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                    stroke="#64748b"
                  />
                  <Tooltip
                    formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Sales Revenue']}
                    contentStyle={{
                      background: '#0f172a',
                      color: '#fff',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '0.85rem'
                    }}
                  />
                  <Bar dataKey="sales" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 2. UPCOMING WORKS DETAILS & FINANCIALS */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}
          >
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>
                📋 Upcoming Works &amp; Billing Details
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Upcoming catering functions, quote values, advance invoiced and payment collection status
              </p>
            </div>
            <div style={{ minWidth: '240px' }}>
              <input
                type="text"
                placeholder="Search upcoming works by title, client..."
                className="form-control"
                style={{ fontSize: '0.85rem' }}
                value={accountantSearch}
                onChange={(e) => setAccountantSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Work / Event Title</th>
                  <th>Client &amp; Phone</th>
                  <th>Date</th>
                  <th>Guests</th>
                  <th style={{ textAlign: 'right' }}>Total Quote</th>
                  <th style={{ textAlign: 'right' }}>Invoiced</th>
                  <th style={{ textAlign: 'right' }}>Paid</th>
                  <th style={{ textAlign: 'center' }}>Billing Status</th>
                  <th style={{ textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredWorks.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No upcoming works found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredWorks.map((evt) => {
                    const client = state.clients.find((c) => c.id === evt.client_id);
                    const { grandTotal } = store.getEventTotal(evt.id);

                    const eventInvoices = state.invoices.filter((inv) => inv.event_id === evt.id);
                    const invoicedAmt = eventInvoices.reduce((sum, i) => sum + i.amount, 0);

                    const invIds = eventInvoices.map((i) => i.id);
                    const collectedAmt = state.payments
                      .filter((p) => invIds.includes(p.invoice_id))
                      .reduce((sum, p) => sum + p.amount, 0);

                    const isFullyPaid = collectedAmt >= grandTotal && grandTotal > 0;
                    const isPartiallyPaid = collectedAmt > 0 && collectedAmt < grandTotal;

                    return (
                      <tr key={evt.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{evt.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            📍 {evt.venue || 'No venue set'}
                          </div>
                        </td>
                        <td>
                          <div>{client?.name || 'Walk-in'}</div>
                          {client?.phone && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              📞 {client.phone}
                            </div>
                          )}
                        </td>
                        <td>
                          {new Date(evt.event_date).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td style={{ textAlign: 'center' }}>{evt.guest_count} Pax</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ₹{grandTotal.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          ₹{invoicedAmt.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                          ₹{collectedAmt.toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isFullyPaid ? (
                            <span className="badge" style={{ background: '#dcfce7', color: '#15803d' }}>
                              Fully Paid
                            </span>
                          ) : isPartiallyPaid ? (
                            <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                              Part Paid
                            </span>
                          ) : (
                            <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                              Pending
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <Link href={`/events/${evt.id}`} className="btn btn-secondary btn-sm">
                            View &rarr;
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Recent Invoices quick glance for Accountant */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>
              🧾 Recent Generated Invoices
            </h2>
            <Link href="/invoices" className="btn btn-primary btn-sm">
              View All Invoices ({state.invoices.length}) &rarr;
            </Link>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Event &amp; Client</th>
                  <th>Kind</th>
                  <th>Due Date</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {state.invoices.slice(0, 5).map((inv) => {
                  const evt = state.events.find((e) => e.id === inv.event_id);
                  const client = state.clients.find((c) => c.id === evt?.client_id);
                  return (
                    <tr key={inv.id}>
                      <td style={{ fontWeight: 700 }}>{inv.invoice_number}</td>
                      <td>
                        <Link href={`/events/${evt?.id}`} style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'underline' }}>
                          {evt?.title || 'Unknown Event'}
                        </Link>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Client: {client?.name}
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: '#f1f5f9' }}>{inv.kind}</span>
                      </td>
                      <td>{inv.due_date || 'Immediate'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        ₹{inv.amount.toLocaleString('en-IN')}
                      </td>
                      <td>
                        <span className={`badge badge-${inv.status}`}>{inv.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------------------
  // 3. OWNER VIEW — Simplified, Clean Executive Overview
  // -------------------------------------------------------------------------------------
  const completedOwnerEvents = state.events.filter((e) => e.status === 'completed');
  const ownerPnlTotals = completedOwnerEvents.reduce(
    (acc, evt) => {
      const fin = store.getEventFinancialSummary(evt.id);
      acc.revenue += fin.contractRevenue;
      acc.expenditure += fin.totalExpenditure;
      acc.netProfit += fin.netProfit;
      return acc;
    },
    { revenue: 0, expenditure: 0, netProfit: 0 }
  );

  const collectionsBreakdown = store.getInvoiceCollectionsBreakdown();
  const bankSharePct =
    collectionsBreakdown.totalCollected > 0
      ? Math.round(
          (collectionsBreakdown.totalBankReceived / collectionsBreakdown.totalCollected) * 100
        )
      : 0;
  const cashSharePct =
    collectionsBreakdown.totalCollected > 0 ? Math.max(0, 100 - bankSharePct) : 0;

  const totalPayables = totalVendorDues + totalStaffSalaryPayable;
  const displayedChartData =
    ownerChartRange === '6m' ? chartData.slice(-6) : chartData;

  const isProfitPositive = ownerPnlTotals.netProfit >= 0;

  const formatEventStatus = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { label: 'Confirmed', color: '#15803d' };
      case 'quoted':
        return { label: 'Quoted', color: '#b45309' };
      case 'inquiry':
        return { label: 'Inquiry', color: '#0369a1' };
      default:
        return { label: status, color: '#475569' };
    }
  };

  return (
    <div style={{ paddingBottom: '2rem' }}>
      {/* Executive Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          paddingBottom: '1.15rem',
          borderBottom: '1px solid #e2e8f0'
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.78rem',
              color: '#64748b',
              fontWeight: 500,
              marginBottom: '0.35rem',
              flexWrap: 'wrap'
            }}
          >
            <span style={{ color: '#0f172a', fontWeight: 600 }}>
              {role === 'super_admin' ? 'Super Admin' : 'Owner'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Calicut</span>
            {currentUser?.full_name && (
              <>
                <span aria-hidden="true">·</span>
                <span>{currentUser.full_name}</span>
              </>
            )}
          </div>
          <h1
            style={{
              fontSize: 'clamp(1.55rem, 2.4vw, 1.95rem)',
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
              margin: 0
            }}
          >
            Business Overview
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <Link
            href="/pnl"
            className="btn btn-secondary"
            style={{ whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            Profit &amp; Loss
          </Link>
          <Link
            href="/invoices"
            className="btn btn-secondary"
            style={{ whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            Invoices
          </Link>
          <Link
            href="/events"
            className="btn btn-primary"
            style={{ whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            + New Event
          </Link>
        </div>
      </div>

      {/* PWA Install Prompt (shows only when installable) */}
      <PWAInstallBanner />

      {/* Row 1: 4 Colourful Streamlined KPI Cards */}
      <div className="owner-kpi-grid">
        {/* 1. Total Revenue */}
        <div
          className="owner-kpi-card"
          style={{
            borderTop: '3px solid #e11d48',
            background: 'linear-gradient(180deg, #fff1f2 0%, #ffffff 60%)'
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#be123c' }}>
              Total Revenue
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                marginTop: '0.35rem',
                lineHeight: 1.15
              }}
            >
              ₹{totalSales.toLocaleString('en-IN')}
            </div>
          </div>
          <div
            className="tabular-nums"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.78rem',
              color: '#475569',
              marginTop: '0.85rem',
              paddingTop: '0.65rem',
              borderTop: '1px solid #f1f5f9'
            }}
          >
            <span>Collected ₹{totalPaid.toLocaleString('en-IN')}</span>
            <Link
              href="/invoices"
              style={{ color: '#be123c', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Invoices &rarr;
            </Link>
          </div>
        </div>

        {/* 2. Completed Events Profit & Loss (Owner-Only) */}
        <div
          className="owner-kpi-card"
          style={{
            borderTop: `3px solid ${isProfitPositive ? '#059669' : '#dc2626'}`,
            background: isProfitPositive
              ? 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 60%)'
              : 'linear-gradient(180deg, #fef2f2 0%, #ffffff 60%)'
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.4rem'
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isProfitPositive ? '#047857' : '#b91c1c' }}>
                Net {isProfitPositive ? 'Profit' : 'Loss'} (Completed)
              </span>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                Owner only
              </span>
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: isProfitPositive ? '#059669' : '#dc2626',
                letterSpacing: '-0.02em',
                marginTop: '0.35rem',
                lineHeight: 1.15
              }}
            >
              {isProfitPositive ? '+' : '-'}₹
              {Math.abs(ownerPnlTotals.netProfit).toLocaleString('en-IN')}
            </div>
          </div>
          <div
            className="tabular-nums"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.78rem',
              color: '#475569',
              marginTop: '0.85rem',
              paddingTop: '0.65rem',
              borderTop: '1px solid #f1f5f9'
            }}
          >
            <span>
              Spent ₹{ownerPnlTotals.expenditure.toLocaleString('en-IN')} ({completedOwnerEvents.length})
            </span>
            <Link
              href="/pnl"
              style={{ color: '#059669', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              P&amp;L report &rarr;
            </Link>
          </div>
        </div>

        {/* 3. Upcoming Events */}
        <div
          className="owner-kpi-card"
          style={{
            borderTop: '3px solid #4f46e5',
            background: 'linear-gradient(180deg, #eef2ff 0%, #ffffff 60%)'
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4338ca' }}>
              Upcoming Events
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                marginTop: '0.35rem',
                lineHeight: 1.15
              }}
            >
              {upcomingEvents.length}
            </div>
          </div>
          <div
            className="tabular-nums"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.78rem',
              color: '#475569',
              marginTop: '0.85rem',
              paddingTop: '0.65rem',
              borderTop: '1px solid #f1f5f9'
            }}
          >
            <span>
              {activeEvents.length} confirmed · {totalUpcomingPax.toLocaleString('en-IN')} guests
            </span>
            <Link
              href="/events"
              style={{ color: '#4338ca', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Schedule &rarr;
            </Link>
          </div>
        </div>

        {/* 4. Pending Payables (Vendors + Staff) */}
        <div
          className="owner-kpi-card"
          style={{
            borderTop: '3px solid #d97706',
            background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 60%)'
          }}
        >
          <div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b45309' }}>
              Pending Payables
            </div>
            <div
              className="tabular-nums"
              style={{
                fontSize: '1.75rem',
                fontWeight: 800,
                color: totalPayables > 0 ? '#dc2626' : '#0f172a',
                letterSpacing: '-0.02em',
                marginTop: '0.35rem',
                lineHeight: 1.15
              }}
            >
              ₹{totalPayables.toLocaleString('en-IN')}
            </div>
          </div>
          <div
            className="tabular-nums"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.78rem',
              color: '#475569',
              marginTop: '0.85rem',
              paddingTop: '0.65rem',
              borderTop: '1px solid #f1f5f9'
            }}
          >
            <span>
              Vendors ₹{totalVendorDues.toLocaleString('en-IN')} · Staff ₹
              {totalStaffSalaryPayable.toLocaleString('en-IN')}
            </span>
            <Link
              href="/staff"
              style={{ color: '#b45309', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              Payroll &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Row 2: Balanced 2-Column Split — Monthly Revenue Chart + Collections & Accounts */}
      <div className="owner-exec-split">
        {/* Left: Monthly Revenue BarChart */}
        <div
          className="owner-clean-card"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '0.75rem',
              flexWrap: 'wrap',
              marginBottom: '1.15rem'
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: '#0f172a',
                  margin: 0
                }}
              >
                Monthly Revenue
              </h2>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                Booked catering &amp; event volume in INR
              </p>
            </div>

            {chartData.length > 6 && (
              <div className="owner-segmented-group">
                <button
                  type="button"
                  onClick={() => setOwnerChartRange('6m')}
                  className={`owner-segmented-btn ${ownerChartRange === '6m' ? 'active' : ''}`}
                >
                  Last 6 Months
                </button>
                <button
                  type="button"
                  onClick={() => setOwnerChartRange('all')}
                  className={`owner-segmented-btn ${ownerChartRange === 'all' ? 'active' : ''}`}
                >
                  All ({chartData.length})
                </button>
              </div>
            )}
          </div>

          {displayedChartData.length === 0 ? (
            <div
              style={{
                height: 260,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.6rem',
                color: '#64748b',
                fontSize: '0.88rem'
              }}
            >
              <span>No catering bookings recorded yet.</span>
              <Link href="/events" className="btn btn-primary btn-sm">
                + Create First Event
              </Link>
            </div>
          ) : !isMounted ? (
            <div
              style={{
                height: 260,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: '0.85rem'
              }}
            >
              Loading revenue chart...
            </div>
          ) : (
            <div style={{ height: 265, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={displayedChartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(val: any) => [
                      `₹${Number(val).toLocaleString('en-IN')}`,
                      'Revenue'
                    ]}
                    contentStyle={{
                      background: '#0f172a',
                      color: '#ffffff',
                      borderRadius: '8px',
                      border: 'none',
                      fontSize: '0.82rem',
                      padding: '8px 12px'
                    }}
                  />
                  <Bar dataKey="sales" fill="#e11d48" radius={[6, 6, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right: Collections & Accounts Summary */}
        <div
          className="owner-clean-card"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.9rem'
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    margin: 0
                  }}
                >
                  Collections &amp; Accounts
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                  Bank vs cash receipts and active balances
                </p>
              </div>
              <Link
                href="/invoices"
                style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e11d48', whiteSpace: 'nowrap' }}
              >
                Manage &rarr;
              </Link>
            </div>

            {/* Total Collected Figure + Proportional Channel Bar */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  className="tabular-nums"
                  style={{ fontSize: '1.55rem', fontWeight: 700, color: '#0f172a' }}
                >
                  ₹{collectionsBreakdown.totalCollected.toLocaleString('en-IN')}
                </span>
                <span className="tabular-nums" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  of ₹{collectionsBreakdown.totalInvoiced.toLocaleString('en-IN')} invoiced
                </span>
              </div>

              <div
                style={{
                  height: '6px',
                  width: '100%',
                  background: '#f1f5f9',
                  borderRadius: '999px',
                  overflow: 'hidden',
                  display: 'flex',
                  marginTop: '0.6rem'
                }}
              >
                {bankSharePct > 0 && (
                  <div style={{ width: `${bankSharePct}%`, background: '#1d4ed8' }} />
                )}
                {cashSharePct > 0 && (
                  <div style={{ width: `${cashSharePct}%`, background: '#059669' }} />
                )}
              </div>
            </div>

            {/* Clean Hairline Breakdown Rows */}
            <div style={{ borderTop: '1px solid #f1f5f9' }}>
              <div
                className="tabular-nums"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.55rem 0',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '0.84rem'
                }}
              >
                <span style={{ color: '#475569' }}>
                  Bank Accounts ({bankSharePct}%)
                </span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                  ₹{collectionsBreakdown.totalBankReceived.toLocaleString('en-IN')}
                </span>
              </div>

              <div
                className="tabular-nums"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.55rem 0',
                  borderBottom: '1px solid #f1f5f9',
                  fontSize: '0.84rem'
                }}
              >
                <span style={{ color: '#475569' }}>
                  Cash in Hand ({cashSharePct}%)
                </span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                  ₹{collectionsBreakdown.totalCashReceived.toLocaleString('en-IN')}
                </span>
              </div>

              <div
                className="tabular-nums"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.55rem 0',
                  fontSize: '0.84rem'
                }}
              >
                <span style={{ color: '#475569' }}>Pending From Clients</span>
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      collectionsBreakdown.totalPendingReceivable > 0
                        ? '#dc2626'
                        : '#15803d'
                  }}
                >
                  ₹{collectionsBreakdown.totalPendingReceivable.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Compact Destination Account Balances */}
          {collectionsBreakdown.accountHoldings.length > 0 && (
            <div
              style={{
                marginTop: '0.85rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid #e2e8f0'
              }}
            >
              <div
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: '#64748b',
                  marginBottom: '0.45rem'
                }}
              >
                Account Balances
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {collectionsBreakdown.accountHoldings.slice(0, 4).map((acc) => (
                  <div
                    key={`${acc.channel}-${acc.accountName}`}
                    className="tabular-nums"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.82rem'
                    }}
                  >
                    <span
                      style={{
                        color: '#334155',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '65%'
                      }}
                    >
                      {acc.accountName}
                    </span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>
                      ₹{acc.totalReceived.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Upcoming Schedule */}
      <div className="owner-clean-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.2rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '1.05rem',
                fontWeight: 700,
                color: '#0f172a',
                margin: 0
              }}
            >
              Upcoming Schedule
            </h2>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.8rem',
                color: '#64748b',
                marginTop: '0.15rem',
                flexWrap: 'wrap'
              }}
            >
              <span>{upcomingEvents.length} scheduled events</span>
              <span aria-hidden="true">·</span>
              {lowStockItems.length > 0 ? (
                <Link href="/stock" style={{ color: '#dc2626', fontWeight: 600 }}>
                  {lowStockItems.length} low-stock item{lowStockItems.length === 1 ? '' : 's'} &rarr;
                </Link>
              ) : (
                <span>Inventory healthy</span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link
              href="/users"
              className="btn btn-secondary btn-sm"
              style={{ whiteSpace: 'nowrap' }}
            >
              Team Access
            </Link>
            <Link
              href="/events"
              className="btn btn-secondary btn-sm"
              style={{ whiteSpace: 'nowrap' }}
            >
              All Events ({state.events.length}) &rarr;
            </Link>
          </div>
        </div>

        {upcomingEvents.length === 0 ? (
          <div
            style={{
              padding: '2.25rem 1.5rem',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.9rem'
            }}
          >
            <div style={{ marginBottom: '0.75rem' }}>
              No upcoming events scheduled at the moment.
            </div>
            <Link href="/events" className="btn btn-primary btn-sm">
              + Schedule Event
            </Link>
          </div>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Event &amp; Venue</th>
                  <th>Client</th>
                  <th style={{ textAlign: 'right' }}>Guests</th>
                  <th style={{ textAlign: 'right' }}>Value</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingEvents.slice(0, 6).map((evt) => {
                  const client = state.clients.find((c) => c.id === evt.client_id);
                  const { grandTotal } = store.getEventTotal(evt.id);
                  const statusMeta = formatEventStatus(evt.status);

                  return (
                    <tr key={evt.id}>
                      <td className="tabular-nums" style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {new Date(evt.event_date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {evt.start_time || '18:00'}
                        </div>
                      </td>
                      <td>
                        <Link
                          href={`/events/${evt.id}`}
                          style={{
                            fontWeight: 600,
                            color: '#0f172a',
                            textDecoration: 'none'
                          }}
                        >
                          {evt.title}
                        </Link>
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                          {evt.venue || 'Calicut'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: '#0f172a' }}>
                          {client?.name || '—'}
                        </div>
                        {client?.phone && (
                          <div
                            className="tabular-nums"
                            style={{ fontSize: '0.75rem', color: '#64748b' }}
                          >
                            {client.phone}
                          </div>
                        )}
                      </td>
                      <td
                        className="tabular-nums"
                        style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}
                      >
                        {evt.guest_count.toLocaleString('en-IN')}
                      </td>
                      <td
                        className="tabular-nums"
                        style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}
                      >
                        ₹{grandTotal.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: statusMeta.color
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
}
