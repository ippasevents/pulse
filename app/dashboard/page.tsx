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
import OwnerAuditBadge, { formatAuditTimestamp, getActorRoleStyle } from '@/components/OwnerAuditBadge';
import { getAuditTargetLink } from '@/components/OwnerActivityAlertModal';
import InvoiceCollectionsCard from '@/components/InvoiceCollectionsCard';
import PWAInstallBanner from '@/components/PWAInstallBanner';
import ChangePasswordModal from '@/components/ChangePasswordModal';

export default function DashboardPage() {
  const [state, setState] = useState(store.getState());
  const [isMounted, setIsMounted] = useState(false);
  const [managerSearch, setManagerSearch] = useState('');
  const [accountantSearch, setAccountantSearch] = useState('');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

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

    const staffShifts = state.shifts
      .filter((sh) => sh.staff_member_id === currentUser?.id)
      .map((sh) => {
        const event = state.events.find((e) => e.id === sh.event_id);
        return { shift: sh, event };
      })
      .filter((item) => item.event && item.event.status !== 'cancelled' && item.event.status !== 'completed')
      .sort((a, b) => (a.event?.event_date || '').localeCompare(b.event?.event_date || ''));

    const nextAssignment = staffShifts[0];
    const otherAssignments = staffShifts.slice(1);

    return (
      <div style={{ maxWidth: '880px', margin: '0 auto', paddingBottom: '2rem' }}>
        <div className="page-header" style={{ marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
              <span className="role-tag-badge" style={{ background: '#7c3aed', color: '#fff', fontSize: '0.75rem' }}>
                STAFF DUTY &amp; SALARY PORTAL
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Staff Member: <strong>{currentUser?.full_name}</strong> ({currentUser?.phone})
                {staffRecord?.hourly_rate ? ` • Rate: ₹${staffRecord.hourly_rate}/hr` : ''}
              </span>
            </div>
            <h1 className="page-title">My Duty Schedule &amp; Salary Summary</h1>
            <p className="page-subtitle">
              View your salary received, pending balance receivable, and upcoming catering venue assignments.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 700,
                fontSize: '0.82rem',
                padding: '0.45rem 0.85rem'
              }}
            >
              🔑 പാസ്‌വേഡ് മാറ്റുക (Change Password)
            </button>
          </div>
        </div>

        <PWAInstallBanner />

        {/* STAFF SALARY SUMMARY CARDS */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}
        >
          <div className="stats-card" style={{ borderLeft: '4px solid #2563eb' }}>
            <span className="stats-label">Total Salary Earned</span>
            <span className="stats-value" style={{ color: '#2563eb' }}>
              ₹{salarySummary.totalEarned.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub">
              {salarySummary.attendedShiftsCount} attended shift{salarySummary.attendedShiftsCount === 1 ? '' : 's'} ({salarySummary.totalShiftHours} hrs)
              {salarySummary.extraEarnings > 0
                ? ` + ₹${salarySummary.extraEarnings.toLocaleString('en-IN')} bonus`
                : ''}
            </span>
          </div>

          <div className="stats-card" style={{ borderLeft: '4px solid #059669' }}>
            <span className="stats-label">Salary Received</span>
            <span className="stats-value" style={{ color: '#059669' }}>
              ₹{salarySummary.totalPaid.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub">
              {salarySummary.paymentRecords.length} payment
              {salarySummary.paymentRecords.length === 1 ? '' : 's'} received so far
            </span>
          </div>

          <div
            className="stats-card"
            style={{
              borderLeft: `4px solid ${salarySummary.balancePayable > 0 ? '#dc2626' : '#059669'}`,
              background: salarySummary.balancePayable > 0 ? '#fffafa' : '#ffffff'
            }}
          >
            <span className="stats-label">Pending Salary Balance</span>
            <span
              className="stats-value"
              style={{ color: salarySummary.balancePayable > 0 ? '#dc2626' : '#059669' }}
            >
              ₹{salarySummary.balancePayable.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub">
              {salarySummary.balancePayable > 0
                ? 'Remaining salary payable to you'
                : salarySummary.advanceExcess > 0
                ? `Advance excess: ₹${salarySummary.advanceExcess.toLocaleString('en-IN')}`
                : 'All earned salary settled'}
            </span>
          </div>
        </div>

        {nextAssignment ? (
          <div>
            {/* Prominent Next Function Card */}
            <div
              className="card"
              style={{
                border: '2px solid #7c3aed',
                background: 'linear-gradient(to bottom, #ffffff 0%, #faf5ff 100%)',
                boxShadow: '0 10px 15px -3px rgba(124, 58, 237, 0.1)',
                padding: '1.75rem',
                marginBottom: '1.5rem',
                borderRadius: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                <span
                  style={{
                    background: '#7c3aed',
                    color: '#ffffff',
                    padding: '0.35rem 0.85rem',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  ⭐ Next Assigned Function
                </span>

                <span className="badge" style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                  Confirmed Assignment
                </span>
              </div>

              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                {nextAssignment.event?.title}
              </h2>

              {/* Venue & Location Highlight */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #e9d5ff',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  marginTop: '1.25rem',
                  marginBottom: '1.25rem'
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.35rem' }}>
                  Function Location &amp; Venue:
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e1b4b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📍</span>
                  <span>{nextAssignment.event?.venue || 'Venue to be confirmed'}</span>
                </div>
                {nextAssignment.event?.venue && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nextAssignment.event.venue)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: '#7c3aed',
                        borderColor: '#7c3aed',
                        fontWeight: 600
                      }}
                    >
                      🗺️ Open Location in Google Maps &rarr;
                    </a>
                  </div>
                )}
              </div>

              {/* Date & Duty Particulars Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Event Date
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                    📅 {new Date(nextAssignment.event!.event_date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Duty Reporting Timing
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                    ⏰ {nextAssignment.shift.starts_at ? nextAssignment.shift.starts_at.slice(11, 16) : (nextAssignment.event?.start_time || 'Report on call')}
                    {nextAssignment.shift.ends_at && ` - ${nextAssignment.shift.ends_at.slice(11, 16)}`}
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Your Assigned Role
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#7c3aed', marginTop: '0.2rem' }}>
                    🧑‍🍳 {nextAssignment.shift.role_label || currentUser?.role_title || 'Service Crew'}
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Expected Guests
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                    👥 {nextAssignment.event?.guest_count} Pax
                  </div>
                </div>
              </div>

              {nextAssignment.event?.notes && (
                <div style={{ marginTop: '1rem', padding: '0.85rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', fontSize: '0.85rem', color: '#475569' }}>
                  <strong>Special Instructions:</strong> {nextAssignment.event.notes}
                </div>
              )}
            </div>

            {/* Other Upcoming Assignments if any */}
            {otherAssignments.length > 0 && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#0f172a' }}>
                  📋 Other Upcoming Assigned Functions ({otherAssignments.length})
                </h3>
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Event Title</th>
                        <th>Venue / Location</th>
                        <th>Assigned Duty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherAssignments.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>
                            {new Date(item.event!.event_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.event?.title}</td>
                          <td>📍 {item.event?.venue}</td>
                          <td>
                            <span className="badge" style={{ background: '#f3e8ff', color: '#7c3aed', fontWeight: 600 }}>
                              {item.shift.role_label || 'Service Crew'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>
              No Upcoming Catering Functions Assigned Yet
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '460px', margin: '0 auto' }}>
              You do not have any upcoming catering functions currently scheduled. Check your salary statement and payment receipts below.
            </p>
          </div>
        )}

        {/* STAFF SALARY RECEIVED & DUTY EARNINGS HISTORY */}
        <div className="grid-2">
          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', color: '#0f172a' }}>
              💸 Salary Payments Received ({salarySummary.paymentRecords.length})
            </h3>
            {salarySummary.paymentRecords.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No salary payouts recorded yet.
              </p>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Method &amp; Note</th>
                      <th style={{ textAlign: 'right' }}>Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salarySummary.paymentRecords.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                          {new Date(p.recorded_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>
                          <div style={{ fontWeight: 600 }}>{p.method}</div>
                          {p.note && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{p.note}</div>}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          ₹{p.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', color: '#0f172a' }}>
              🧑‍🍳 Duty Attendance &amp; Salary Earned ({salarySummary.shiftItems.length + salarySummary.earningRecords.length})
            </h3>
            {salarySummary.shiftItems.length === 0 && salarySummary.earningRecords.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No duty earnings recorded yet.
              </p>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Function / Duty</th>
                      <th>Attendance</th>
                      <th style={{ textAlign: 'right' }}>Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salarySummary.earningRecords.map((er) => (
                      <tr key={er.id}>
                        <td style={{ fontSize: '0.82rem' }}>
                          {new Date(er.recorded_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>
                          <div style={{ fontWeight: 600 }}>{er.method}</div>
                          {er.note && <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{er.note}</div>}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#2563eb' }}>
                            Bonus / Allowance
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>
                          ₹{er.amount.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                    {salarySummary.shiftItems.map((si) => (
                      <tr key={si.shift.id}>
                        <td style={{ fontSize: '0.82rem' }}>
                          {si.event?.event_date
                            ? new Date(si.event.event_date).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short'
                              })
                            : '—'}
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>
                          <div style={{ fontWeight: 600 }}>{si.event?.title || 'Event Shift'}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            {si.hours} hrs ({si.shift.role_label || 'Crew'})
                          </div>
                        </td>
                        <td>
                          {si.attendanceStatus === 'present' ? (
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d' }}>
                              ✓ Present
                            </span>
                          ) : si.attendanceStatus === 'absent' ? (
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626' }}>
                              ✕ Absent
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309' }}>
                              ⏳ Pending
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>
                          {si.isAttended ? (
                            <span style={{ color: '#059669' }}>
                              ₹{si.earnedAmount.toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
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
          <div className="stats-card" style={{ borderLeft: '4px solid #2563eb' }}>
            <span className="stats-label">Upcoming Banquets Scheduled</span>
            <span className="stats-value" style={{ color: '#2563eb' }}>
              {upcomingEvents.length}
            </span>
            <span className="stats-sub">Confirmed &amp; inquiry functions</span>
          </div>

          <div className="stats-card" style={{ borderLeft: '4px solid var(--success)' }}>
            <span className="stats-label">Total Guests / Pax to Cater</span>
            <span className="stats-value" style={{ color: 'var(--success)' }}>
              {totalUpcomingPax.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub">Across all upcoming banquets</span>
          </div>

          <div className="stats-card" style={{ borderLeft: '4px solid #d97706' }}>
            <span className="stats-label">Pantry Stock Health</span>
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
            <Link href="/invoices" className="btn btn-primary">
              🧾 Invoices &amp; Billing
            </Link>
            <Link href="/events" className="btn btn-secondary">
              📅 All Events &amp; Quotes
            </Link>
          </div>
        </div>

        {/* PWA App Install Banner */}
        <PWAInstallBanner />

        {/* Accountant Top Financial KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="stats-card" style={{ borderLeft: '4px solid #e11d48' }}>
            <span className="stats-label">Total Projected Sales</span>
            <span className="stats-value" style={{ color: '#e11d48' }}>
              ₹{totalSales.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub">From {state.events.length} booked banquet functions</span>
          </div>

          <div className="stats-card" style={{ borderLeft: '4px solid #059669' }}>
            <span className="stats-label">Client Payments Received</span>
            <span className="stats-value" style={{ color: '#059669' }}>
              ₹{totalPaid.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub">Invoiced: ₹{totalInvoiced.toLocaleString('en-IN')}</span>
          </div>

          <div className="stats-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <span className="stats-label">Receivables from Clients</span>
            <span
              className="stats-value"
              style={{ color: totalPending > 0 ? '#dc2626' : 'var(--text-main)' }}
            >
              ₹{totalPending.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub">Pending client invoice balances</span>
          </div>

          <div className="stats-card" style={{ borderLeft: '4px solid #dc2626' }}>
            <span className="stats-label">Vendor Dues</span>
            <span
              className="stats-value"
              style={{ color: totalVendorDues > 0 ? '#dc2626' : 'var(--success)' }}
            >
              ₹{totalVendorDues.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub">
              Purchases: ₹{totalStockPurchases.toLocaleString('en-IN')} &bull; Paid: ₹{totalVendorPaid.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="stats-card" style={{ borderLeft: '4px solid #7c3aed' }}>
            <span className="stats-label">Staff Salary Payable</span>
            <span
              className="stats-value"
              style={{ color: totalStaffSalaryPayable > 0 ? '#dc2626' : 'var(--success)' }}
            >
              ₹{totalStaffSalaryPayable.toLocaleString('en-IN')}
            </span>
            <span className="stats-sub">
              Paid: ₹{totalStaffSalaryPaid.toLocaleString('en-IN')} &bull;{' '}
              <Link href="/staff" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                Manage &rarr;
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
  // 3. OWNER VIEW
  // -------------------------------------------------------------------------------------
  const unreadOwnerAlerts = store.getUnreadOwnerAlerts();

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
            <span
              className="role-tag-badge"
              style={{ background: '#e11d48', color: '#fff', fontSize: '0.75rem' }}
            >
              OWNER EXECUTIVE DASHBOARD
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Logged in as: <strong>{currentUser?.full_name}</strong>
            </span>
          </div>
          <h1 className="page-title">Executive Overview &amp; Control</h1>
          <p className="page-subtitle">
            Executive control and overview across events, sales, invoices, menus, and staff operations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link href="/events" className="btn btn-primary">
            + New Event Inquiry
          </Link>
          <Link href="/invoices" className="btn btn-secondary">
            🧾 Invoices
          </Link>
          <Link href="/users" className="btn btn-secondary">
            🛡️ User Logins
          </Link>
        </div>
      </div>

      {/* PWA App Install Banner */}
      <PWAInstallBanner />

      {/* Top Executive KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stats-card">
          <span className="stats-label">Total Projected Sales</span>
          <span className="stats-value">₹{totalSales.toLocaleString('en-IN')}</span>
          <span className="stats-sub">Across {chartData.length} active booking months</span>
        </div>

        <div className="stats-card">
          <span className="stats-label">Current Active Banquets</span>
          <span className="stats-value" style={{ color: 'var(--success)' }}>
            {activeEvents.length}
          </span>
          <span className="stats-sub">Confirmed &amp; in-progress functions</span>
        </div>

        <div className="stats-card">
          <span className="stats-label">Upcoming Banquet Pipeline</span>
          <span className="stats-value" style={{ color: 'var(--primary)' }}>
            {upcomingEvents.length}
          </span>
          <span className="stats-sub">{totalUpcomingPax} total expected pax</span>
        </div>

        <div className="stats-card">
          <span className="stats-label">Vendor Dues</span>
          <span className="stats-value" style={{ color: totalVendorDues > 0 ? '#dc2626' : 'var(--success)' }}>
            ₹{totalVendorDues.toLocaleString('en-IN')}
          </span>
          <span className="stats-sub">
            <Link href="/stock" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
              Manage Stock Purchases &rarr;
            </Link>
          </span>
        </div>

        <div className="stats-card">
          <span className="stats-label">Staff Salary Payable</span>
          <span className="stats-value" style={{ color: totalStaffSalaryPayable > 0 ? '#dc2626' : 'var(--success)' }}>
            ₹{totalStaffSalaryPayable.toLocaleString('en-IN')}
          </span>
          <span className="stats-sub">
            Paid: ₹{totalStaffSalaryPaid.toLocaleString('en-IN')} &bull;{' '}
            <Link href="/staff" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
              Staff &amp; Salary &rarr;
            </Link>
          </span>
        </div>
      </div>

      {/* Bank vs Cash & Destination Account Holdings */}
      <InvoiceCollectionsCard
        breakdown={store.getInvoiceCollectionsBreakdown()}
        showInvoicesLink
      />

      {/* Monthly Total Sales Graph for Owner */}
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
              Monthly Total Sales Amount
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Monthly revenue distribution from catering orders and banquet contracts
            </p>
          </div>
          <span className="badge" style={{ background: '#f1f5f9', fontSize: '0.8rem' }}>
            Amounts in INR (₹)
          </span>
        </div>

        {chartData.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No events booked yet.</p>
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
                <Bar dataKey="sales" fill="#e11d48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Financial Overview (Invoicing & Settlements) */}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="stats-card">
          <span className="stats-label">Total Invoiced Amount</span>
          <span className="stats-value">₹{totalInvoiced.toLocaleString('en-IN')}</span>
          <span className="stats-sub">{state.invoices.length} invoices generated</span>
        </div>
        <div className="stats-card">
          <span className="stats-label">Payments Reconciled</span>
          <span className="stats-value" style={{ color: 'var(--success)' }}>
            ₹{totalPaid.toLocaleString('en-IN')}
          </span>
          <span className="stats-sub">Deposited to bank &amp; cash</span>
        </div>
        <div className="stats-card">
          <span className="stats-label">Pending Receivables</span>
          <span className="stats-value" style={{ color: totalPending > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
            ₹{totalPending.toLocaleString('en-IN')}
          </span>
          <span className="stats-sub">Outstanding balance to collect</span>
        </div>
      </div>

      {/* Upcoming Events for Owner */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>
              📅 Upcoming Scheduled Banquets
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Confirmed and pending banquet bookings with guest counts and venues
            </p>
          </div>
          <Link href="/events" className="btn btn-secondary btn-sm">
            View All ({state.events.length}) &rarr;
          </Link>
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event Date</th>
                <th>Title &amp; Venue</th>
                <th>Client</th>
                <th style={{ textAlign: 'center' }}>Pax Count</th>
                <th style={{ textAlign: 'right' }}>Total Value</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcomingEvents.slice(0, 5).map((evt) => {
                const client = state.clients.find((c) => c.id === evt.client_id);
                const { grandTotal } = store.getEventTotal(evt.id);
                const latestEvtAudit = store.getEventAuditSummary(evt.id).latestAudit;

                return (
                  <tr key={evt.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {new Date(evt.event_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short'
                        })}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {evt.start_time || '18:00'}
                      </div>
                    </td>
                    <td>
                      <Link href={`/events/${evt.id}`} style={{ fontWeight: 600, color: 'var(--primary)', textDecoration: 'underline' }}>
                        {evt.title}
                      </Link>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        📍 {evt.venue || 'Venue TBD'}
                      </div>
                    </td>
                    <td>
                      <div>{client?.name}</div>
                      {client?.phone && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {client.phone}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>
                      {evt.guest_count} Pax
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      ₹{grandTotal.toLocaleString('en-IN')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge badge-${evt.status}`}>{evt.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Access Information */}
      <div className="card">
        <h2 className="card-title">🛡️ System Modules &amp; Permissions</h2>
        <div className="grid-3">
          <div
            style={{
              padding: '0.85rem',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: '#fff'
            }}
          >
            <div style={{ fontWeight: 700, color: '#e11d48', marginBottom: '0.25rem' }}>
              👑 1. Owner
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Full administrative access across all modules: sales reports, invoices, pricing, stock, staff, and system user passwords.
            </p>
          </div>

          <div
            style={{
              padding: '0.85rem',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: '#fff'
            }}
          >
            <div style={{ fontWeight: 700, color: '#2563eb', marginBottom: '0.25rem' }}>
              📋 2. Manager
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Dedicated operational dashboard focusing on upcoming banquet events, pax scheduling, menu items, raw stock inventory, and staff crew.
            </p>
          </div>

          <div
            style={{
              padding: '0.85rem',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              background: '#fff'
            }}
          >
            <div style={{ fontWeight: 700, color: '#059669', marginBottom: '0.25rem' }}>
              💼 3. Accountant
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Dedicated financial dashboard displaying total monthly sales, payment collections, outstanding balances, and upcoming works billing details.
            </p>
          </div>
        </div>
      </div>
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
}
