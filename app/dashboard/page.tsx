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

export default function DashboardPage() {
  const [state, setState] = useState(store.getState());
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const unsub = store.subscribe(() => {
      setState(store.getState());
    });
    return unsub;
  }, []);

  const role: UserRole = state.currentRole;
  const isFinancePermitted = role === 'owner' || role === 'accountant';

  // Overall Total Sales calculation
  let totalSales = 0;
  state.events.forEach((evt) => {
    if (evt.status !== 'cancelled') {
      const { grandTotal, menuTotal } = store.getEventTotal(evt.id);
      const val = isFinancePermitted ? grandTotal : menuTotal;
      totalSales += val;
    }
  });

  // Monthly breakdown for recharts
  const monthlySales: Record<string, { total: number; count: number }> = {};
  state.events.forEach((evt) => {
    if (evt.status !== 'cancelled') {
      const monthKey = evt.event_date.slice(0, 7); // YYYY-MM
      const { grandTotal, menuTotal } = store.getEventTotal(evt.id);
      const val = isFinancePermitted ? grandTotal : menuTotal;
      if (!monthlySales[monthKey]) {
        monthlySales[monthKey] = { total: 0, count: 0 };
      }
      monthlySales[monthKey].total += val;
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

  // Current Active Events (Confirmed bookings in progress)
  const activeEvents = state.events.filter(
    (e) => e.status === 'confirmed'
  );

  // Upcoming Events (Chronologically ordered, excluding completed/cancelled)
  const upcomingEvents = [...state.events]
    .filter((e) => e.status !== 'completed' && e.status !== 'cancelled')
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Dashboard</h1>
          <p className="page-subtitle">
            Monthly sales revenue, current active banquets, and upcoming scheduled events.
          </p>
        </div>
        <div>
          {(role === 'owner' || role === 'manager') && (
            <Link href="/events" className="btn btn-primary">
              + New Event Inquiry
            </Link>
          )}
        </div>
      </div>

      {!isFinancePermitted && (
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            color: '#1e40af',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '1.25rem'
          }}
        >
          ℹ️ <strong>Role Notice:</strong> Logged in as <em>{role}</em>. Food &amp; beverage quotes are shown; extra logistics fees are restricted to Owner and Accountant roles.
        </div>
      )}

      {/* Top 3 KPI Cards: Monthly Sales, Active Events, Upcoming Events */}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="stats-card">
          <span className="stats-label">Total Projected Sales</span>
          <span className="stats-value">₹{totalSales.toLocaleString('en-IN')}</span>
          <span className="stats-sub">Across {chartData.length} active booking months</span>
        </div>

        <div className="stats-card">
          <span className="stats-label">Current Active Events</span>
          <span className="stats-value" style={{ color: 'var(--success)' }}>
            {activeEvents.length}
          </span>
          <span className="stats-sub">Confirmed &amp; in-progress banquets</span>
        </div>

        <div className="stats-card">
          <span className="stats-label">Total Upcoming Pipeline</span>
          <span className="stats-value" style={{ color: 'var(--primary)' }}>
            {upcomingEvents.length}
          </span>
          <span className="stats-sub">Inquiries, proposals &amp; bookings</span>
        </div>
      </div>

      {/* 1. TOTAL SALES AMOUNT MONTHLY WISE */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>Monthly Total Sales Amount</h2>
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
          <div style={{ height: '280px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Loading monthly sales chart...
          </div>
        ) : (
          <div>
            <div style={{ width: '100%', height: '280px', marginBottom: '1rem' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 15, right: 15, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 13, fill: '#475569', fontWeight: 500 }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: any) => [`₹${Number(value || 0).toLocaleString('en-IN')}`, 'Monthly Total Sales']}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontSize: '0.85rem'
                    }}
                  />
                  <Bar
                    dataKey="sales"
                    fill="#e11d48"
                    radius={[6, 6, 0, 0]}
                    name="Monthly Total Sales"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Summary Badges */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              {chartData.map((item) => (
                <div
                  key={item.monthKey}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.month}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {item.count} event{item.count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>
                    ₹{item.sales.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. CURRENT ACTIVE EVENTS */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>Current Active Events</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Confirmed catering banquets currently scheduled and in active operational prep
            </p>
          </div>
          <span className="badge badge-confirmed">
            {activeEvents.length} Active Confirmed
          </span>
        </div>

        {activeEvents.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '1rem 0' }}>
            No events currently marked as confirmed active.
          </p>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event &amp; Venue</th>
                  <th>Client</th>
                  <th>Date &amp; Schedule</th>
                  <th>Guests</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                  <th style={{ textAlign: 'center' }}>Manage</th>
                </tr>
              </thead>
              <tbody>
                {activeEvents.map((evt) => {
                  const client = state.clients.find((c) => c.id === evt.client_id);
                  const { grandTotal, menuTotal } = store.getEventTotal(evt.id);
                  const displayTotal = isFinancePermitted ? grandTotal : menuTotal;
                  return (
                    <tr key={evt.id} style={{ background: '#f0fdf4' }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{evt.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          📍 {evt.venue || 'Venue TBD'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{client ? client.name : 'Unknown Client'}</div>
                        {client?.company && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{client.company}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{evt.event_date}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ⏰ {evt.start_time || '--:--'} - {evt.end_time || '--:--'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{evt.guest_count} pax</td>
                      <td>
                        <span className="badge badge-confirmed">Confirmed Active</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                        ₹{displayTotal.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Link href={`/events/${evt.id}`} className="btn btn-secondary btn-sm">
                          View Event &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. UPCOMING EVENTS */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 className="card-title" style={{ margin: 0 }}>Upcoming Catering Events</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              All upcoming events in the calendar (inquiries, quoted proposals, and bookings)
            </p>
          </div>
          <Link href="/events" className="btn btn-secondary btn-sm">
            View All in Events Tab &rarr;
          </Link>
        </div>

        {upcomingEvents.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '1rem 0' }}>
            No upcoming events scheduled.
          </p>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event Title</th>
                  <th>Client</th>
                  <th>Event Date</th>
                  <th>Venue</th>
                  <th>Guests</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Quote Total</th>
                  <th style={{ textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {upcomingEvents.map((evt) => {
                  const client = state.clients.find((c) => c.id === evt.client_id);
                  const { grandTotal, menuTotal } = store.getEventTotal(evt.id);
                  const displayTotal = isFinancePermitted ? grandTotal : menuTotal;
                  return (
                    <tr key={evt.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{evt.title}</div>
                        {evt.notes && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {evt.notes}
                          </div>
                        )}
                      </td>
                      <td>{client ? client.name : 'Unknown Client'}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{evt.event_date}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {evt.start_time || '--:--'} - {evt.end_time || '--:--'}
                        </div>
                      </td>
                      <td>{evt.venue || 'TBD'}</td>
                      <td style={{ fontWeight: 600 }}>{evt.guest_count} pax</td>
                      <td>
                        <span className={`badge badge-${evt.status}`}>{evt.status}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        ₹{displayTotal.toLocaleString('en-IN')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Link href={`/events/${evt.id}`} className="btn btn-secondary btn-sm">
                          Open &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
